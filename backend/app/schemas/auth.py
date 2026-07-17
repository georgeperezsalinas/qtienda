"""Schemas — qtienda.shop"""
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


# ── Auth ──────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    referral_code: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Contraseña mínimo 8 caracteres")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Stores ────────────────────────────────────────────────────

class StoreCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def slugify(cls, v):
        return re.sub(r"[^a-z0-9\-]", "", v.lower().replace(" ", "-"))


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    whatsapp: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    banner_link: Optional[str] = None
    primary_color: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    meta_title: Optional[str] = None
    meta_desc: Optional[str] = None

    @field_validator("country")
    @classmethod
    def valid_country(cls, v):
        if v is None:
            return v
        v = v.strip().upper()
        if not re.match(r"^[A-Z]{2}$", v):
            raise ValueError("País inválido (código ISO de 2 letras)")
        return v

    @field_validator("banner_link")
    @classmethod
    def validate_banner_link(cls, v):
        # Solo URLs http(s) o rutas internas: evita javascript: en el href público
        if v and not re.match(r"^(https?://|/)", v):
            raise ValueError("El enlace debe comenzar con https:// o /")
        return v


class BannerItem(BaseModel):
    image_url: str
    link_url: Optional[str] = None

    @field_validator("link_url")
    @classmethod
    def validate_link(cls, v):
        if v and not re.match(r"^(https?://|/)", v):
            raise ValueError("El enlace debe comenzar con https:// o /")
        return v


class BannersUpdate(BaseModel):
    banners: list[BannerItem]


class StoreSettingsUpdate(BaseModel):
    accept_cash: Optional[bool] = None
    accept_yape: Optional[bool] = None
    accept_plin: Optional[bool] = None
    accept_transfer: Optional[bool] = None
    accept_card: Optional[bool] = None
    require_prepayment: Optional[bool] = None
    yape_phone: Optional[str] = None
    plin_phone: Optional[str] = None
    bank_account: Optional[str] = None
    min_order_cents: Optional[int] = None
    delivery_fee_cents: Optional[int] = None
    free_delivery_above: Optional[int] = None
    delivery_zones: Optional[list] = None
    store_hours: Optional[dict] = None


# ── Products ──────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_cents: int
    compare_price: Optional[int] = None
    category_id: Optional[UUID] = None
    sku: Optional[str] = None
    stock: Optional[int] = None
    is_featured: bool = False

    @field_validator("price_cents")
    @classmethod
    def positive_price(cls, v):
        if v <= 0:
            raise ValueError("Precio debe ser mayor a 0")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cents: Optional[int] = None
    compare_price: Optional[int] = None
    category_id: Optional[UUID] = None
    sku: Optional[str] = None
    stock: Optional[int] = None
    status: Optional[str] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Orders ────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    product_id: UUID
    quantity: int

    @field_validator("quantity")
    @classmethod
    def positive_qty(cls, v):
        if v < 1:
            raise ValueError("Cantidad mínima 1")
        return v


class PublicOrderCreate(BaseModel):
    buyer_name: str
    buyer_phone: str
    # Opcionales a nivel API para no romper clientes viejos (app móvil);
    # la web los exige en el formulario de checkout.
    buyer_dni: Optional[str] = None
    buyer_email: Optional[EmailStr] = None
    buyer_department: Optional[str] = None
    buyer_province: Optional[str] = None
    buyer_district: Optional[str] = None
    buyer_address: Optional[str] = None
    buyer_reference: Optional[str] = None
    items: List[OrderItemIn]
    payment_method: Optional[str] = "cash"
    notes: Optional[str] = None
    source: Optional[str] = "tiktok"
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None

    @field_validator("items")
    @classmethod
    def non_empty(cls, v):
        if not v:
            raise ValueError("El carrito está vacío")
        return v

    @field_validator("buyer_phone")
    @classmethod
    def clean_phone(cls, v):
        cleaned = re.sub(r"\D", "", v)
        if len(cleaned) < 7:
            raise ValueError("Teléfono inválido")
        return cleaned

    @field_validator("buyer_dni")
    @classmethod
    def clean_dni(cls, v):
        # Genérico multi-país: DNI (PE/AR), CI, CC, cédula… El formato estricto
        # (8 dígitos para Perú) lo valida el frontend según el país de la tienda.
        if v is None or not v.strip():
            return None
        cleaned = re.sub(r"[^A-Za-z0-9]", "", v).upper()
        # Máx 15: la columna orders.buyer_dni es VARCHAR(15)
        if not 5 <= len(cleaned) <= 15:
            raise ValueError("Documento de identidad inválido")
        return cleaned


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError("El nombre no puede estar vacío")
        return v.strip() if v else v


class OrderResponse(BaseModel):
    order_id: UUID
    order_number: str
    status: str
    total_cents: int
    whatsapp_link: Optional[str]

    class Config:
        from_attributes = True
