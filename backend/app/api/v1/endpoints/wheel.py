"""Ruleta de premios — configuración del vendedor (segmentos + on/off)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import StoreWheelConfig, Store

router = APIRouter()

MAX_SEGMENTS = 6


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


class WheelSegment(BaseModel):
    label: str
    discount_type: str  # 'percent' | 'fixed' | 'none'
    discount_value: int = 0
    weight: int
    color: str

    @field_validator("discount_type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("percent", "fixed", "none"):
            raise ValueError("Tipo de premio inválido")
        return v

    @field_validator("weight")
    @classmethod
    def positive_weight(cls, v):
        if v <= 0:
            raise ValueError("El peso debe ser mayor a 0")
        return v


class WheelConfigUpdate(BaseModel):
    enabled: bool
    segments: list[WheelSegment]

    @field_validator("segments")
    @classmethod
    def valid_segments(cls, v):
        if not (2 <= len(v) <= MAX_SEGMENTS):
            raise ValueError(f"Debes definir entre 2 y {MAX_SEGMENTS} premios")
        return v


def _serialize(c: StoreWheelConfig) -> dict:
    return {
        "enabled": c.enabled,
        "segments": c.segments,
        "updated_at": c.updated_at,
    }


@router.get("/")
async def get_wheel_config(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    config = (await db.execute(
        select(StoreWheelConfig).where(StoreWheelConfig.store_id == store.id)
    )).scalar_one_or_none()
    if not config:
        return {"enabled": False, "segments": [], "updated_at": None}
    return _serialize(config)


@router.put("/")
async def update_wheel_config(
    payload: WheelConfigUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    config = (await db.execute(
        select(StoreWheelConfig).where(StoreWheelConfig.store_id == store.id)
    )).scalar_one_or_none()

    segments_data = [s.model_dump() for s in payload.segments]

    if not config:
        config = StoreWheelConfig(store_id=store.id, enabled=payload.enabled, segments=segments_data)
        db.add(config)
    else:
        config.enabled = payload.enabled
        config.segments = segments_data

    await db.commit()
    await db.refresh(config)
    return _serialize(config)
