"""
SQLAlchemy ORM models — qtienda.shop
All PKs are UUIDs, soft-delete via deleted_at.
"""
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer,
    SmallInteger, String, Text, func, DECIMAL, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Roles ─────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int]        = mapped_column(SmallInteger, primary_key=True)
    name: Mapped[str]      = mapped_column(
        Enum("admin", "vendor", "buyer", "delivery", name="user_role", create_type=False), unique=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[List["User"]] = relationship(back_populates="role")


# ── Users ─────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id: Mapped[int]         = mapped_column(SmallInteger, ForeignKey("roles.id"), nullable=False)
    email: Mapped[str]           = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    password_hash: Mapped[str]   = mapped_column(Text, nullable=False)
    full_name: Mapped[str]       = mapped_column(String(150), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    delivery_store_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="SET NULL"), nullable=True)
    vehicle_type: Mapped[Optional[str]]  = mapped_column(String(20))
    vehicle_plate: Mapped[Optional[str]] = mapped_column(String(15))
    is_active: Mapped[bool]      = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool]    = mapped_column(Boolean, default=False)
    referral_code: Mapped[Optional[str]] = mapped_column(String(12), unique=True)
    referred_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    email_verification_token: Mapped[Optional[str]]     = mapped_column(String(64))
    email_verification_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    password_reset_token: Mapped[Optional[str]]      = mapped_column(String(64))
    password_reset_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[Optional[datetime]]    = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    push_token:    Mapped[Optional[str]]  = mapped_column(String, nullable=True)
    push_platform: Mapped[Optional[str]]  = mapped_column(String, default="android")

    role: Mapped["Role"] = relationship(back_populates="users")
    store: Mapped[Optional["Store"]] = relationship(
        back_populates="user", uselist=False, foreign_keys="[Store.user_id]"
    )


# ── Plans ─────────────────────────────────────────────────────

class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str]           = mapped_column(String(80))
    slug: Mapped[str]           = mapped_column(String(40), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    price_cents: Mapped[int]    = mapped_column(Integer, default=0)
    currency: Mapped[str]       = mapped_column(String(3), default="PEN")
    interval: Mapped[str]       = mapped_column(
        Enum("monthly", "yearly", name="plan_interval", create_type=False),
        default="monthly",
    )
    max_products: Mapped[Optional[int]] = mapped_column(Integer, default=10)
    max_orders_mo: Mapped[Optional[int]] = mapped_column(Integer)
    features: Mapped[dict]      = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    stores: Mapped[List["Store"]] = relationship(back_populates="plan")


# ── Stores ────────────────────────────────────────────────────

class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    slug: Mapped[str]               = mapped_column(String(60), unique=True)
    name: Mapped[str]               = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text)
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    banner_url: Mapped[Optional[str]] = mapped_column(Text)
    banner_link: Mapped[Optional[str]] = mapped_column(Text)
    whatsapp: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[str]             = mapped_column(
        Enum("pending", "active", "suspended", "banned", name="store_status", create_type=False),
        default="pending",
    )
    primary_color: Mapped[str]      = mapped_column(String(7), default="#6366f1")
    theme: Mapped[str]              = mapped_column(String(20), default="clasico")
    city: Mapped[Optional[str]]     = mapped_column(String(80))
    country: Mapped[str]            = mapped_column(String(2), default="PE")
    meta_title: Mapped[Optional[str]] = mapped_column(String(120))
    meta_desc: Mapped[Optional[str]]  = mapped_column(String(300))
    is_test: Mapped[bool]           = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    inactive_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    no_sales_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    shared_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    campaign_contacted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"]            = relationship(back_populates="store", foreign_keys="[Store.user_id]")
    plan: Mapped[Optional["Plan"]]  = relationship(back_populates="stores")
    settings: Mapped[Optional["StoreSettings"]] = relationship(back_populates="store", uselist=False, cascade="all, delete-orphan")
    banners: Mapped[List["StoreBanner"]] = relationship(back_populates="store", cascade="all, delete-orphan", order_by="StoreBanner.sort_order")
    categories: Mapped[List["Category"]] = relationship(back_populates="store", cascade="all, delete-orphan")
    products: Mapped[List["Product"]]    = relationship(back_populates="store", cascade="all, delete-orphan")
    orders: Mapped[List["Order"]]        = relationship(back_populates="store")
    subscriptions: Mapped[List["Subscription"]] = relationship(back_populates="store", cascade="all, delete-orphan")


