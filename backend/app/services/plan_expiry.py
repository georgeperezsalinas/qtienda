"""Aviso de vencimiento de planes.

Un watcher en el lifespan del backend revisa cada PLAN_EXPIRY_CHECK_HOURS las
suscripciones de pago que vencen en <= PLAN_EXPIRY_NOTICE_DAYS días (o que YA
vencieron y todavía no se avisó) y avisa al vendedor por email, push web (PWA),
push móvil (Expo) y en la campanita de notificaciones dentro de la app. Se
notifica una sola vez por suscripción (expiry_notified_at).
"""
import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import AuditLog, Notification, Order, OrderItem, Plan, Product, Store, Subscription
from app.services.referrals import referral_bonus

logger = logging.getLogger(__name__)


async def apply_plan_product_limit(store: Store, plan: Optional[Plan], db: AsyncSession) -> int:
    """Reconcilia qué productos quedan activos según el max_products del plan
    dado, dejando activos los de más ventas. No borra nada: los que sobran
    pasan a status='inactive' con hidden_by_plan_at=ahora; si el plan alcanza
    para todos, reactiva SOLO los que estaban ocultos por este motivo (nunca
    los que el vendedor desactivó a mano — esos quedan como están).
    Devuelve cuántos productos cambiaron de estado."""
    limit = plan.max_products if plan else None
    if limit and plan.slug == settings.FREE_PLAN_SLUG:
        bonus = await referral_bonus(store.user_id, db)
        limit += bonus["extra_products"]

    # Candidatos: los que hoy están activos (podrían sobrar) + los que están
    # ocultos por un downgrade anterior (podrían volver a entrar). Un producto
    # que el vendedor desactivó a mano (inactive, hidden_by_plan_at NULL) no
    # entra acá — se respeta su elección, no se lo reactiva solo.
    candidates = (await db.execute(
        select(Product).where(
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
            or_(Product.status == "active", Product.hidden_by_plan_at.is_not(None)),
        )
    )).scalars().all()

    if not limit:  # None o 0 = ilimitado, mismo criterio que products.py
        changed = 0
        for p in candidates:
            if p.hidden_by_plan_at is not None:
                p.status = "active"
                p.hidden_by_plan_at = None
                changed += 1
        return changed

    if not candidates:
        return 0

    sold_map = dict((await db.execute(
        select(OrderItem.product_id, func.sum(OrderItem.quantity))
        .join(Order, Order.id == OrderItem.order_id)
        .where(OrderItem.product_id.in_([p.id for p in candidates]), Order.status != "cancelled")
        .group_by(OrderItem.product_id)
    )).all())

    # Más vendidos primero; empate por antigüedad (el más viejo se queda).
    candidates.sort(key=lambda p: (-int(sold_map.get(p.id, 0)), p.created_at))

    now = datetime.now(timezone.utc)
    changed = 0
    for i, p in enumerate(candidates):
        if i < limit:
            if p.status != "active" or p.hidden_by_plan_at is not None:
                p.status = "active"
                p.hidden_by_plan_at = None
                changed += 1
        elif p.status == "active" or p.hidden_by_plan_at is None:
            p.status = "inactive"
            p.hidden_by_plan_at = now
            changed += 1

    return changed


