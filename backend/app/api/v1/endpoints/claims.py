"""Libro de Reclamaciones — gestión del vendedor (listar y responder)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import StoreClaim, Store

router = APIRouter()


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


def _serialize(c: StoreClaim) -> dict:
    return {
        "id": c.id,
        "claim_number": c.claim_number,
        "type": c.type,
        "consumer_name": c.consumer_name,
        "consumer_dni": c.consumer_dni,
        "consumer_address": c.consumer_address,
        "consumer_phone": c.consumer_phone,
        "consumer_email": c.consumer_email,
        "order_id": c.order_id,
        "detail": c.detail,
        "claimed_amount_cents": c.claimed_amount_cents,
        "vendor_response": c.vendor_response,
        "status": c.status,
        "created_at": c.created_at,
        "responded_at": c.responded_at,
    }


class ClaimRespond(BaseModel):
    vendor_response: str


@router.get("/")
async def list_claims(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    rows = (await db.execute(
        select(StoreClaim).where(StoreClaim.store_id == store.id).order_by(StoreClaim.created_at.desc())
    )).scalars().all()
    return [_serialize(c) for c in rows]


@router.post("/{claim_id}/respond")
async def respond_claim(
    claim_id: str,
    payload: ClaimRespond,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    if not payload.vendor_response.strip():
        raise HTTPException(status_code=422, detail="La respuesta no puede estar vacía")

    store = await _get_store(current_user, db)
    claim = (await db.execute(
        select(StoreClaim).where(StoreClaim.id == claim_id, StoreClaim.store_id == store.id)
    )).scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Reclamo no encontrado")

    from datetime import datetime, timezone
    claim.vendor_response = payload.vendor_response.strip()
    claim.status = "responded"
    claim.responded_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(claim)
    return _serialize(claim)
