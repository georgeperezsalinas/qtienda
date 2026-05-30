# app/api/v1/endpoints/devices.py
# Recibe y guarda el Expo Push Token del dispositivo del vendor
# POST /api/v1/devices/token

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from pydantic import BaseModel

from app.db.session import get_db
from app.core.security import require_vendor   # igual que orders.py
from app.models.models import User             # igual que orders.py

router = APIRouter()

class DeviceTokenIn(BaseModel):
    token:    str
    platform: str = "android"   # "ios" | "android"

@router.post("/token", status_code=200)
async def register_device_token(
    payload:      DeviceTokenIn,
    db:           AsyncSession = Depends(get_db),
    current_user               = Depends(require_vendor),
):
    """Guarda o actualiza el Expo Push Token del vendor."""
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(expo_push_token=payload.token)
    )
    await db.commit()
    return {"ok": True}
