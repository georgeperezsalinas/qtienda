"""Vendor product management — authenticated, scoped to vendor's store."""
import re
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, and_, or_, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_vendor
from app.models.models import Category, Order, OrderItem, Plan, Product, ProductImage, ProductVariant, Store, Subscription
from app.schemas.auth import ProductCreate, ProductUpdate, ProductVariantIn, ProductVariantUpdate
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
        "variants": [
            {
                "id": v.id,
                "label": v.label,
                "sku": v.sku,
                "price_cents": v.price_cents,
                "stock": v.stock,
                "sort_order": v.sort_order,
            }
            for v in p.variants
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
        .options(selectinload(Product.images), selectinload(Product.variants))
        .where(and_(*filters))
        .order_by(Product.sort_order, Product.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    products = result.scalars().all()

    # Vendidos (histórico, no ligado a un período) — para poder ordenar por
    # "más vendido" en el dashboard sin una llamada aparte por producto.
    product_ids = [p.id for p in products]
    sold_map: dict = {}
    if product_ids:
        sold_rows = (await db.execute(
            select(OrderItem.product_id, func.sum(OrderItem.quantity))
            .join(Order, Order.id == OrderItem.order_id)
            .where(OrderItem.product_id.in_(product_ids), Order.status != "cancelled")
            .group_by(OrderItem.product_id)
        )).all()
        sold_map = {pid: int(qty) for pid, qty in sold_rows}

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [{**_serialize(p), "sold_count": sold_map.get(p.id, 0)} for p in products],
    }


async def _resolve_plan_and_limit(store: Store, db: AsyncSession) -> tuple[Optional[Plan], Optional[int]]:
    """Plan vigente de la tienda y su max_products (con el bono de
    referidos ya sumado si aplica). limit None = ilimitado."""
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
    if not plan or not plan.max_products:
        return plan, None

    limit = plan.max_products
    if plan.slug == settings.FREE_PLAN_SLUG:
        bonus = await referral_bonus(store.user_id, db)
        limit += bonus["extra_products"]
    return plan, limit


async def _check_product_limit(store: Store, db: AsyncSession) -> None:
    plan, limit = await _resolve_plan_and_limit(store, db)
    if limit is None:
        return

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
        select(Product).options(selectinload(Product.images), selectinload(Product.variants)).where(Product.id == product.id)
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
        .options(selectinload(Product.images), selectinload(Product.variants))
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
        .options(selectinload(Product.images), selectinload(Product.variants))
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
    # Tocar el stock a mano "reinicia" la alerta de stock bajo — si vuelve a
    # caer bajo el umbral más adelante, se puede volver a avisar.
    if "stock" in update_data and update_data["stock"] != product.stock:
        product.low_stock_notified_at = None

    new_status = update_data.get("status")
    if new_status is not None and new_status != product.status:
        if new_status == "active":
            _, limit = await _resolve_plan_and_limit(store, db)
            if limit is not None:
                active_elsewhere = (await db.execute(
                    select(func.count()).select_from(Product).where(
                        Product.store_id == store.id,
                        Product.deleted_at.is_(None),
                        Product.status == "active",
                        Product.id != product.id,
                    )
                )).scalar()
                if active_elsewhere + 1 > limit:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Tu plan permite máximo {limit} productos activos. Desactiva otro primero o sube de plan.",
                    )
        product.hidden_by_plan_at = None  # cambio manual, ya no es "oculto por plan"

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
        select(Product).options(selectinload(Product.images), selectinload(Product.variants)).where(Product.id == product.id)
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


