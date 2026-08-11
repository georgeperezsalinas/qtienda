import re
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_vendor
from app.models.models import Product, Store, StoreBanner, StoreEvent, StoreSettings, Plan, Subscription
from app.schemas.stores import StoreCreate, StoreUpdate, StoreSettingsUpdate
from app.schemas.auth import BannersUpdate

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
    try:
        await db.flush()
    except IntegrityError:
        # Defensa extra ante condición de carrera (dos requests con el mismo
        # slug pasando el chequeo de arriba a la vez) — nunca debería
        # llegar aquí en el flujo normal, pero un 500 crudo de Postgres es
        # peor que un 409 claro.
        await db.rollback()
        raise HTTPException(status_code=409, detail="URL ya en uso, elige otro nombre")

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

    import asyncio
    from app.services.notifications import emit_event
    asyncio.ensure_future(emit_event(str(store.id), "store_created", store_name=store.name))

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
        .options(
            selectinload(Store.settings),
            selectinload(Store.categories),
            selectinload(Store.plan),
            selectinload(Store.banners),
        )
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
        "banner_link": store.banner_link,
        "banners": [
            {"image_url": b.image_url, "link_url": b.link_url}
            for b in store.banners
        ],
        "whatsapp": store.whatsapp,
        "instagram": store.instagram,
        "tiktok": store.tiktok,
        "facebook": store.facebook,
        "mall_category": store.mall_category,
        "status": store.status,
        "primary_color": store.primary_color,
        "theme": store.theme,
        "city": store.city,
        "country": store.country,
        "meta_title": store.meta_title,
        "meta_desc": store.meta_desc,
        "store_url": f"https://qtienda.shop/tienda/{store.slug}",
        "plan_slug": store.plan.slug if store.plan else "free",
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
            "accept_card": store.settings.accept_card,
            "require_prepayment": store.settings.require_prepayment,
            "yape_phone": store.settings.yape_phone,
            "plin_phone": store.settings.plin_phone,
            "yape_qr_url": store.settings.yape_qr_url,
            "plin_qr_url": store.settings.plin_qr_url,
            "bank_account": store.settings.bank_account,
            "min_order_cents": store.settings.min_order_cents,
            "delivery_fee_cents": store.settings.delivery_fee_cents,
            "free_delivery_above": store.settings.free_delivery_above,
            "welcome_discount_enabled": store.settings.welcome_discount_enabled,
            "welcome_discount_cents": store.settings.welcome_discount_cents,
            "delivery_zones": store.settings.delivery_zones,
            "store_hours": store.settings.store_hours,
            "tiktok_pixel_id": store.settings.tiktok_pixel_id,
            "meta_pixel_id": store.settings.meta_pixel_id,
            "google_analytics_id": store.settings.google_analytics_id,
        } if store.settings else None,
        "created_at": store.created_at,
    }


@router.get("/me/analytics")
async def my_store_analytics(
    days: int = 30,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """Metricas de uso de la tienda del vendedor (ultimos N dias, max 90)."""
    result = await db.execute(
        select(Store.id).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store_id = result.scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="No tienes tienda aún")

    days = max(1, min(days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = [StoreEvent.store_id == store_id, StoreEvent.created_at >= since]

    # Totales por evento
    ev_q = await db.execute(
        select(StoreEvent.event, func.count())
        .where(*base)
        .group_by(StoreEvent.event)
    )
    totals = dict(ev_q.all())

    # Visitantes unicos (sesiones distintas con store_view)
    uniq_q = await db.execute(
        select(func.count(func.distinct(StoreEvent.session_id)))
        .where(*base, StoreEvent.event == "store_view", StoreEvent.session_id.isnot(None))
    )
    unique_visitors = uniq_q.scalar() or 0

    # Dispositivos
    dev_q = await db.execute(
        select(StoreEvent.device, func.count())
        .where(*base, StoreEvent.event == "store_view", StoreEvent.device.isnot(None))
        .group_by(StoreEvent.device)
    )
    devices = dict(dev_q.all())

    # Productos mas vistos
    top_q = await db.execute(
        select(Product.name, func.count().label("views"))
        .join(StoreEvent, StoreEvent.product_id == Product.id)
        .where(*base, StoreEvent.event == "product_view")
        .group_by(Product.id, Product.name)
        .order_by(func.count().desc())
        .limit(5)
    )
    top_products = [{"name": name, "views": views} for name, views in top_q.all()]

    return {
        "days": days,
        "store_views": totals.get("store_view", 0),
        "unique_visitors": unique_visitors,
        "product_views": totals.get("product_view", 0),
        "add_to_cart": totals.get("add_to_cart", 0),
        "checkout_start": totals.get("checkout_start", 0),
        "orders_created": totals.get("order_created", 0),
        "devices": devices,
        "top_products": top_products,
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


@router.post("/me/mark-shared")
async def mark_store_shared(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """Marca que el vendedor ya compartió el link de su tienda (checklist de onboarding)."""
    result = await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    if store.shared_at is None:
        from datetime import datetime, timezone
        store.shared_at = datetime.now(timezone.utc)
        await db.commit()

    return {"shared_at": store.shared_at}


@router.put("/me/banners")
async def update_banners(
    payload: BannersUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """Reemplaza los banners de la tienda. Limite por plan: free 1, pro/elite 3."""
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.plan), selectinload(Store.banners))
        .where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    plan_slug = store.plan.slug if store.plan else "free"
    max_banners = 1 if plan_slug == "free" else 3
    if len(payload.banners) > max_banners:
        raise HTTPException(
            status_code=403,
            detail=f"Tu plan permite hasta {max_banners} banner{'s' if max_banners > 1 else ''}. Mejora a Pro para usar hasta 3.",
        )

    store.banners.clear()
    for i, b in enumerate(payload.banners):
        store.banners.append(StoreBanner(image_url=b.image_url, link_url=b.link_url, sort_order=i))

    # Compatibilidad: la app movil y las imagenes OG usan stores.banner_url
    store.banner_url = payload.banners[0].image_url if payload.banners else None
    store.banner_link = payload.banners[0].link_url if payload.banners else None

    await db.commit()
    return {"updated": True, "count": len(payload.banners)}


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
