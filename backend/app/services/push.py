"""
Web Push notification service using pywebpush + VAPID.
Silently skips if VAPID keys are not configured.
"""
import asyncio
import json
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_STATUS_PUSH = {
    "confirmed": {
        "title": "✅ Pedido confirmado",
        "body":  "Tu pedido fue confirmado y está siendo alistado.",
    },
    "preparing": {
        "title": "🛠️ Preparando tu pedido",
        "body":  "¡Tu pedido está en preparación!",
    },
    "on_the_way": {
        "title": "🚀 ¡Tu pedido está en camino!",
        "body":  "El repartidor ya va hacia ti. Prepárate para recibirlo.",
    },
    "delivered": {
        "title": "📦 ¡Tu pedido llegó!",
        "body":  "Esperamos que todo haya llegado perfecto 😊",
    },
    "cancelled": {
        "title": "❌ Pedido cancelado",
        "body":  "Tu pedido fue cancelado. Escríbenos si tienes preguntas.",
    },
}


def _send_push_sync(endpoint: str, p256dh: str, auth_key: str, payload: dict) -> None:
    from pywebpush import webpush, WebPushException
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth_key},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            content_encoding="aes128gcm",
        )
    except WebPushException as ex:
        status = ex.response.status_code if ex.response else None
        if status == 410:
            raise  # subscription gone — caller should delete it
        logger.warning("Push delivery failed (status=%s): %s", status, ex)


async def send_push_to_buyer(
    buyer_email: str,
    new_status: str,
    order_number: str,
    store_slug: str,
) -> None:
    if not settings.VAPID_PRIVATE_KEY:
        return

    msg = _STATUS_PUSH.get(new_status)
    if not msg:
        return

    from sqlalchemy import select, delete
    from app.models.models import PushSubscription
    from app.db.session import AsyncSessionLocal

    payload = {
        "title": msg["title"],
        "body":  msg["body"],
        "url":   f"/tienda/{store_slug}/pedido/{order_number}",
        "icon":  "/logo_qtienda.png",
        "badge": "/logo_qtienda.png",
    }

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.buyer_email == buyer_email)
        )
        subs = result.scalars().all()
        if not subs:
            return

        stale_ids = []
        for sub in subs:
            try:
                await asyncio.to_thread(_send_push_sync, sub.endpoint, sub.p256dh, sub.auth, payload)
            except Exception as ex:
                if hasattr(ex, "response") and ex.response and ex.response.status_code == 410:
                    stale_ids.append(sub.id)

        if stale_ids:
            await db.execute(
                delete(PushSubscription).where(PushSubscription.id.in_(stale_ids))
            )
            await db.commit()
