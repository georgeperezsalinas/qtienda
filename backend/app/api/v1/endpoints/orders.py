"""
Vendor order management — authenticated, scoped to vendor's store.
Multi-tenant: vendors only see their own orders.
"""
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import Order, Store, AuditLog


class OrderStatusUpdate(BaseModel):
    status: str

router = APIRouter()


async def get_vendor_store(user, db: AsyncSession) -> Store:
    """Ensure vendor has an active store and return it."""
    result = await db.execute(
        select(Store).where(
            Store.user_id == user.id,
            Store.deleted_at.is_(None),
        )
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


VALID_STATUSES = {"pending", "confirmed", "preparing", "on_the_way", "delivered", "cancelled"}
STATUS_TRANSITIONS = {
    "pending":    {"confirmed", "cancelled"},
    "confirmed":  {"preparing", "cancelled"},
    "preparing":  {"on_the_way", "cancelled"},
    "on_the_way": {"delivered", "cancelled"},
    "delivered":  set(),
    "cancelled":  {"pending"},
}


@router.get("/stats/summary")
async def order_stats(
    from_date: Optional[date] = Query(None, description="YYYY-MM-DD"),
    to_date:   Optional[date] = Query(None, description="YYYY-MM-DD"),
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """KPI summary for vendor. Defaults to current month if no dates given."""
    store = await get_vendor_store(current_user, db)

    from sqlalchemy import case

    now = datetime.now(timezone.utc)

    if from_date is None:
        # Default: first day of current month
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    else:
        start = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)

    if to_date is None:
        end = now
    else:
        # Include the full to_date day
        end = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)

    result = await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Order.status == "pending",   1))).label("pending"),
            func.count(case((Order.status == "delivered", 1))).label("delivered"),
            func.count(case((Order.status == "cancelled", 1))).label("cancelled"),
            func.coalesce(func.sum(
                case((Order.status != "cancelled", Order.total_cents), else_=0)
            ), 0).label("revenue_cents"),
        )
        .where(
            Order.store_id == store.id,
            Order.created_at >= start,
            Order.created_at <= end,
        )
    )
    row = result.one()

    return {
        "this_month": {
            "total_orders":  row.total,
            "pending":       row.pending,
            "delivered":     row.delivered,
            "cancelled":     row.cancelled,
            "revenue_cents": row.revenue_cents,
        }
    }


@router.get("/")
async def list_orders(
    status: Optional[str]  = Query(None),
    page: int              = Query(1, ge=1),
    limit: int             = Query(20, le=100),
    search: Optional[str]  = Query(None),
    current_user           = Depends(require_vendor),
    db: AsyncSession       = Depends(get_db),
):
    store = await get_vendor_store(current_user, db)

    filters = [Order.store_id == store.id]
    if status:
        filters.append(Order.status == status)
    if search:
        filters.append(
            Order.buyer_name.ilike(f"%{search}%") |
            Order.buyer_phone.ilike(f"%{search}%") |
            Order.order_number.ilike(f"%{search}%")
        )

    total_q = await db.execute(select(func.count()).select_from(Order).where(and_(*filters)))
    total = total_q.scalar()

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(and_(*filters))
        .order_by(Order.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    orders = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "buyer_name": o.buyer_name,
                "buyer_phone": o.buyer_phone,
                "total_cents": o.total_cents,
                "items_count": len(o.items),
                "created_at": o.created_at,
            }
            for o in orders
        ],
    }


@router.get("/{order_id}")
async def get_order(
    order_id: UUID,
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await get_vendor_store(current_user, db)

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.payment),
            selectinload(Order.delivery),
        )
        .where(Order.id == order_id, Order.store_id == store.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "buyer_name": order.buyer_name,
        "buyer_phone": order.buyer_phone,
        "buyer_email": order.buyer_email,
        "buyer_address": order.buyer_address,
        "buyer_reference": order.buyer_reference,
        "subtotal_cents": order.subtotal_cents,
        "delivery_cents": order.delivery_cents,
        "discount_cents": order.discount_cents,
        "total_cents": order.total_cents,
        "notes": order.notes,
        "source": order.source,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product_name,
                "product_sku": i.product_sku,
                "unit_price": i.unit_price,
                "quantity": i.quantity,
                "subtotal": i.subtotal,
                "image_url": i.image_url,
            }
            for i in order.items
        ],
        "payment": {
            "method": order.payment.method,
            "status": order.payment.status,
            "amount_cents": order.payment.amount_cents,
            "reference": order.payment.reference,
        } if order.payment else None,
        "delivery": {
            "courier_name": order.delivery.courier_name,
            "courier_phone": order.delivery.courier_phone,
            "tracking_code": order.delivery.tracking_code,
            "estimated_at": order.delivery.estimated_at,
            "delivered_at": order.delivery.delivered_at,
            "notes": order.delivery.notes,
        } if order.delivery else None,
    }


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: UUID,
    body: OrderStatusUpdate,
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await get_vendor_store(current_user, db)

    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.store_id == store.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    new_status = body.status
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido")

    allowed = STATUS_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"No se puede pasar de '{order.status}' a '{new_status}'",
        )

    old_status = order.status
    order.status = new_status

    # Audit
    db.add(AuditLog(
        user_id=current_user.id,
        store_id=store.id,
        action="order.status_change",
        entity="orders",
        entity_id=order.id,
        old_value={"status": old_status},
        new_value={"status": new_status},
    ))

    await db.commit()
    return {"order_id": order.id, "status": order.status}