async def notify_expiring_subscriptions() -> int:
    """Busca suscripciones por vencer O YA VENCIDAS sin aviso previo y notifica.
    Devuelve cuántas. OJO: antes este query exigía ends_at > now, así que una
    suscripción que ya había vencido quedaba fuera para siempre (nunca se
    volvía a evaluar) — ahora también se atrapan las vencidas."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=settings.PLAN_EXPIRY_NOTICE_DAYS)

    async with AsyncSessionLocal() as db:
        # FOR UPDATE SKIP LOCKED: el backend corre con 2 workers (Dockerfile),
        # cada uno con su propio expiry_watcher() — sin este lock, ambos
        # agarran la misma suscripción en la misma pasada y el vendedor recibe
        # el aviso (email/push/WhatsApp) duplicado.
        subs = (await db.execute(
            select(Subscription)
            .options(
                selectinload(Subscription.plan),
                selectinload(Subscription.store).selectinload(Store.user),
            )
            .where(
                Subscription.status == "active",
                Subscription.ends_at.is_not(None),
                Subscription.ends_at <= window_end,
                Subscription.expiry_notified_at.is_(None),
            )
            .with_for_update(of=Subscription, skip_locked=True)
        )).scalars().all()

        notified = 0
        for sub in subs:
            user = sub.store.user if sub.store else None
            if not user or not user.email:
                continue

            overdue = sub.ends_at <= now
            days = max(1, math.ceil(abs((sub.ends_at - now).total_seconds()) / 86_400))
            plan_name = sub.plan.name if sub.plan else "de pago"
            ends_str = sub.ends_at.astimezone(timezone(timedelta(hours=-5))).strftime("%d/%m/%Y")
            when = (
                f"hace {days} día{'s' if days != 1 else ''}" if overdue
                else ("mañana" if days == 1 else f"en {days} días")
            )

            try:
                await _send_all_channels(
                    str(sub.store_id), user, plan_name, ends_str, days, when, overdue,
                )
                sub.expiry_notified_at = now
                notified += 1
            except Exception:
                logger.exception("Error avisando vencimiento a %s", user.email)

        await db.commit()

    return notified


async def _send_all_channels(
    store_id: str, user, plan_name: str, ends_str: str, days: int, when: str, overdue: bool,
) -> None:
    from app.services.email import send_plan_expiry_email
    from app.services.push import _notify_email as send_webpush, send_expo_push
    from app.services.notifications import emit_event

    if overdue:
        title = f"Tu Plan {plan_name} venció {when} ⚠️"
        body = f"Venció el {ends_str} — renuévalo para no perder tus beneficios."
    else:
        title = f"Tu Plan {plan_name} vence {when} ⏰"
        body = f"Renuévalo antes del {ends_str} para no perder tus beneficios."

    # Campanita in-app primero — no dispara push propio (los pushes de acá
    # abajo lo cubren, evita duplicar), pero así el badge que se calcula
    # después ya incluye esta notificación.
    try:
        await emit_event(store_id, "plan_expiring", title=title, body=body)
    except Exception:
        logger.exception("Notificación in-app de vencimiento falló para store %s", store_id)

    # Numerito del ícono de la app — mismo conteo que usa notifications.py
    unread_count = None
    try:
        async with AsyncSessionLocal() as db:
            unread_count = (await db.execute(
                select(func.count()).select_from(Notification).where(
                    Notification.store_id == store_id, Notification.read_at.is_(None)
                )
            )).scalar()
    except Exception:
        logger.exception("No se pudo calcular unread_count para store %s", store_id)

    # Email (Resend)
    try:
        await send_plan_expiry_email(user.email, user.full_name, plan_name, ends_str, days, overdue=overdue)
    except Exception:
        logger.exception("Email de vencimiento falló para %s", user.email)

    # Push web (PWA)
    try:
        await send_webpush(user.email, {
            "title": title,
            "body": body,
            "url": "/dashboard/planes",
            "icon": "/icon/icon-192.png",
            "badge": "/icon/icon-96.png",
            "badgeCount": unread_count,
            "tag": "plan-expiry",
        })
    except Exception:
        logger.exception("WebPush de vencimiento falló para %s", user.email)

    # Push móvil (Expo)
    try:
        if getattr(user, "push_token", None):
            await send_expo_push(
                expo_token=user.push_token,
                title=title,
                body=body,
                data={"type": "plan_expiry"},
                badge=unread_count,
            )
    except Exception:
        logger.exception("Expo push de vencimiento falló para %s", user.email)

    # WhatsApp — el canal que más se abre; a diferencia del email/push, no
    # depende de que el vendedor haya vuelto a abrir la app o revise su correo.
    try:
        if getattr(user, "phone", None):
            from app.services.whatsapp import send_whatsapp_message
            renew_url = f"{settings.APP_URL}/dashboard/planes"
            wa_text = (
                f"*{title}*\n\n{body}\n\n"
                f"Paga con Yape o tarjeta desde tu panel: {renew_url}\n"
                "Si no renuevas, tu tienda pasa al plan gratuito automáticamente (no se borra nada)."
            )
            await send_whatsapp_message(user.phone, wa_text)
    except Exception:
        logger.exception("WhatsApp de vencimiento falló para %s", user.email)


async def downgrade_expired_subscriptions() -> int:
    """Baja al plan gratuito las suscripciones de pago vencidas hace más de
    PLAN_EXPIRY_GRACE_DAYS (y ya avisadas — expiry_notified_at no es nulo, así
    que nunca se baja a nadie sin haberle avisado antes). No se borra nada:
    se marca la suscripción vieja como "expired", se abre una nueva de plan
    gratuito (mismo patrón que al crear la tienda) y se actualiza store.plan_id."""
    from app.services.notifications import emit_event

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.PLAN_EXPIRY_GRACE_DAYS)

    async with AsyncSessionLocal() as db:
        free_plan = (
            await db.execute(select(Plan).where(Plan.slug == settings.FREE_PLAN_SLUG))
        ).scalar_one_or_none()
        if not free_plan:
            logger.error("Plan gratuito no configurado — no se puede degradar suscripciones vencidas")
            return 0

        # FOR UPDATE SKIP LOCKED: mismo motivo que en notify_expiring_subscriptions()
        # — con 2 workers, sin esto cada uno degrada la misma suscripción por su
        # cuenta y queda una fila de plan gratuito duplicada por tienda.
        subs = (await db.execute(
            select(Subscription)
            .options(selectinload(Subscription.plan), selectinload(Subscription.store))
            .where(
                Subscription.status == "active",
                Subscription.ends_at.is_not(None),
                Subscription.ends_at <= cutoff,
                Subscription.expiry_notified_at.is_not(None),
                Subscription.plan_id != free_plan.id,
            )
            .with_for_update(of=Subscription, skip_locked=True)
        )).scalars().all()

        downgraded = 0
        for sub in subs:
            if not sub.store:
                continue

            old_plan_name = sub.plan.name if sub.plan else "de pago"
            sub.status = "expired"

            db.add(Subscription(
                store_id=sub.store_id,
                plan_id=free_plan.id,
                status="active",
                starts_at=now,
            ))
            sub.store.plan_id = free_plan.id

            db.add(AuditLog(
                user_id=None,  # accion automatica del sistema, no de un admin
                store_id=sub.store_id,
                action="subscription.auto_downgraded",
                entity="subscriptions",
                entity_id=sub.id,
                old_value={"plan": old_plan_name, "status": "active"},
                new_value={"plan": free_plan.name, "status": "expired"},
            ))

            # Si quedó con más productos activos que el límite del plan free,
            # se ocultan los de menos ventas (quedan los más vendidos activos).
            # No se borra nada — ver apply_plan_product_limit().
            hidden_count = await apply_plan_product_limit(sub.store, free_plan, db)

            products_count = (await db.execute(
                select(func.count()).select_from(Product).where(
                    Product.store_id == sub.store_id, Product.deleted_at.is_(None)
                )
            )).scalar()

            try:
                await emit_event(
                    str(sub.store_id), "plan_downgraded",
                    products_count=products_count,
                    products_limit=free_plan.max_products,
                    products_hidden=hidden_count,
                    old_plan_name=old_plan_name, free_plan_name=free_plan.name,
                )
            except Exception:
                logger.exception("Notificación de downgrade falló para store %s", sub.store_id)

            downgraded += 1

        await db.commit()

    return downgraded


async def expiry_watcher() -> None:
    """Corre dentro del lifespan del backend; revisa periódicamente."""
    await asyncio.sleep(30)  # dejar terminar el arranque
    while True:
        try:
            n = await notify_expiring_subscriptions()
            if n:
                logger.info("Avisos de vencimiento enviados: %d", n)
        except Exception:
            logger.exception("Fallo el chequeo de vencimientos")

        try:
            d = await downgrade_expired_subscriptions()
            if d:
                logger.info("Suscripciones degradadas a plan gratuito: %d", d)
        except Exception:
            logger.exception("Fallo el chequeo de degradación de planes")

        await asyncio.sleep(settings.PLAN_EXPIRY_CHECK_HOURS * 3600)
