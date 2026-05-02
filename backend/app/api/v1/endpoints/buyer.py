"""
Buyer endpoints — authenticated buyer order history.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import User, Order
from app.core.security import get_current_user

router = APIRouter()


@router.get("/orders")
async def get_buyer_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all orders placed by the authenticated buyer (matched by email)."""
    if not current_user.email:
        return []

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.store))
        .where(Order.buyer_email == current_user.email)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    return [
        {
            "order_number": o.order_number,
            "status": o.status,
            "total_cents": o.total_cents,
            "created_at": o.created_at,
            "store_name": o.store.name if o.store else None,
            "store_slug": o.store.slug if o.store else None,
            "store_logo_url": o.store.logo_url if o.store else None,
            "store_color": o.store.primary_color if o.store else "#6366f1",
            "items_count": len(o.items),
        }
        for o in orders
    ]


@router.get("/orders/{order_number}")
async def get_buyer_order_detail(
    order_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return detail for a single order — only if buyer_email matches."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.store))
        .where(Order.order_number == order_number)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if order.buyer_email != current_user.email:
        raise HTTPException(status_code=403, detail="No autorizado")

    return {
        "order_number": order.order_number,
        "status": order.status,
        "total_cents": order.total_cents,
        "subtotal_cents": order.subtotal_cents,
        "delivery_cents": order.delivery_cents,
        "created_at": order.created_at,
        "buyer_name": order.buyer_name,
        "buyer_phone": order.buyer_phone,
        "buyer_address": order.buyer_address,
        "notes": order.notes,
        "store_name": order.store.name if order.store else None,
        "store_slug": order.store.slug if order.store else None,
        "store_logo_url": order.store.logo_url if order.store else None,
        "store_color": order.store.primary_color if order.store else "#6366f1",
        "items": [
            {
                "product_name": i.product_name,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "subtotal": i.subtotal,
                "image_url": i.image_url,
            }
            for i in order.items
        ],
    }
