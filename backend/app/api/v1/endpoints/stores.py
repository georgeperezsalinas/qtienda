import re
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_vendor
from app.models.models import Store, StoreSettings, Plan, Subscription
from app.schemas.stores import StoreCreate, StoreUpdate, StoreSettingsUpdate

router = APIRouter()

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9\-]{2,58}[a-z0-9]$")


@router.post("/", status_code=201)
async def create_store(
    payload: StoreCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    # Require verified email
    if not current_user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Debes verificar tu correo antes de crear una tienda. Revisa tu bandeja de entrada.",
        )

    # Only one store per vendor
    existing = await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ya tienes una tienda")

    slug = payload.slug.lower().strip()
    if not SLUG_RE.match(slug):
        raise HTTPException(status_code=422, detail="Slug inválido (solo letras, números y guiones)")

    dup = await db.execute(select(Store.id).where(Store.slug == slug, Store.deleted_at.is_(None)))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="URL ya en uso, elige otro nombre")

    # Free plan
    plan_q = await db.execute(select(Plan).where(Plan.slug == settings.FREE_PLAN_SLUG))
    free_plan = plan_q.scalar_one_or_none()
    if not free_plan:
        raise HTTPException(status_code=500, detail="Plan gratuito no configurado")

    store = Store(
        user_id=current_user.id,
        plan_id=free_plan.id,
        slug=slug,
        name=payload.name,
        description=payload.description,
        whatsapp=payload.whatsapp,
        city=payload.city,
        status="active",  # Auto-approve on free plan; can add review flow
    )
    db.add(store)
    await db.flush()

    # Default settings
    db.add(StoreSettings(store_id=store.id))

    # Trial subscription
    from datetime import datetime, timedelta, timezone
    db.add(Subscription(
        store_id=store.id,
        plan_id=free_plan.id,
        status="active",
        starts_at=datetime.now(timezone.utc),
    ))

    await db.commit()
    await db.refresh(store)

    return {
        "id": store.id,
        "slug": store.slug,
        "name": store.name,
        "store_url": f"https://qtienda.shop/tienda/{store.slug}",
        "status": store.status,
    }


@router.get("/me")
async def my_store(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.settings), selectinload(Store.categories))
        .where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes tienda aún")

    return {
        "id": store.id,
        "slug": store.slug,
        "name": store.name,
        "description": store.description,
        "logo_url": store.logo_url,
        "banner_url": store.banner_url,
        "whatsapp": store.whatsapp,
        "status": store.status,
        "primary_color": store.primary_color,
        "city": store.city,
        "country": store.country,
        "meta_title": store.meta_title,
        "meta_desc": store.meta_desc,
        "store_url": f"https://qtienda.shop/tienda/{store.slug}",
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "slug": c.slug,
                "icon": c.icon,
                "sort_order": c.sort_order,
            }
            for c in sorted(store.categories, key=lambda x: x.sort_order)
        ],
        "settings": {
            "accept_cash": store.settings.accept_cash,
            "accept_yape": store.settings.accept_yape,
            "accept_plin": store.settings.accept_plin,
            "accept_transfer": store.settings.accept_transfer,
            "yape_phone": store.settings.yape_phone,
            "plin_phone": store.settings.plin_phone,
            "bank_account": store.settings.bank_account,
            "min_order_cents": store.settings.min_order_cents,
            "delivery_fee_cents": store.settings.delivery_fee_cents,
            "free_delivery_above": store.settings.free_delivery_above,
            "delivery_zones": store.settings.delivery_zones,
            "store_hours": store.settings.store_hours,
        } if store.settings else None,
        "created_at": store.created_at,
    }


@router.patch("/me")
async def update_store(
    payload: StoreUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(store, field, value)

    await db.commit()
    return {"updated": True}


@router.patch("/me/settings")
async def update_settings(
    payload: StoreSettingsUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store).options(selectinload(Store.settings))
        .where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    settings = store.settings
    if not settings:
        settings = StoreSettings(store_id=store.id)
        db.add(settings)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    return {"updated": True}
