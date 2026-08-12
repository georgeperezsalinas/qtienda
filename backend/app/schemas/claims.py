"""Schemas — Libro de Reclamaciones."""
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator


class ClaimCreate(BaseModel):
    type: str
    consumer_name: str
    consumer_dni: str
    consumer_address: str
    consumer_phone: Optional[str] = None
    consumer_email: Optional[EmailStr] = None
    order_id: Optional[UUID] = None
    detail: str
    claimed_amount_cents: Optional[int] = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("reclamo", "queja"):
            raise ValueError("Tipo inválido — debe ser 'reclamo' o 'queja'")
        return v

    @field_validator("consumer_name", "consumer_dni", "consumer_address", "detail")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Este campo es obligatorio")
        return v.strip()

    @field_validator("claimed_amount_cents")
    @classmethod
    def non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("El monto reclamado no puede ser negativo")
        return v
