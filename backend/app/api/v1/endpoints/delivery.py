"""
Delivery staff endpoints — repartidores con acceso limitado a su tienda.
"""
import os
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import require_vendor, require_delivery, get_current_user
from app.models.models import User, Role, Store, Order, Delivery, Payment
from app.api.v1.endpoints.orders import (
    STATUS_TRANSITIONS, VALID_STATUSES, _buyer_wa_link, AuditLog
)

router = APIRouter()

# Transiciones permitidas para repartidores
DELIVERY_TRANSITIONS = {
    "preparing":  {"on_the_way"},
    "on_the_way": {"delivered"},
}

_PROOF_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_PROOF_MAX_MB = 10
_UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/tmp/qtienda-uploads"))


# ── Vendor: gestión de repartidores ───────────────────────────

class DeliveryStaffCreate(BaseModel):
    full_name: str
    email: str
    password: str
    phone: str | None = None
    vehicle_type: str | None = None
    vehicle_plate: str | None = None


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
            "vehicle_type": s.vehicle_type,
            "vehicle_plate": s.vehicle_plate,
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
        vehicle_type=payload.vehicle_type,
        vehicle_plate=payload.vehicle_plate,
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "vehicle_type": user.vehicle_type,
        "vehicle_plate": user.vehicle_plate,
        "is_active": user.is_active,
    }


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


# ── Delivery: info de tienda ──────────────────────────────────

@router.get("/store", summary="Datos de la tienda del repartidor")
async def delivery_store_info(
    current_user=Depends(require_delivery),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.delivery_store_id:
        raise HTTPException(status_code=403, detail="Sin tienda asignada")
    store_q = await db.execute(select(Store).where(Store.id == current_user.delivery_store_id))
    store = store_q.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return {
        "name": store.name,
        "logo_url": store.logo_url,
        "slug": store.slug,
        "country": store.country,
        "currency": store.currency,
    }


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
        .options(selectinload(Order.payment))
        .where(
            Order.store_id == current_user.delivery_store_id,
            Order.status.in_(["preparing", "on_the_way"]),
            Order.assigned_to_id == current_user.id,
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
            "payment_method": o.payment_method,
            "payment_status": o.payment.status if o.payment else "pending",
            "notes": o.notes,
            "created_at": o.created_at,
        }
        for o in orders
    ]


@router.get("/orders/history", summary="Pedidos entregados por el repartidor")
async def delivery_orders_history(
    limit: int = 20,
    current_user=Depends(require_delivery),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.delivery_store_id:
        raise HTTPException(status_code=403, detail="Sin tienda asignada")

    result = await db.execute(
        select(Order)
        .where(
            Order.store_id == current_user.delivery_store_id,
            Order.status == "delivered",
            Order.assigned_to_id == current_user.id,
        )
        .order_by(Order.updated_at.desc())
        .limit(limit)
    )
    orders = result.scalars().all()
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status,
            "buyer_name": o.buyer_name,
            "buyer_address": o.buyer_address,
            "total_cents": o.total_cents,
            "updated_at": o.updated_at,
        }
        for o in orders
    ]


@router.post("/orders/{order_id}/proof-photo", summary="Subir foto de entrega")
async def upload_proof_photo(
    order_id: UUID,
    file: UploadFile = File(...),
    current_user=Depends(require_delivery),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.delivery_store_id:
        raise HTTPException(status_code=403, detail="Sin tienda asignada")

    result = await db.execute(
        select(Order).where(
            Order.id == order_id,
            Order.store_id == current_user.delivery_store_id,
            Order.assigned_to_id == current_user.id,
            Order.status == "on_the_way",
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pedido no encontrado o no disponible")

    if file.content_type not in _PROOF_ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de archivo no permitido. Use JPEG, PNG o WebP.")

    content = await file.read()
    if len(content) > _PROOF_MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=422, detail=f"Imagen muy grande. Máximo {_PROOF_MAX_MB}MB.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"delivery_{_uuid.uuid4()}.{ext}"

    from app.core.config import settings as _settings
    from app.api.v1.endpoints.uploads import _save_local, _upload_r2

    if _settings.S3_ENDPOINT and _settings.S3_ACCESS_KEY:
        url = await _upload_r2(content, filename, file.content_type, object_key=f"delivery/{filename}")
    else:
        url = _save_local(content, filename)

    return {"url": url}


class DeliveryStatusUpdate(BaseModel):
    status: str
    proof_photo_url: str | None = None
    lat: float | None = None
    lng: float | None = None
    payment_collected: bool | None = None


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

    if new_status == "delivered" and not body.proof_photo_url:
        raise HTTPException(status_code=422, detail="Se requiere foto de entrega")

    store_q = await db.execute(select(Store).where(Store.id == current_user.delivery_store_id))
    store = store_q.scalar_one()

    old_status = order.status
    order.status = new_status

    if new_status == "delivered":
        now = datetime.now(timezone.utc)
        if not order.delivered_at:
            order.delivered_at = now
        delivery_q = await db.execute(select(Delivery).where(Delivery.order_id == order.id))
        delivery = delivery_q.scalar_one_or_none()
        if delivery:
            delivery.proof_photo_url = body.proof_photo_url
            delivery.delivered_at = now
            delivery.delivered_lat = body.lat
            delivery.delivered_lng = body.lng
        else:
            db.add(Delivery(
                order_id=order.id,
                proof_photo_url=body.proof_photo_url,
                delivered_at=now,
                delivered_lat=body.lat,
                delivered_lng=body.lng,
            ))

        if body.payment_collected is True:
            payment_q = await db.execute(select(Payment).where(Payment.order_id == order.id))
            payment = payment_q.scalar_one_or_none()
            if payment:
                payment.status = "paid"
                payment.paid_at = now
            else:
                db.add(Payment(
                    order_id=order.id,
                    method=order.payment_method,
                    status="paid",
                    amount_cents=order.total_cents,
                    paid_at=now,
                ))

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
