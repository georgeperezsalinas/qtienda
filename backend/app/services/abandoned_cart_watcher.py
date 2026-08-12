"""Recuperación de carrito abandonado.

Un watcher en el lifespan del backend revisa periódicamente (cada
ABANDONED_CART_CHECK_MINUTES) los carritos 'open' en AbandonedCart que llevan
más de ABANDONED_CART_THRESHOLD_MINUTES sin actualizarse (el comprador agregó
productos pero no completó el pedido) y notifica al vendedor una sola vez por
carrito (notified_at), mismo patrón que store_health_watcher.py.

El snapshot de cada carrito se arma en track_event() (public.py) cuando llega
un evento add_to_cart con cart_items — no hay tracking nuevo del lado del
frontend más allá de lo que storeAnalytics.ts ya envía.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import AbandonedCart
from app.services.notifications import emit_event

logger = logging.getLogger(__name__)


async def check_abandoned_carts() -> int:
    """Carritos 'open' sin actividad hace más de ABANDONED_CART_THRESHOLD_MINUTES.
    Notifica una sola vez por carrito (notified_at)."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=settings.ABANDONED_CART_THRESHOLD_MINUTES)

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(AbandonedCart).where(
                AbandonedCart.status == "open",
                AbandonedCart.updated_at < cutoff,
                AbandonedCart.notified_at.is_(None),
            )
        )).scalars().all()

        to_notify = [
            (str(c.store_id), len(c.items or []), c.subtotal_cents, c.buyer_phone)
            for c in rows
        ]
        for c in rows:
            c.notified_at = now
            c.status = "notified"
        await db.commit()

    for store_id, items_count, subtotal_cents, buyer_phone in to_notify:
        try:
            await emit_event(
                store_id, "abandoned_cart",
                items_count=items_count, subtotal_cents=subtotal_cents, buyer_phone=buyer_phone,
            )
        except Exception:
            logger.exception("Error notificando carrito abandonado a store %s", store_id)

    return len(to_notify)


async def abandoned_cart_watcher() -> None:
    """Corre dentro del lifespan del backend; revisa periódicamente."""
    await asyncio.sleep(60)  # dejar terminar el arranque
    while True:
        try:
            n = await check_abandoned_carts()
            if n:
                logger.info("Carrito abandonado: %d notificados", n)
        except Exception:
            logger.exception("Fallo el chequeo de carritos abandonados")
        await asyncio.sleep(settings.ABANDONED_CART_CHECK_MINUTES * 60)
