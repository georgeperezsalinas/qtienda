"""Aviso de vencimiento de planes.

Un watcher en el lifespan del backend revisa cada PLAN_EXPIRY_CHECK_HOURS las
suscripciones de pago que vencen en <= PLAN_EXPIRY_NOTICE_DAYS días y avisa al
vendedor por email, push web (PWA) y push móvil (Expo). Se notifica una sola
vez por suscripción (expiry_notified_at).
"""
import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import Store, Subscription

logger = logging.getLogger(__name__)


async def notify_expiring_subscriptions() -> int:
    """Busca suscripciones por vencer sin aviso previo y notifica. Devuelve cuántas."""
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
                Subscription.ends_at > now,
                Subscription.ends_at <= window_end,
                Subscription.expiry_notified_at.is_(None),
            )
        )).scalars().all()

        notified = 0
        for sub in subs:
            user = sub.store.user if sub.store else None
            if not user or not user.email:
                continue

            days_left = max(1, math.ceil((sub.ends_at - now).total_seconds() / 86_400))
            plan_name = sub.plan.name if sub.plan else "de pago"
            ends_str = sub.ends_at.astimezone(timezone(timedelta(hours=-5))).strftime("%d/%m/%Y")
            when = "mañana" if days_left == 1 else f"en {days_left} días"

            try:
                await _send_all_channels(user, plan_name, ends_str, days_left, when)
                sub.expiry_notified_at = now
                notified += 1
            except Exception:
                logger.exception("Error avisando vencimiento a %s", user.email)

        await db.commit()

    return notified


async def _send_all_channels(user, plan_name: str, ends_str: str, days_left: int, when: str) -> None:
    from app.services.email import send_plan_expiry_email
    from app.services.push import _notify_email as send_webpush, send_expo_push

    title = f"Tu Plan {plan_name} vence {when} ⏰"
    body = f"Renuévalo antes del {ends_str} para no perder tus beneficios."

    # Email (Resend)
    try:
        await send_plan_expiry_email(user.email, user.full_name, plan_name, ends_str, days_left)
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
        await asyncio.sleep(settings.PLAN_EXPIRY_CHECK_HOURS * 3600)
