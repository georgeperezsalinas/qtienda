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

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import AuditLog, Plan, Product, Store, Subscription

logger = logging.getLogger(__name__)


async def notify_expiring_subscriptions() -> int:
    """Busca suscripciones por vencer O YA VENCIDAS sin aviso previo y notifica.
    Devuelve cuántas. OJO: antes este query exigía ends_at > now, así que una
    suscripción que ya había vencido quedaba fuera para siempre (nunca se
    volvía a evaluar) — ahora también se atrapan las vencidas."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=settings.PLAN_EXPIRY_NOTICE_DAYS)

    async with AsyncSessionLocal() as db:
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
            )
    except Exception:
        logger.exception("Expo push de vencimiento falló para %s", user.email)

    # Campanita in-app — no dispara push propio (ya se mandó arriba, evita duplicar)
    try:
        await emit_event(store_id, "plan_expiring", title=title, body=body)
    except Exception:
        logger.exception("Notificación in-app de vencimiento falló para store %s", store_id)


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

            # No se toca ningún producto existente — solo se informa si quedó
            # sobre el límite del plan nuevo (el bloqueo real ya lo hace
            # products.py al intentar crear uno nuevo).
            products_count = (await db.execute(
                select(func.count()).select_from(Product).where(
                    Product.store_id == sub.store_id, Product.deleted_at.is_(None)
                )
            )).scalar()
            products_over_limit = (
                free_plan.max_products is not None and products_count > free_plan.max_products
            )

            try:
                await emit_event(
                    str(sub.store_id), "plan_downgraded",
                    products_count=products_count,
                    products_limit=free_plan.max_products,
                    products_over_limit=products_over_limit,
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