class StoreSettings(Base):
    __tablename__ = "store_settings"

    store_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    accept_cash: Mapped[bool]       = mapped_column(Boolean, default=True)
    accept_yape: Mapped[bool]       = mapped_column(Boolean, default=False)
    accept_plin: Mapped[bool]       = mapped_column(Boolean, default=False)
    accept_transfer: Mapped[bool]   = mapped_column(Boolean, default=False)
    accept_card: Mapped[bool]       = mapped_column(Boolean, default=False)
    require_prepayment: Mapped[bool] = mapped_column(Boolean, default=False)
    yape_phone: Mapped[Optional[str]]    = mapped_column(String(20))
    plin_phone: Mapped[Optional[str]]    = mapped_column(String(20))
    yape_qr_url: Mapped[Optional[str]]   = mapped_column(Text)
    plin_qr_url: Mapped[Optional[str]]   = mapped_column(Text)
    bank_account: Mapped[Optional[str]]  = mapped_column(Text)
    min_order_cents: Mapped[int]         = mapped_column(Integer, default=0)
    delivery_fee_cents: Mapped[int]      = mapped_column(Integer, default=0)
    free_delivery_above: Mapped[Optional[int]] = mapped_column(Integer)
    welcome_discount_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    welcome_discount_cents: Mapped[int]    = mapped_column(Integer, default=0)
    delivery_zones: Mapped[list]         = mapped_column(JSONB, default=list)
    store_hours: Mapped[dict]            = mapped_column(JSONB, default=dict)
    custom_css: Mapped[Optional[str]]    = mapped_column(Text)
    updated_at: Mapped[datetime]         = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship(back_populates="settings")


# ── Categories ────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("store_id", "slug", name="uq_category_store_slug"),)

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"))
    name: Mapped[str]           = mapped_column(String(80))
    slug: Mapped[str]           = mapped_column(String(80))
    icon: Mapped[Optional[str]] = mapped_column(String(10))
    sort_order: Mapped[int]     = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"]            = relationship(back_populates="categories")
    products: Mapped[List["Product"]] = relationship(back_populates="category")


# ── Products ──────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("store_id", "slug", name="uq_product_store_slug"),)

    id: Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"))
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"))
    name: Mapped[str]               = mapped_column(String(200))
    slug: Mapped[str]               = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    price_cents: Mapped[int]        = mapped_column(Integer)
    compare_price: Mapped[Optional[int]] = mapped_column(Integer)
    sale_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sku: Mapped[Optional[str]]      = mapped_column(String(80))
    stock: Mapped[Optional[int]]    = mapped_column(Integer)
    status: Mapped[str]             = mapped_column(
        Enum("active", "inactive", "out_of_stock", name="product_status", create_type=False),
        default="active",
    )
    is_featured: Mapped[bool]       = mapped_column(Boolean, default=False)
    sort_order: Mapped[int]         = mapped_column(Integer, default=0)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store: Mapped["Store"]           = relationship(back_populates="products")
    category: Mapped[Optional["Category"]] = relationship(back_populates="products")
    images: Mapped[List["ProductImage"]] = relationship(back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"))
    url: Mapped[str]            = mapped_column(Text)
    alt_text: Mapped[Optional[str]] = mapped_column(String(200))
    sort_order: Mapped[int]     = mapped_column(SmallInteger, default=0)
    is_primary: Mapped[bool]    = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="images")


