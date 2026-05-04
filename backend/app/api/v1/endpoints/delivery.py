"""
Delivery staff endpoints — repartidores con acceso limitado a su tienda.
"""
import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import require_vendor, require_delivery, get_current_user
from app.models.models import User, Role, Store, Order
from app.api.v1.endpoints.orders import (
    STATUS_TRANSITIONS, VALID_STATUSES, _buyer_wa_link, AuditLog
)

router = APIRouter()

# Transiciones permitidas para repartidores
DELIVERY_TRANSITIONS = {
    "preparing":  {"on_the_way"},
    "on_the_way": {"delivered"},
}


# ── Vendor: gestión de repartidores ───────────────────────────

class DeliveryStaffCreate(BaseModel):
    full_name: str
    email: str
    password: str
    phone: str | None = None


@router.get("/staff", summary="Listar repartidores de la tienda")
async def list_delivery_staff(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store_q = await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = store_q.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    role_q = await db.execute(select(Role).where(Role.name == "delivery"))
    delivery_role = role_q.scalar_one_or_none()
    if not delivery_role:
        return []

    result = await db.execute(
        select(User).where(
            User.role_id == delivery_role.id,
            User.delivery_store_id == store.id,
            User.deleted_at.is_(None),
        )
    )
    staff = result.scalars().all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "email": s.email,
            "phone": s.phone,
            "is_active": s.is_active,
        }
        for s in staff
    ]


@router.post("/staff", status_code=201, summary="Crear repartidor")
async def create_delivery_staff(
    payload: DeliveryStaffCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    from app.core.security import hash_password

    store_q = await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = store_q.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ya registrado")

    role_q = await db.execute(select(Role).where(Role.name == "delivery"))
    delivery_role = role_q.scalar_one_or_none()
    if not delivery_role:
        raise HTTPException(status_code=500, detail="Rol delivery no configurado en BD")

    user = User(
        role_id=delivery_role.id,
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        delivery_store_id=store.id,
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name}


@router.delete("/staff/{staff_id}", status_code=204, summary="Desactivar repartidor")
async def deactivate_delivery_staff(
    staff_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store_q = await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = store_q.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    user_q = await db.execute(
        select(User).where(User.id == staff_id, User.delivery_store_id == store.id)
    )
    staff = user_q.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Repartidor no encontrado")

    staff.is_active = False
    await db.commit()


# ── Delivery: ver y actualizar pedidos ────────────────────────

@router.get("/orders", summary="Pedidos activos para el repartidor")
async def delivery_orders(
    current_user=Depends(require_delivery),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.delivery_store_id:
        raise HTTPException(status_code=403, detail="Sin tienda asignada")

    result = await db.execute(
        select(Order)
        .where(
            Order.store_id == current_user.delivery_store_id,
            Order.status.in_(["preparing", "on_the_way"]),
        )
        .order_by(Order.created_at.asc())
    )
    orders = result.scalars().all()
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "buyer_name": o.buyer_name,
            "buyer_phone": o.buyer_phone,
            "buyer_address": o.buyer_address,
            "buyer_reference": o.buyer_reference,
            "total_cents": o.total_cents,
            "notes": o.notes,
            "created_at": o.created_at,
        }
        for o in orders
    ]


class DeliveryStatusUpdate(BaseModel):
    status: str


@router.patch("/orders/{order_id}/status", summary="Actualizar estado (repartidor)")
async def delivery_update_status(
    order_id: UUID,
    body: DeliveryStatusUpdate,
    current_user=Depends(require_delivery),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.delivery_store_id:
        raise HTTPException(status_code=403, detail="Sin tienda asignada")

    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.store_id == current_user.delivery_store_id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    new_status = body.status
    allowed = DELIVERY_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"No puedes cambiar de '{order.status}' a '{new_status}'",
        )

    # Necesitamos el store para el mensaje de WhatsApp
    store_q = await db.execute(select(Store).where(Store.id == current_user.delivery_store_id))
    store = store_q.scalar_one()

    old_status = order.status
    order.status = new_status

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

    if order.buyer_email:
        from app.services.push import send_push_to_buyer
        import asyncio
        asyncio.ensure_future(
            send_push_to_buyer(order.buyer_email, new_status, order.order_number, store.slug)
        )

    buyer_wa_link = _buyer_wa_link(order, store)
    return {"order_id": order.id, "status": order.status, "buyer_wa_link": buyer_wa_link}