@router.post("/{product_id}/duplicate", status_code=201)
async def duplicate_product(
    product_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    await _check_product_limit(store, db)

    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.variants))
        .where(
            Product.id == product_id,
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    slug = await _unique_slug(db, store.id, _slugify(f"{original.name}-copia"))

    # Nace en borrador — el vendedor decide cuándo publicar la copia
    # (ej. tras ajustar talla/color), igual que un producto nuevo.
    clone = Product(
        store_id=store.id,
        category_id=original.category_id,
        name=f"{original.name} (copia)",
        slug=slug,
        description=original.description,
        price_cents=original.price_cents,
        compare_price=original.compare_price,
        sale_ends_at=None,
        sku=None,
        stock=original.stock,
        is_featured=False,
        status="inactive",
    )
    db.add(clone)
    await db.flush()

    for img in original.images:
        db.add(ProductImage(
            product_id=clone.id,
            url=img.url,
            alt_text=img.alt_text,
            sort_order=img.sort_order,
            is_primary=img.is_primary,
        ))

    for v in original.variants:
        db.add(ProductVariant(
            product_id=clone.id,
            label=v.label,
            sku=None,  # mismo criterio que el sku a nivel producto: se resetea en la copia
            price_cents=v.price_cents,
            stock=v.stock,
            sort_order=v.sort_order,
        ))

    await db.commit()

    result2 = await db.execute(
        select(Product).options(selectinload(Product.images), selectinload(Product.variants)).where(Product.id == clone.id)
    )
    return _serialize(result2.scalar_one())


# Estas acciones operan solo a nivel producto — el stock/precio de las
# variantes (si el producto tiene) no se toca acá. Ajustar variantes en
# lote no está soportado en esta iteración; hacerlo fila por fila.
class BulkActionRequest(BaseModel):
    product_ids: list[UUID]
    action: Literal["activate", "deactivate", "delete", "discount_percent", "adjust_stock"]
    percent: Optional[int] = None
    stock_delta: Optional[int] = None


@router.post("/bulk-action")
async def bulk_action(
    payload: BulkActionRequest,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    if not payload.product_ids:
        raise HTTPException(status_code=422, detail="Selecciona al menos un producto")

    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Product).where(
            Product.id.in_(payload.product_ids),
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
        )
    )
    products = result.scalars().all()
    if not products:
        raise HTTPException(status_code=404, detail="Productos no encontrados")

    if payload.action == "activate":
        _, limit = await _resolve_plan_and_limit(store, db)
        if limit is not None:
            selected_ids = {p.id for p in products}
            active_elsewhere = (await db.execute(
                select(func.count()).select_from(Product).where(
                    Product.store_id == store.id,
                    Product.deleted_at.is_(None),
                    Product.status == "active",
                    Product.id.notin_(selected_ids),
                )
            )).scalar()
            if active_elsewhere + len(products) > limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Tu plan permite máximo {limit} productos activos. Desactiva otros primero o sube de plan.",
                )
        for p in products:
            p.status = "active"
            p.hidden_by_plan_at = None  # reactivación manual, ya no es "oculto por plan"
    elif payload.action == "deactivate":
        for p in products:
            p.status = "inactive"
            p.hidden_by_plan_at = None  # decisión del vendedor, no del sistema
    elif payload.action == "delete":
        now = datetime.now(timezone.utc)
        for p in products:
            p.deleted_at = now
            p.status = "inactive"
    elif payload.action == "discount_percent":
        if payload.percent is None or not (-90 <= payload.percent <= 90) or payload.percent == 0:
            raise HTTPException(status_code=422, detail="Porcentaje inválido (entre -90 y 90, distinto de 0)")
        for p in products:
            new_price = round(p.price_cents * (1 + payload.percent / 100))
            p.price_cents = max(new_price, 1)
    elif payload.action == "adjust_stock":
        if payload.stock_delta is None or payload.stock_delta == 0:
            raise HTTPException(status_code=422, detail="Indica cuánto sumar o restar (distinto de 0)")
        # Productos con stock ilimitado (None) no tienen nada que ajustar — se
        # saltan en silencio, no es un error (no todos los seleccionados
        # necesariamente llevan control de stock).
        for p in products:
            if p.stock is None:
                continue
            p.stock = max(0, p.stock + payload.stock_delta)
            if payload.stock_delta > 0:
                p.low_stock_notified_at = None

    await db.commit()
    return {"updated": len(products)}


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


async def _get_owned_product(product_id: UUID, store: Store, db: AsyncSession) -> Product:
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
    return product


def _serialize_variant(v: ProductVariant) -> dict:
    return {
        "id": v.id,
        "label": v.label,
        "sku": v.sku,
        "price_cents": v.price_cents,
        "stock": v.stock,
        "sort_order": v.sort_order,
    }


@router.get("/{product_id}/variants")
async def list_product_variants(
    product_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    await _get_owned_product(product_id, store, db)
    result = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id)
        .order_by(ProductVariant.sort_order)
    )
    return [_serialize_variant(v) for v in result.scalars().all()]


@router.post("/{product_id}/variants", status_code=201)
async def add_product_variant(
    product_id: UUID,
    payload: ProductVariantIn,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    await _get_owned_product(product_id, store, db)

    variant = ProductVariant(
        product_id=product_id,
        label=payload.label,
        sku=payload.sku,
        price_cents=payload.price_cents,
        stock=payload.stock,
        sort_order=payload.sort_order,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return _serialize_variant(variant)


@router.patch("/{product_id}/variants/{variant_id}")
async def update_product_variant(
    product_id: UUID,
    variant_id: UUID,
    payload: ProductVariantUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    await _get_owned_product(product_id, store, db)

    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
        )
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)

    await db.commit()
    await db.refresh(variant)
    return _serialize_variant(variant)


@router.delete("/{product_id}/variants/{variant_id}", status_code=204)
async def delete_product_variant(
    product_id: UUID,
    variant_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    await _get_owned_product(product_id, store, db)

    result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
        )
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    await db.delete(variant)
    await db.commit()
