"""Salud de tienda: reactivacion e impulso de ventas.

Un watcher en el lifespan del backend revisa periodicamente (cada
STORE_HEALTH_CHECK_HOURS) las tiendas activas buscando:
  - inactividad total: sin pedidos ni visitas en STORE_INACTIVE_DAYS
  - falta de ventas: con productos publicados pero sin pedidos en STORE_NO_SALES_DAYS
  - tiendas sin productos: avisos escalonados a los STORE_NO_PRODUCTS_WARN_DAYS /
    _FINAL_DAYS / _URGENT_DAYS de creada. Son SOLO advertencias — este watcher
    nunca cambia el status de la tienda; cerrarla queda a criterio del equipo/admin.

Notifica una sola vez por racha (inactive_notified_at / no_sales_notified_at en
Store), mismo patron que app.services.plan_expiry con expiry_notified_at. Los
avisos de "sin productos" son eventos "once" (dedupe por indice unico parcial
en la tabla notifications), no necesitan columna de tracking propia.
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


async def check_missing_products_stores() -> int:
    """Tiendas activas sin ningún producto, con avisos escalonados por edad de la
    tienda. Solo advertencias — nunca cambia el status de la tienda. El dedupe de
    cada tramo (warn/final/urgent) lo resuelve el índice único parcial de
    notifications, así que alcanza con evaluar la edad en cada corrida."""
    now = datetime.now(timezone.utc)

    product_count_sq = (
        select(func.count())
        .select_from(Product)
        .where(Product.store_id == Store.id, Product.deleted_at.is_(None))
        .correlate(Store)
        .scalar_subquery()
    )

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Store.id, Store.created_at, product_count_sq.label("product_count"))
            .where(Store.status == "active", Store.deleted_at.is_(None))
        )).all()

    notified = 0
    for r in rows:
        if r.product_count > 0:
            continue

        age_days = (now - r.created_at).total_seconds() / 86_400
        if age_days >= settings.STORE_NO_PRODUCTS_URGENT_DAYS:
            event_type = "no_products_urgent"
        elif age_days >= settings.STORE_NO_PRODUCTS_FINAL_DAYS:
            event_type = "no_products_final"
        elif age_days >= settings.STORE_NO_PRODUCTS_WARN_DAYS:
            event_type = "no_products_warn"
        else:
            continue

        try:
            await emit_event(str(r.id), event_type)
            notified += 1
        except Exception:
            logger.exception("Error notificando falta de productos a store %s", r.id)

    return notified


async def store_health_watcher() -> None:
    """Corre dentro del lifespan del backend; revisa periódicamente."""
    await asyncio.sleep(45)  # dejar terminar el arranque
    while True:
        try:
            n_inactive = await check_inactive_stores()
            n_no_sales = await check_no_sales_stores()
            n_no_products = await check_missing_products_stores()
            if n_inactive or n_no_sales or n_no_products:
                logger.info(
                    "Salud de tienda: %d inactivas, %d sin ventas, %d sin productos notificadas",
                    n_inactive, n_no_sales, n_no_products,
                )
        except Exception:
            logger.exception("Fallo el chequeo de salud de tienda")
        await asyncio.sleep(settings.STORE_HEALTH_CHECK_HOURS * 3600)
