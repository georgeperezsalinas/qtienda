"""
Push notification subscription management.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.session import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.models import PushSubscription

router = APIRouter()


class SubscribePayload(BaseModel):
    endpoint: str
    p256dh:   str
    auth:     str
    email:    str  # buyer email — may differ from logged-in user


@router.post("/subscribe", status_code=204)
async def subscribe(payload: SubscribePayload, db: AsyncSession = Depends(get_db)):
    # Upsert: update keys if endpoint already exists
    existing = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    sub = existing.scalar_one_or_none()
    if sub:
        sub.buyer_email = payload.email
        sub.p256dh      = payload.p256dh
        sub.auth        = payload.auth
    else:
        db.add(PushSubscription(
            buyer_email = payload.email,
            endpoint    = payload.endpoint,
            p256dh      = payload.p256dh,
            auth        = payload.auth,
        ))
    await db.commit()


@router.delete("/unsubscribe", status_code=204)
async def unsubscribe(endpoint: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    await db.commit()


@router.get("/vapid-public-key")
async def vapid_public_key():
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"public_key": settings.VAPID_PUBLIC_KEY}
