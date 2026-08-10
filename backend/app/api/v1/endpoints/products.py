"""Vendor product management — authenticated, scoped to vendor's store."""
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, and_, or_, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_vendor
from app.models.models import Category, Plan, Product, ProductImage, Store, Subscription
from app.schemas.auth import ProductCreate, ProductUpdate
from app.services.referrals import referral_bonus

router = APIRouter()

_SLUG_RE = re.compile(r"[^a-z0-9\-]")


def _slugify(text: str) -> str:
    return _SLUG_RE.sub("", text.lower().replace(" ", "-"))[:200] or "producto"


def _serialize(p: Product) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "price_cents": p.price_cents,
        "compare_price": p.compare_price,
        "sale_ends_at": p.sale_ends_at,
        "sku": p.sku,
        "stock": p.stock,
        "status": p.status,
        "is_featured": p.is_featured,
        "sort_order": p.sort_order,
        "category_id": p.category_id,
        "images": [
            {
                "id": img.id,
                "url": img.url,
                "alt_text": img.alt_text,
                "is_primary": img.is_primary,
                "sort_order": img.sort_order,
            }
            for img in p.images
        ],
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


async def _unique_slug(db: AsyncSession, store_id, base: str) -> str:
    slug, counter = base, 1
    while True:
        existing = await db.execute(
            select(Product.id).where(
                Product.store_id == store_id,
                Product.slug == slug,
                Product.deleted_at.is_(None),
            )
        )
        if not existing.scalar_one_or_none():
            return slug
        slug = f"{base}-{counter}"
        counter += 1


@router.get("/")
async def list_products(
    status: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)

    filters = [Product.store_id == store.id, Product.deleted_at.is_(None)]
    if status:
        filters.append(Product.status == status)
    if category_id:
        filters.append(Product.category_id == category_id)

    total = (
        await db.execute(select(func.count()).select_from(Product).where(and_(*filters)))
    ).scalar()

    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(and_(*filters))
        .order_by(Product.sort_order, Product.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    products = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [_serialize(p) for p in products],
    }


async def _check_product_limit(store: Store, db: AsyncSession) -> None:
    sub = (await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.store_id == store.id,
            Subscription.status.in_(["active", "trial"]),
            or_(
                Subscription.ends_at.is_(None),
                Subscription.ends_at > datetime.now(timezone.utc),
            ),
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    plan = sub.plan if sub else None
    if plan is None:
        plan = (await db.execute(
            select(Plan).where(Plan.id == store.plan_id)
        )).scalar_one_or_none()

    # max_products NULL o 0 = ilimitado
    if plan and plan.max_products:
        limit = plan.max_products
        if plan.slug == settings.FREE_PLAN_SLUG:
            bonus = await referral_bonus(store.user_id, db)
            limit += bonus["extra_products"]

        count = (await db.execute(
            select(func.count()).select_from(Product).where(
                Product.store_id == store.id,
                Product.deleted_at.is_(None),
            )
        )).scalar()
        if count >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"Tu plan {plan.name} permite máximo {limit} productos. Actualiza tu plan o invita amigos con tu código de referido para subir tu límite.",
            )


@router.post("/", status_code=201)
async def create_product(
    payload: ProductCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    await _check_product_limit(store, db)

    if payload.category_id:
        cat = (
            await db.execute(
                select(Category.id).where(
                    Category.id == payload.category_id,
                    Category.store_id == store.id,
                )
            )
        ).scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Categoría no válida")

    slug = await _unique_slug(db, store.id, _slugify(payload.name))

    product = Product(
        store_id=store.id,
        category_id=payload.category_id,
        name=payload.name,
        slug=slug,
        description=payload.description,
        price_cents=payload.price_cents,
        compare_price=payload.compare_price,
        sale_ends_at=payload.sale_ends_at,
        sku=payload.sku,
        stock=payload.stock,
        is_featured=payload.is_featured,
        status=payload.status,
    )
    db.add(product)
    await db.flush()
    await db.commit()

    active_count = (await db.execute(
        select(func.count()).select_from(Product).where(
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )).scalar()
    if active_count in (1, 5):
        import asyncio
        from app.services.notifications import emit_event
        event_type = "first_product" if active_count == 1 else "products_5"
        asyncio.ensure_future(emit_event(str(store.id), event_type))

    result = await db.execute(
        select(Product).options(selectinload(Product.images)).where(Product.id == product.id)
    )
    return _serialize(result.scalar_one())


@router.get("/{product_id}")
async def get_product(
    product_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.id == product_id,
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _serialize(product)


@router.patch("/{product_id}")
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.id == product_id,
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if payload.category_id is not None:
        cat = (
            await db.execute(
                select(Category.id).where(
                    Category.id == payload.category_id,
                    Category.store_id == store.id,
                )
            )
        ).scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=422, detail="Categoría no válida")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    # Un countdown sin precio de oferta real no tiene sentido — se valida
    # sobre el estado final (no solo lo enviado) porque compare_price y
    # sale_ends_at pueden llegar en requests de PATCH separados.
    if product.sale_ends_at and not product.compare_price:
        raise HTTPException(
            status_code=422,
            detail="Para poner fecha de fin de oferta, define primero el precio antes del descuento",
        )

    await db.commit()

    result2 = await db.execute(
        select(Product).options(selectinload(Product.images)).where(Product.id == product.id)
    )
    return _serialize(result2.scalar_one())


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    product.deleted_at = datetime.now(timezone.utc)
    product.status = "inactive"
    await db.commit()


@router.post("/{product_id}/images", status_code=201)
async def add_product_image(
    product_id: UUID,
    body: dict,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    url = (body.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=422, detail="URL de imagen requerida")

    is_primary = bool(body.get("is_primary", False))
    if is_primary:
        await db.execute(
            sa_update(ProductImage)
            .where(ProductImage.product_id == product.id)
            .values(is_primary=False)
        )

    image = ProductImage(
        product_id=product.id,
        url=url,
        alt_text=body.get("alt_text"),
        sort_order=int(body.get("sort_order", 0)),
        is_primary=is_primary,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return {"id": image.id, "url": image.url, "is_primary": image.is_primary, "sort_order": image.sort_order}


@router.delete("/{product_id}/images/{image_id}", status_code=204)
async def delete_product_image(
    product_id: UUID,
    image_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(ProductImage)
        .join(Product)
        .where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            Product.store_id == store.id,
        )
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    await db.delete(image)
    await db.commit()
