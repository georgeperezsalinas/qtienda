"""Vendor coupon management — authenticated, scoped to vendor's store."""
import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import Coupon, Store

router = APIRouter()

_CODE_RE = re.compile(r"^[A-Z0-9_-]{2,30}$")


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


def _serialize(c: Coupon) -> dict:
    return {
        "id": c.id,
        "code": c.code,
        "discount_type": c.discount_type,
        "discount_value": c.discount_value,
        "min_order_cents": c.min_order_cents,
        "max_uses": c.max_uses,
        "uses_count": c.uses_count,
        "expires_at": c.expires_at,
        "active": c.active,
        "created_at": c.created_at,
    }


class CouponCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: int
    min_order_cents: Optional[int] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None

    @field_validator("code")
    @classmethod
    def clean_code(cls, v):
        v = v.strip().upper()
        if not _CODE_RE.match(v):
            raise ValueError("El código debe tener 2-30 caracteres: letras, números, guiones")
        return v

    @field_validator("discount_type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("percent", "fixed"):
            raise ValueError("Tipo de descuento inválido")
        return v

    @field_validator("discount_value")
    @classmethod
    def positive_value(cls, v):
        if v <= 0:
            raise ValueError("El valor del descuento debe ser mayor a 0")
        return v


class CouponUpdate(BaseModel):
    active: Optional[bool] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None


@router.get("/")
async def list_coupons(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    rows = (await db.execute(
        select(Coupon).where(Coupon.store_id == store.id).order_by(Coupon.created_at.desc())
    )).scalars().all()
    return [_serialize(c) for c in rows]


@router.post("/", status_code=201)
async def create_coupon(
    payload: CouponCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)

    if payload.discount_type == "percent" and not (1 <= payload.discount_value <= 100):
        raise HTTPException(status_code=422, detail="El porcentaje debe estar entre 1 y 100")

    existing = (await db.execute(
        select(Coupon.id).where(Coupon.store_id == store.id, Coupon.code == payload.code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=422, detail="Ya existe un cupón con ese código")

    coupon = Coupon(
        store_id=store.id,
        code=payload.code,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        min_order_cents=payload.min_order_cents,
        max_uses=payload.max_uses,
        expires_at=payload.expires_at,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return _serialize(coupon)


@router.patch("/{coupon_id}")
async def update_coupon(
    coupon_id: UUID,
    payload: CouponUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    coupon = (await db.execute(
        select(Coupon).where(Coupon.id == coupon_id, Coupon.store_id == store.id)
    )).scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(coupon, field, value)

    await db.commit()
    await db.refresh(coupon)
    return _serialize(coupon)


@router.delete("/{coupon_id}", status_code=204)
async def delete_coupon(
    coupon_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    coupon = (await db.execute(
        select(Coupon).where(Coupon.id == coupon_id, Coupon.store_id == store.id)
    )).scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")

    await db.delete(coupon)
    await db.commit()