# ── Orders ────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id"), nullable=False)
    order_number: Mapped[str]       = mapped_column(String(20))
    status: Mapped[str]             = mapped_column(
        Enum("pending", "confirmed", "preparing", "on_the_way", "delivered", "cancelled",
             name="order_status", create_type=False),
        default="pending",
    )
    buyer_name: Mapped[str]         = mapped_column(String(150))
    buyer_phone: Mapped[str]        = mapped_column(String(20))
    buyer_dni: Mapped[Optional[str]] = mapped_column(String(15))
    buyer_email: Mapped[Optional[str]] = mapped_column(String(255))
    buyer_department: Mapped[Optional[str]] = mapped_column(String(80))
    buyer_province: Mapped[Optional[str]] = mapped_column(String(80))
    buyer_district: Mapped[Optional[str]] = mapped_column(String(80))
    buyer_address: Mapped[Optional[str]] = mapped_column(Text)
    buyer_reference: Mapped[Optional[str]] = mapped_column(Text)
    buyer_lat: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 7))
    buyer_lng: Mapped[Optional[float]] = mapped_column(DECIMAL(10, 7))
    subtotal_cents: Mapped[int]     = mapped_column(Integer)
    delivery_cents: Mapped[int]     = mapped_column(Integer, default=0)
    discount_cents: Mapped[int]     = mapped_column(Integer, default=0)
    total_cents: Mapped[int]        = mapped_column(Integer)
    notes: Mapped[Optional[str]]    = mapped_column(Text)
    source: Mapped[str]             = mapped_column(String(40), default="tiktok")
    utm_source: Mapped[Optional[str]] = mapped_column(String(80))
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(80))
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    payment_method: Mapped[str]      = mapped_column(String(30), default="cash")
    assigned_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"]                  = relationship(back_populates="orders")
    items: Mapped[List["OrderItem"]]        = relationship(back_populates="order", cascade="all, delete-orphan")
    payment: Mapped[Optional["Payment"]]    = relationship(back_populates="order", uselist=False)
    delivery: Mapped[Optional["Delivery"]]  = relationship(back_populates="order", uselist=False)
    assigned_to: Mapped[Optional["User"]]   = relationship(foreign_keys="Order.assigned_to_id")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"))
    product_name: Mapped[str]       = mapped_column(String(200))
    product_sku: Mapped[Optional[str]] = mapped_column(String(80))
    unit_price: Mapped[int]         = mapped_column(Integer)
    quantity: Mapped[int]           = mapped_column(Integer, default=1)
    subtotal: Mapped[int]           = mapped_column(Integer)
    image_url: Mapped[Optional[str]] = mapped_column(Text)

    order: Mapped["Order"]   = relationship(back_populates="items")
    product: Mapped[Optional["Product"]] = relationship()


# ── Payments ──────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    method: Mapped[str]         = mapped_column(String(30))
    status: Mapped[str]         = mapped_column(
        Enum("pending", "paid", "failed", "refunded", name="payment_status", create_type=False),
        default="pending",
    )
    amount_cents: Mapped[int]   = mapped_column(Integer)
    reference: Mapped[Optional[str]] = mapped_column(String(120))
    proof_url: Mapped[Optional[str]] = mapped_column(Text)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped["Order"] = relationship(back_populates="payment")


# ── Deliveries ────────────────────────────────────────────────

class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID]     = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"))
    courier_name: Mapped[Optional[str]]  = mapped_column(String(120))
    courier_phone: Mapped[Optional[str]] = mapped_column(String(20))
    tracking_code: Mapped[Optional[str]] = mapped_column(String(80))
    estimated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    proof_photo_url: Mapped[Optional[str]]   = mapped_column(Text)
    delivered_lat: Mapped[Optional[float]]   = mapped_column(DECIMAL(10, 7))
    delivered_lng: Mapped[Optional[float]]   = mapped_column(DECIMAL(10, 7))
    notes: Mapped[Optional[str]]             = mapped_column(Text)
    created_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped["Order"] = relationship(back_populates="delivery")


