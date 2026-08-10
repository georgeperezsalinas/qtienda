"""Salud de tienda: reactivacion e impulso de ventas.

Un watcher en el lifespan del backend revisa periodicamente (cada
STORE_HEALTH_CHECK_HOURS) las tiendas activas buscando:
  - inactividad total: sin pedidos ni visitas en STORE_INACTIVE_DAYS
  - falta de ventas: con productos publicados pero sin pedidos en STORE_NO_SALES_DAYS

Notifica una sola vez por racha (inactive_notified_at / no_sales_notified_at en
Store), mismo patron que app.services.plan_expiry con expiry_notified_at.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import Order, Product, Store, StoreEvent
from app.services.notifications import emit_event

logger = logging.getLogger(__name__)


async def check_inactive_stores() -> int:
    """Tiendas activas sin pedidos ni visitas en STORE_INACTIVE_DAYS. Notifica 1 vez por racha."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.STORE_INACTIVE_DAYS)

    last_order_sq = (
        select(func.max(Order.created_at))
        .where(Order.store_id == Store.id)
        .correlate(Store)
        .scalar_subquery()
    )
    last_event_sq = (
        select(func.max(StoreEvent.created_at))
        .where(StoreEvent.store_id == Store.id)
        .correlate(Store)
        .scalar_subquery()
    )
    last_activity = func.greatest(
        func.coalesce(last_order_sq, Store.created_at),
        func.coalesce(last_event_sq, Store.created_at),
    )

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Store.id, Store.inactive_notified_at, last_activity.label("last_activity"))
            .where(Store.status == "active", Store.deleted_at.is_(None))
        )).all()

        to_notify = [
            r.id for r in rows
            if r.last_activity < cutoff
            and (r.inactive_notified_at is None or r.inactive_notified_at < r.last_activity)
        ]
        for store_id in to_notify:
            store = await db.get(Store, store_id)
            store.inactive_notified_at = now
        await db.commit()

    for store_id in to_notify:
        try:
            await emit_event(str(store_id), "inactive_7d")
        except Exception:
            logger.exception("Error notificando inactividad a store %s", store_id)

    return len(to_notify)


async def check_no_sales_stores() -> int:
    """Tiendas activas con productos pero sin pedidos en STORE_NO_SALES_DAYS. Notifica 1 vez por racha."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=settings.STORE_NO_SALES_DAYS)

    last_order_sq = (
        select(func.max(Order.created_at))
        .where(Order.store_id == Store.id)
        .correlate(Store)
        .scalar_subquery()
    )
    product_count_sq = (
        select(func.count())
        .select_from(Product)
        .where(Product.store_id == Store.id, Product.deleted_at.is_(None))
        .correlate(Store)
        .scalar_subquery()
    )

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(
                Store.id,
                Store.no_sales_notified_at,
                Store.created_at,
                last_order_sq.label("last_order"),
                product_count_sq.label("product_count"),
            ).where(Store.status == "active", Store.deleted_at.is_(None))
        )).all()

        to_notify = []
        for r in rows:
            if r.product_count < 1:
                continue
            last_sale_ref = r.last_order or r.created_at
            if last_sale_ref >= cutoff:
                continue
            if r.no_sales_notified_at is not None and r.no_sales_notified_at >= last_sale_ref:
                continue
            to_notify.append(r.id)

        for store_id in to_notify:
            store = await db.get(Store, store_id)
            store.no_sales_notified_at = now
        await db.commit()

    for store_id in to_notify:
        try:
            await emit_event(str(store_id), "no_sales_30d")
        except Exception:
            logger.exception("Error notificando falta de ventas a store %s", store_id)

    return len(to_notify)


async def store_health_watcher() -> None:
    """Corre dentro del lifespan del backend; revisa periódicamente."""
    await asyncio.sleep(45)  # dejar terminar el arranque
    while True:
        try:
            n_inactive = await check_inactive_stores()
            n_no_sales = await check_no_sales_stores()
            if n_inactive or n_no_sales:
                logger.info(
                    "Salud de tienda: %d inactivas, %d sin ventas notificadas",
                    n_inactive, n_no_sales,
                )
        except Exception:
            logger.exception("Fallo el chequeo de salud de tienda")
        await asyncio.sleep(settings.STORE_HEALTH_CHECK_HOURS * 3600)
