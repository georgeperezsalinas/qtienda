"""
app/api/v1/endpoints/phone_verification.py — verificación de teléfono por
código de WhatsApp (Evolution API), sin auth. Anti-spam antes de reservar
una cita o confirmar un pedido en la tienda pública.
"""
import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.models import PhoneVerification
from app.services.whatsapp import send_whatsapp_message

log = logging.getLogger(__name__)
router = APIRouter()


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _clean_phone(v: str) -> str:
    """Deja solo dígitos. Si el largo no tiene forma de teléfono real (muy
    corto, o más largo que el máximo E.164 de 15 dígitos — ej. un número
    duplicado por un bug de formato en el cliente), lanza HTTPException 400
    en vez de dejar que un valor así llegue a insertarse: la columna
    phone_verifications.phone es VARCHAR(20) y antes reventaba con un 500
    crudo de Postgres (StringDataRightTruncation) en vez de un error
    entendible para el comprador."""
    cleaned = re.sub(r"\D", "", v)
    if len(cleaned) < 7 or len(cleaned) > 15:
        raise HTTPException(status_code=400, detail="Teléfono inválido")
    return cleaned


class SendCodeRequest(BaseModel):
    phone: str


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str


@router.post("/send-code")
@limiter.limit("5/hour")
async def send_code(request: Request, payload: SendCodeRequest, db: AsyncSession = Depends(get_db)):
    phone = _clean_phone(payload.phone)

    # Anti-spam por teléfono además del límite por IP de arriba — evita que
    # alguien detrás de otra IP siga bombardeando el mismo número.
    recent_count = (await db.execute(
        select(func.count()).select_from(PhoneVerification).where(
            PhoneVerification.phone == phone,
            PhoneVerification.created_at >= datetime.now(timezone.utc) - timedelta(hours=1),
        )
    )).scalar()
    if recent_count >= 3:
        raise HTTPException(status_code=429, detail="Ya pediste varios códigos con este número. Espera un momento e intenta de nuevo.")

    code = f"{random.randint(0, 999999):06d}"
    verification = PhoneVerification(
        phone=phone,
        code_hash=_hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.PHONE_CODE_EXPIRE_MINUTES),
    )
    db.add(verification)
    await db.commit()

    sent = await send_whatsapp_message(
        phone,
        "🔐 *Verificación qtienda*\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Tu código es: *{code}*\n\n"
        f"Válido por {settings.PHONE_CODE_EXPIRE_MINUTES} minutos. Si no lo pediste tú, ignora este mensaje.\n\n"
        "_Este es el número de notificaciones de qtienda — no es el WhatsApp de ninguna tienda en particular._",
    )
    if not sent:
        raise HTTPException(status_code=502, detail="No se pudo enviar el código, intenta de nuevo")

    return {"sent": True}


@router.post("/verify-code")
@limiter.limit("10/hour")
async def verify_code(request: Request, payload: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    phone = _clean_phone(payload.phone)
    verification = (await db.execute(
        select(PhoneVerification)
        .where(
            PhoneVerification.phone == phone,
            PhoneVerification.expires_at >= datetime.now(timezone.utc),
        )
        .order_by(PhoneVerification.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    if not verification:
        raise HTTPException(status_code=400, detail="Código expirado o no encontrado, pide uno nuevo")
    if verification.attempts >= 5:
        raise HTTPException(status_code=429, detail="Demasiados intentos, pide un código nuevo")

    if verification.code_hash != _hash_code(payload.code.strip()):
        verification.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Código incorrecto")

    verification.verified_at = datetime.now(timezone.utc)
    await db.commit()
    return {"verified": True}


async def is_phone_verified(phone: str, db: AsyncSession) -> bool:
    """Usado por create_appointment/create_order (public.py) — True si este
    teléfono tiene una verificación confirmada dentro de la ventana vigente."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.PHONE_VERIFIED_VALID_MINUTES)
    verification = (await db.execute(
        select(PhoneVerification.id).where(
            PhoneVerification.phone == re.sub(r"\D", "", phone),
            PhoneVerification.verified_at.is_not(None),
            PhoneVerification.verified_at >= cutoff,
        ).limit(1)
    )).scalar_one_or_none()
    return verification is not None