# ── Subscriptions ─────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"))
    plan_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    status: Mapped[str]         = mapped_column(
        Enum("active", "cancelled", "expired", "trial", name="subscription_status", create_type=False),
        default="trial",
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[Optional[datetime]]  = mapped_column(DateTime(timezone=True))
    expiry_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    payment_ref: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship(back_populates="subscriptions")
    plan: Mapped["Plan"]   = relationship()


class PlanPaymentRequest(Base):
    """Pago manual de plan (Yape directo): el vendedor yapea y el admin aprueba."""
    __tablename__ = "plan_payment_requests"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"))
    plan_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    method: Mapped[str]         = mapped_column(String(20), default="yape")
    amount_cents: Mapped[int]   = mapped_column(Integer)
    operation_number: Mapped[Optional[str]] = mapped_column(String(40))
    payer_phone: Mapped[Optional[str]]      = mapped_column(String(20))
    note: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str]         = mapped_column(String(20), default="pending")  # pending/approved/rejected
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]]  = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[Optional[str]]     = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"] = relationship()
    plan: Mapped["Plan"]   = relationship()


# ── Push Subscriptions ────────────────────────────────────────

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID]           = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_email: Mapped[str]        = mapped_column(String(255), nullable=False)
    endpoint: Mapped[str]           = mapped_column(Text, unique=True)
    p256dh: Mapped[str]             = mapped_column(Text)
    auth: Mapped[str]               = mapped_column(Text)
    created_at: Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Audit Logs ────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    store_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="SET NULL"))
    action: Mapped[str]         = mapped_column(String(80))
    entity: Mapped[Optional[str]] = mapped_column(String(80))
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Store Banners (QT-030) ────────────────────────────────────

class StoreBanner(Base):
    __tablename__ = "store_banners"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    image_url: Mapped[str]      = mapped_column(Text)
    link_url: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int]     = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store: Mapped["Store"]      = relationship(back_populates="banners")


# ── Mall Banners (rotatorios en /tiendas, administrables desde /admin) ──

class MallBanner(Base):
    __tablename__ = "mall_banners"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_url: Mapped[str]      = mapped_column(Text)
    link_url: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int]     = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Favoritos del comprador (sincronizados con localStorage) ───

class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_favorite_user_product"),)

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Reseñas de compradores (una por pedido entregado) ──────────

class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    rating: Mapped[int]         = mapped_column(SmallInteger)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    hidden_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


# ── Store Events (analytics) ──────────────────────────────────

class StoreEvent(Base):
    __tablename__ = "store_events"

    id: Mapped[int]             = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    event: Mapped[str]          = mapped_column(String(30))
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"))
    session_id: Mapped[Optional[str]] = mapped_column(String(64))
    device: Mapped[Optional[str]] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SiteEvent(Base):
    """Trafico a nivel dominio (landing, /tiendas) — store_events no sirve
    porque su store_id es NOT NULL y no puede representar una visita sin tienda."""
    __tablename__ = "site_events"

    id: Mapped[int]             = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event: Mapped[str]          = mapped_column(String(30))
    path: Mapped[Optional[str]] = mapped_column(String(200))
    referrer: Mapped[Optional[str]] = mapped_column(String(300))
    session_id: Mapped[Optional[str]] = mapped_column(String(64))
    device: Mapped[Optional[str]] = mapped_column(String(10))
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Notifications (inbox del vendedor) ─────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int]             = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str]           = mapped_column(String(40))
    title: Mapped[str]          = mapped_column(String(150))
    body: Mapped[str]           = mapped_column(String(300))
    icon: Mapped[Optional[str]] = mapped_column(String(10))
    action_url: Mapped[Optional[str]] = mapped_column(String(200))
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
