# app/api/v1/endpoints/devices.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter()

class DeviceTokenIn(BaseModel):
    token:    str
    platform: str = "android"

@router.post("/token", status_code=200)
async def register_device_token(
    payload:      DeviceTokenIn,
    db:           AsyncSession = Depends(get_db),
    current_user               = Depends(get_current_user),
):
    """Guarda el Expo Push Token del vendor."""
    # Obtener el objeto User de la sesión actual y actualizar directamente
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user:
        user.push_token = payload.token
        await db.commit()
    return {"ok": True}
