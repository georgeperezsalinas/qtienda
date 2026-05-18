"""
app/services/push.py — qtienda push notifications
Archivo que orders.py ya importa:
    from app.services.push import send_push_to_buyer
    from app.services.push import send_push_to_vendor
"""
import json
import logging
from typing import Optional

from pywebpush import webpush, WebPushException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.db.session import AsyncSessionLocal   # fábrica de sesiones async
from app.models.models import PushSubscription

log = logging.getLogger(__name__)

# ── VAPID config ─────────────────────────────────────────────
VAPID_CLAIMS = {"sub": settings.VAPID_CLAIMS_EMAIL}


# ── Core: enviar a una suscripción ──────────────────────────
def _send_one(sub: PushSubscription, payload: dict) -> bool:
    """
    Envía una notificación push a un dispositivo específico.
    Síncrono — se llama desde asyncio.ensure_future con run_in_executor
    o directamente desde un thread.
    Devuelve True si OK, False si falló.
    """
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        log.warning("[push] VAPID keys no configuradas — omitiendo notificación")
        return False

    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth":   sub.auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True

    except WebPushException as e:
        if e.response and e.response.status_code == 410:
            # 410 Gone — suscripción expirada, se limpia abajo
            log.info("[push] Suscripción expirada: %s...", sub.endpoint[:50])
        else:
            log.warning("[push] WebPushException: %s", e)
        return False
    except Exception as e:
        log.error("[push] Error inesperado: %s", e)
        return False


# ── Helper async: notificar a todos los dispositivos de un email ──
async def _notify_email(email: str, payload: dict) -> int:
    """
    Abre su propia sesión de BD (fire-and-forget desde ensure_future).
    Devuelve el número de notificaciones enviadas.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PushSubscription).where(PushSubscription.buyer_email == email)
        )
        subs = result.scalars().all()

        if not subs:
            return 0

        sent = 0
        dead_endpoints = []

        for sub in subs:
            ok = _send_one(sub, payload)
            if ok:
                sent += 1
            else:
                dead_endpoints.append(sub.endpoint)

        # Limpiar suscripciones muertas
        if dead_endpoints:
            await db.execute(
                delete(PushSubscription).where(
                    PushSubscription.endpoint.in_(dead_endpoints)
                )
            )
            await db.commit()

        return sent


# ── Notificación al comprador — cambio de estado ─────────────
_BUYER_PUSH_MESSAGES = {
    "confirmed":  ("Pedido confirmado ✅",      "Ya recibimos tu pedido y lo estamos preparando"),
    "preparing":  ("Preparando tu pedido 👨‍🍳",  "Tu pedido está siendo preparado"),
    "on_the_way": ("¡Tu pedido viene en camino! 🛵", "El repartidor ya está en camino"),
    "delivered":  ("¡Pedido entregado! 🎉",      "Gracias por tu compra"),
    "cancelled":  ("Pedido cancelado",           "Tu pedido fue cancelado"),
}


async def send_push_to_buyer(
    buyer_email:  str,
    new_status:   str,
    order_number: str,
    store_slug:   str,
) -> None:
    """
    Llamado desde orders.py con asyncio.ensure_future() cuando
    el vendedor cambia el estado del pedido.
    Ya existe en orders.py:
        asyncio.ensure_future(
            send_push_to_buyer(order.buyer_email, new_status,
                               order.order_number, store.slug)
        )
    """
    if new_status not in _BUYER_PUSH_MESSAGES:
        return

    title, body = _BUYER_PUSH_MESSAGES[new_status]

    await _notify_email(buyer_email, {
        "title": title,
        "body":  f"{body} — Pedido #{order_number}",
        "url":   f"/mis-pedidos",
        "icon":  "/icon/icon-192.png",
        "badge": "/icon/icon-96.png",
        "tag":   f"order-{order_number}",
    })


# ── Notificación al vendedor — pedido nuevo ──────────────────
async def send_push_to_vendor(
    vendor_email:  str,
    order_number:  str,
    buyer_name:    str,
    total_cents:   int,
) -> None:
    """
    Llamado desde public.py cuando el comprador hace un pedido.
    Agrega estas líneas al final de create_order() en public.py,
    justo antes del return, después del await db.commit():

        # Push al vendedor (fire-and-forget)
        if store.user and store.user.email:
            from app.services.push import send_push_to_vendor
            import asyncio
            asyncio.ensure_future(
                send_push_to_vendor(
                    vendor_email  = store.user.email,
                    order_number  = order.order_number,
                    buyer_name    = payload.buyer_name,
                    total_cents   = order.total_cents,
                )
            )
    """
    total_soles = total_cents / 100
    await _notify_email(vendor_email, {
        "title": f"Nuevo pedido #{order_number} 🛍️",
        "body":  f"{buyer_name} · S/ {total_soles:.0f}",
        "url":   "/dashboard/pedidos",
        "icon":  "/icon/icon-192.png",
        "badge": "/icon/icon-96.png",
        "tag":   "new-order",   # agrupa todas las notifs de pedido en una
    })
