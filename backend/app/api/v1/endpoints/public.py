"""
Public endpoints — accessed by buyers via /tienda/{slug}
No authentication required.
"""
import re
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, func, select, and_, or_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import Plan, Store, Product, Category, Order, OrderItem, Payment, Review, StoreSettings, StoreEvent, SiteEvent, Subscription, MallBanner
from app.schemas.orders import PublicOrderCreate, OrderResponse
from app.core.limiter import limiter
from app.core.config import settings as app_settings


async def _trust_data_for_stores(db: AsyncSession, stores: list) -> dict:
    """Insignia 'verificada' y rating promedio — 100% calculados en vivo sobre
    datos reales (pedidos entregados/cancelados, reseñas), nunca vetting
    manual ni datos inventados. Devuelve {store_id: {is_verified, rating_avg, rating_count}}."""
    store_ids = [s.id for s in stores]
    if not store_ids:
        return {}

    order_rows = await db.execute(
        select(
            Order.store_id,
            func.sum(case((Order.status == "delivered", 1), else_=0)).label("delivered"),
            func.sum(case((Order.status == "cancelled", 1), else_=0)).label("cancelled"),
        )
        .where(Order.store_id.in_(store_ids))
        .group_by(Order.store_id)
    )
    order_map = {r.store_id: (int(r.delivered), int(r.cancelled)) for r in order_rows.all()}

    review_rows = await db.execute(
        select(Review.store_id, func.avg(Review.rating), func.count())
        .where(Review.store_id.in_(store_ids), Review.hidden_at.is_(None))
        .group_by(Review.store_id)
    )
    review_map = {r[0]: (float(r[1]), int(r[2])) for r in review_rows.all()}

    now = datetime.now(timezone.utc)
    out = {}
    for s in stores:
        delivered, cancelled = order_map.get(s.id, (0, 0))
        sample = delivered + cancelled
        age_days = (now - s.created_at).days if s.created_at else 0
        cancel_rate = (cancelled / sample) if sample >= app_settings.STORE_VERIFIED_MIN_SAMPLE else 0
        is_verified = (
            age_days >= app_settings.STORE_VERIFIED_MIN_AGE_DAYS
            and delivered >= app_settings.STORE_VERIFIED_MIN_DELIVERED
            and (sample < app_settings.STORE_VERIFIED_MIN_SAMPLE or cancel_rate <= app_settings.STORE_VERIFIED_MAX_CANCEL_RATE)
        )
        rating_avg, rating_count = review_map.get(s.id, (None, 0))
        out[s.id] = {
            "is_verified": is_verified,
            "rating_avg": round(rating_avg, 1) if rating_avg else None,
            "rating_count": rating_count,
        }
    return out

router = APIRouter()

# Debajo de esta cantidad de reseñas, un promedio no es representativo —
# se prefiere ocultarlo en vez de mostrar un número que una sola reseña
# mala/buena puede inflar o hundir.
PLATFORM_STATS_MIN_RATING_COUNT = 5


@router.get("/platform-stats")
@limiter.limit("60/minute")
async def platform_stats(request: Request, db: AsyncSession = Depends(get_db)):
    """Números reales agregados de toda la plataforma — usados como prueba
    social en la landing. Nunca inventados: cada campo sale de una cuenta
    real y se omite si no hay suficiente muestra para ser representativo."""
    stores_count = (
        await db.execute(
            select(func.count()).select_from(Store).where(Store.status == "active", Store.deleted_at.is_(None))
        )
    ).scalar() or 0

    delivered_count = (
        await db.execute(
            select(func.count())
            .select_from(Order)
            .join(Store, Store.id == Order.store_id)
            .where(Order.status == "delivered", Store.deleted_at.is_(None))
        )
    ).scalar() or 0

    rating_avg, rating_count = (
        await db.execute(
            select(func.avg(Review.rating), func.count())
            .select_from(Review)
            .join(Store, Store.id == Review.store_id)
            .where(Review.hidden_at.is_(None), Store.deleted_at.is_(None))
        )
    ).one()
    rating_count = rating_count or 0

    return {
        "stores_count": stores_count,
        "delivered_count": delivered_count,
        "rating_avg": round(float(rating_avg), 1) if rating_count >= PLATFORM_STATS_MIN_RATING_COUNT else None,
        "rating_count": rating_count if rating_count >= PLATFORM_STATS_MIN_RATING_COUNT else 0,
    }


@router.get("/mall-banners")
@limiter.limit("60/minute")
async def mall_banners(request: Request, db: AsyncSession = Depends(get_db)):
    """Banners rotatorios del Mall (/tiendas), administrados desde /admin."""
    result = await db.execute(select(MallBanner).order_by(MallBanner.sort_order))
    return [
        {"id": b.id, "image_url": b.image_url, "link_url": b.link_url}
        for b in result.scalars().all()
    ]


@router.get("/stores")
@limiter.limit("60/minute")
async def list_stores(
    request: Request,
    page: int = 1,
    limit: int = 24,
    category: Optional[str] = None,
    mall_category: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = "recent",
    db: AsyncSession = Depends(get_db),
):
    """Public store directory — paginado en el servidor, no limitado a un
    puñado de tiendas: con miles de tiendas el listado debe seguir siendo
    completo y filtrable (no solo lo que trajo la página 1)."""
    page = max(1, page)
    limit = max(1, min(limit, 60))

    filters = [Store.status == "active", Store.deleted_at.is_(None)]
    if city:
        filters.append(Store.city == city)
    if mall_category:
        filters.append(Store.mall_category == mall_category)
    if q:
        like = f"%{q}%"
        filters.append(or_(Store.name.ilike(like), Store.description.ilike(like), Store.city.ilike(like)))
    if category:
        cat_subq = (
            select(Category.store_id)
            .join(Product, Product.category_id == Category.id)
            .where(
                func.lower(Category.name) == category.lower(),
                Product.status == "active",
                Product.deleted_at.is_(None),
            )
            .distinct()
        )
        filters.append(Store.id.in_(cat_subq))

    total = (
        await db.execute(select(func.count()).select_from(Store).where(and_(*filters)))
    ).scalar()

    order_by = Store.name.asc() if sort == "az" else Store.created_at.desc()
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.settings))
        .where(and_(*filters))
        .order_by(order_by)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    stores = result.scalars().all()
    store_ids = [s.id for s in stores]
    trust_map = await _trust_data_for_stores(db, stores)

    # Productos activos por tienda — dato real del catálogo, no inventado
    count_map: dict = {}
    if store_ids:
        counts = await db.execute(
            select(Product.store_id, func.count())
            .where(
                Product.store_id.in_(store_ids),
                Product.status == "active",
                Product.deleted_at.is_(None),
            )
            .group_by(Product.store_id)
        )
        count_map = dict(counts.all())

    # Categorías reales con más productos activos por tienda — usadas como
    # "qué vende" cuando la tienda no escribió una descripción, y para
    # agrupar/filtrar tiendas como secciones de un centro comercial.
    categories_map: dict = {}
    if store_ids:
        cat_rows = await db.execute(
            select(Category.store_id, Category.name, func.count(Product.id).label("n"))
            .join(Product, Product.category_id == Category.id)
            .where(
                Category.store_id.in_(store_ids),
                Product.status == "active",
                Product.deleted_at.is_(None),
            )
            .group_by(Category.store_id, Category.name)
            .order_by(Category.store_id, func.count(Product.id).desc())
        )
        for store_id, name, _n in cat_rows.all():
            categories_map.setdefault(store_id, [])
            if len(categories_map[store_id]) < 3:
                categories_map[store_id].append(name)

    # Última modificación real (tienda o su catálogo) — usada como
    # lastModified del sitemap. Nunca "ahora": eso le miente a Google sobre
    # qué cambió de verdad y le hace perder confianza en la señal.
    product_updated_map: dict = {}
    if store_ids:
        prod_updated_rows = await db.execute(
            select(Product.store_id, func.max(Product.updated_at))
            .where(Product.store_id.in_(store_ids), Product.deleted_at.is_(None))
            .group_by(Product.store_id)
        )
        product_updated_map = dict(prod_updated_rows.all())

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit) if total else 0,
        "items": [
            {
                "slug": s.slug,
                "name": s.name,
                "description": s.description,
                "logo_url": s.logo_url,
                "banner_url": s.banner_url,
                "city": s.city,
                "country": s.country,
                "primary_color": s.primary_color,
                "product_count": count_map.get(s.id, 0),
                "categories": categories_map.get(s.id, []),
                "mall_category": s.mall_category,
                "store_hours": s.settings.store_hours if s.settings else None,
                "updated_at": max(filter(None, [s.updated_at, product_updated_map.get(s.id)])),
                "is_verified": trust_map.get(s.id, {}).get("is_verified", False),
                "rating_avg": trust_map.get(s.id, {}).get("rating_avg"),
                "rating_count": trust_map.get(s.id, {}).get("rating_count", 0),
            }
            for s in stores
        ],
    }


@router.get("/categories")
@limiter.limit("60/minute")
async def public_categories(request: Request, db: AsyncSession = Depends(get_db)):
    """Categorías reales agregadas sobre TODO el catálogo activo de TODAS las
    tiendas (no solo la página de resultados actual) — alimenta la grilla de
    navegación del Mall, pensada para escalar a miles de productos."""
    rows = await db.execute(
        select(Category.name, Category.icon, func.count(Product.id).label("n"))
        .join(Product, Product.category_id == Category.id)
        .join(Store, Store.id == Category.store_id)
        .where(
            Product.status == "active",
            Product.deleted_at.is_(None),
            Store.status == "active",
            Store.deleted_at.is_(None),
        )
        .group_by(Category.name, Category.icon)
        .order_by(func.count(Product.id).desc())
    )

    agg: dict = {}
    for name, icon, n in rows.all():
        key = name.strip().lower()
        cur = agg.setdefault(key, {"name": name, "icon": None, "count": 0})
        cur["count"] += n
        if icon and not cur["icon"]:
            cur["icon"] = icon

    merged = sorted(agg.values(), key=lambda c: c["count"], reverse=True)[:24]
    return [{"name": c["name"], "icon": c["icon"], "product_count": c["count"]} for c in merged]


@router.get("/mall-categories")
@limiter.limit("60/minute")
async def public_mall_categories(request: Request, db: AsyncSession = Depends(get_db)):
    """Los 7 departamentos fijos del Mall, con la cantidad real de tiendas
    activas en cada uno — nunca inventado, y siempre se listan los 7 aunque
    alguno tenga 0 tiendas todavía (es la taxonomía completa, no derivada)."""
    from app.core.mall_categories import MALL_CATEGORIES

    rows = await db.execute(
        select(Store.mall_category, func.count())
        .where(
            Store.status == "active",
            Store.deleted_at.is_(None),
            Store.mall_category.is_not(None),
        )
        .group_by(Store.mall_category)
    )
    count_map = dict(rows.all())

    return [
        {"slug": c["slug"], "label": c["label"], "icon": c["icon"], "store_count": count_map.get(c["slug"], 0)}
        for c in MALL_CATEGORIES
    ]


@router.get("/store-cities")
@limiter.limit("60/minute")
async def public_store_cities(request: Request, db: AsyncSession = Depends(get_db)):
    """Ciudades reales de tiendas activas — no limitadas a una sola página
    del listado, para que el filtro de ciudad sea correcto a cualquier escala."""
    rows = await db.execute(
        select(Store.city, func.count())
        .where(Store.status == "active", Store.deleted_at.is_(None), Store.city.is_not(None))
        .group_by(Store.city)
        .order_by(func.count().desc())
    )
    return [{"city": c, "count": n} for c, n in rows.all() if c]


@router.get("/latest-products")
@limiter.limit("60/minute")
async def latest_products(
    request: Request,
    category: str = None,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
):
    """Últimos productos publicados en tiendas activas — franja 'Recién publicado' del mall,
    o el catálogo del mall filtrado por rubro cuando se pasa `category`."""
    limit = max(1, min(limit, 60))

    filters = [
        Product.status == "active",
        Product.deleted_at.is_(None),
        Store.status == "active",
        Store.deleted_at.is_(None),
    ]
    query = select(Product, Store).join(Store, Store.id == Product.store_id).options(selectinload(Product.images))
    if category:
        query = query.join(Category, Category.id == Product.category_id).where(func.lower(Category.name) == category.lower())
    result = await db.execute(query.where(and_(*filters)).order_by(Product.created_at.desc()).limit(200))
    rows = result.all()

    # Diversifica por tienda para que ninguna acapare la vitrina del mall —
    # máximo 2 productos seguidos por tienda antes de completar con el resto.
    PER_STORE_CAP = 2
    picked: list = []
    leftover: list = []
    counts: dict = {}
    for p, s in rows:
        if counts.get(s.id, 0) < PER_STORE_CAP:
            picked.append((p, s))
            counts[s.id] = counts.get(s.id, 0) + 1
        else:
            leftover.append((p, s))
        if len(picked) >= limit:
            break
    if len(picked) < limit:
        picked.extend(leftover[: limit - len(picked)])

    return [
        {
            "id": p.id,
            "name": p.name,
            "price_cents": p.price_cents,
            "image_url": next((img.url for img in p.images if img.is_primary), p.images[0].url if p.images else None),
            "store_slug": s.slug,
            "store_name": s.name,
            "store_city": s.city,
            "store_logo_url": s.logo_url,
            "primary_color": s.primary_color,
        }
        for p, s in picked
    ]


@router.get("/store/{slug}")
@limiter.limit("60/minute")
async def get_store(request: Request, slug: str, db: AsyncSession = Depends(get_db)):
    """Load store page data for buyers."""
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.settings), selectinload(Store.categories), selectinload(Store.banners))
        .where(
            Store.slug == slug,
            Store.status == "active",
            Store.deleted_at.is_(None),
        )
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    # Señal de confianza real (nunca inventada) — pedidos entregados, no
    # "pedidos totales" para no inflar con cancelados/pendientes.
    delivered_count = (
        await db.execute(
            select(func.count()).select_from(Order).where(
                Order.store_id == store.id, Order.status == "delivered"
            )
        )
    ).scalar()

    trust = (await _trust_data_for_stores(db, [store])).get(store.id, {})

    return {
        "id": store.id,
        "slug": store.slug,
        "name": store.name,
        "description": store.description,
        "logo_url": store.logo_url,
        "banner_url": store.banner_url,
        "banner_link": store.banner_link,
        "member_since": store.created_at,
        "orders_delivered_count": delivered_count,
        "is_verified": trust.get("is_verified", False),
        "rating_avg": trust.get("rating_avg"),
        "rating_count": trust.get("rating_count", 0),
        "banners": [
            {"url": b.image_url, "link": b.link_url}
            for b in store.banners
        ],
        "store_hours": store.settings.store_hours if store.settings else None,
        "whatsapp": store.whatsapp,
        "instagram": store.instagram,
        "tiktok": store.tiktok,
        "facebook": store.facebook,
        "mall_category": store.mall_category,
        "primary_color": store.primary_color,
        "theme": store.theme,
        "city": store.city,
        "country": store.country,
        "categories": [
            {"id": c.id, "name": c.name, "slug": c.slug, "icon": c.icon}
            for c in sorted(store.categories, key=lambda x: x.sort_order)
        ],
        "settings": {
            "accept_cash": store.settings.accept_cash if store.settings else True,
            "accept_yape": store.settings.accept_yape if store.settings else False,
            "accept_plin": store.settings.accept_plin if store.settings else False,
            "accept_transfer": store.settings.accept_transfer if store.settings else False,
            "accept_card": store.settings.accept_card if store.settings else False,
            "require_prepayment": store.settings.require_prepayment if store.settings else False,
            "yape_phone": store.settings.yape_phone if store.settings else None,
            "plin_phone": store.settings.plin_phone if store.settings else None,
            "yape_qr_url": store.settings.yape_qr_url if store.settings else None,
            "plin_qr_url": store.settings.plin_qr_url if store.settings else None,
            "bank_account": store.settings.bank_account if store.settings else None,
            "delivery_fee_cents": store.settings.delivery_fee_cents if store.settings else 0,
            "min_order_cents": store.settings.min_order_cents if store.settings else 0,
            "free_delivery_above": store.settings.free_delivery_above if store.settings else None,
            "welcome_discount_enabled": store.settings.welcome_discount_enabled if store.settings else False,
            "welcome_discount_cents": store.settings.welcome_discount_cents if store.settings else 0,
            "delivery_zones": store.settings.delivery_zones if store.settings else [],
            "tiktok_pixel_id": store.settings.tiktok_pixel_id if store.settings else None,
            "meta_pixel_id": store.settings.meta_pixel_id if store.settings else None,
            "google_analytics_id": store.settings.google_analytics_id if store.settings else None,
        } if store.settings else {},
        "meta_title": store.meta_title or store.name,
        "meta_desc": store.meta_desc,
    }


def _mask_buyer_name(name: str) -> str:
    """Nombre + inicial de apellido — reseña se siente real sin exponer el nombre completo."""
    parts = (name or "").strip().split()
    if not parts:
        return "Comprador"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


@router.get("/store/{slug}/reviews")
@limiter.limit("60/minute")
async def get_store_reviews(request: Request, slug: str, limit: int = 20, db: AsyncSession = Depends(get_db)):
    """Reseñas reales más recientes de la tienda."""
    limit = max(1, min(limit, 50))
    store_id = (await db.execute(
        select(Store.id).where(Store.slug == slug, Store.status == "active", Store.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    rows = await db.execute(
        select(Review, Order.buyer_name)
        .join(Order, Order.id == Review.order_id)
        .where(Review.store_id == store_id, Review.hidden_at.is_(None))
        .order_by(Review.created_at.desc())
        .limit(limit)
    )

    return [
        {
            "rating": review.rating,
            "comment": review.comment,
            "buyer_name": _mask_buyer_name(buyer_name),
            "created_at": review.created_at,
        }
        for review, buyer_name in rows.all()
    ]


@router.get("/store/{slug}/products")
@limiter.limit("60/minute")
async def get_store_products(
    request: Request,
    slug: str,
    category: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Get active products for a store, optionally filtered by category slug."""
    store_q = await db.execute(
        select(Store.id).where(
            Store.slug == slug,
            Store.status == "active",
            Store.deleted_at.is_(None),
        )
    )
    store_id = store_q.scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    filters = [
        Product.store_id == store_id,
        Product.status == "active",
        Product.deleted_at.is_(None),
    ]
    if category:
        from app.models.models import Category
        cat_q = await db.execute(
            select(Category.id).where(
                Category.store_id == store_id,
                Category.slug == category,
            )
        )
        cat_id = cat_q.scalar_one_or_none()
        if cat_id:
            filters.append(Product.category_id == cat_id)

    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(and_(*filters))
        .order_by(Product.is_featured.desc(), Product.sort_order)
    )
    products = result.scalars().all()

    # Unidades vendidas por producto (pedidos no cancelados) para prueba social
    sold_q = await db.execute(
        select(OrderItem.product_id, func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.store_id == store_id,
            Order.status != "cancelled",
            OrderItem.product_id.isnot(None),
        )
        .group_by(OrderItem.product_id)
    )
    sold_map = dict(sold_q.all())

    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "price_cents": p.price_cents,
            "compare_price": p.compare_price,
            "sale_ends_at": p.sale_ends_at,
            "stock": p.stock,
            "is_featured": p.is_featured,
            "category_id": p.category_id,
            "sold_count": sold_map.get(p.id, 0),
            "created_at": p.created_at,
            "images": [
                {"url": img.url, "is_primary": img.is_primary}
                for img in p.images
            ],
        }
        for p in products
    ]


_CURRENCY_BY_COUNTRY = {
    "PE": "PEN", "CL": "CLP", "CO": "COP", "MX": "MXN", "AR": "ARS",
}


def _strip_html_basic(html: str) -> str:
    """Limpieza simple para el feed — no necesita ser perfecta, solo texto
    legible sin tags para el catálogo de anuncios."""
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


@router.get("/store/{slug}/catalog.xml")
@limiter.limit("30/minute")
async def store_catalog_feed(request: Request, slug: str, db: AsyncSession = Depends(get_db)):
    """Feed de catálogo de productos en formato RSS 2.0 + namespace de Google
    (el mismo que usan Shopify/WooCommerce) — el vendedor lo sube a TikTok
    Ads Manager (Catalog Manager) para correr anuncios de shopping con sus
    productos reales. Un feed por tienda: cada vendedor tiene su propia
    cuenta de anuncios, no tiene sentido un catálogo combinado."""
    import xml.etree.ElementTree as ET

    store_q = await db.execute(
        select(Store).where(
            Store.slug == slug, Store.status == "active", Store.deleted_at.is_(None)
        )
    )
    store = store_q.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.store_id == store.id,
            Product.status == "active",
            Product.deleted_at.is_(None),
        )
        .order_by(Product.sort_order)
    )
    products = result.scalars().all()
    currency = _CURRENCY_BY_COUNTRY.get(store.country or "PE", "PEN")

    G_NS = "http://base.google.com/ns/1.0"
    ET.register_namespace("g", G_NS)

    rss = ET.Element("rss", attrib={"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = store.name
    ET.SubElement(channel, "link").text = f"https://qtienda.shop/tienda/{store.slug}"
    ET.SubElement(channel, "description").text = f"Catálogo de productos de {store.name}"

    for p in products:
        images = sorted(p.images, key=lambda i: (not i.is_primary, i.sort_order))
        if not images:
            continue  # TikTok requiere imagen — un producto sin foto no sirve en el feed

        item = ET.SubElement(channel, "item")
        ET.SubElement(item, f"{{{G_NS}}}id").text = str(p.id)
        ET.SubElement(item, "title").text = p.name
        ET.SubElement(item, "description").text = _strip_html_basic(p.description)[:5000] or p.name
        ET.SubElement(item, "link").text = f"https://qtienda.shop/tienda/{store.slug}?p={p.id}"
        ET.SubElement(item, f"{{{G_NS}}}image_link").text = images[0].url
        for img in images[1:11]:
            ET.SubElement(item, f"{{{G_NS}}}additional_image_link").text = img.url

        in_stock = p.stock is None or p.stock > 0
        ET.SubElement(item, f"{{{G_NS}}}availability").text = "in stock" if in_stock else "out of stock"
        ET.SubElement(item, f"{{{G_NS}}}condition").text = "new"
        ET.SubElement(item, f"{{{G_NS}}}brand").text = store.name

        if p.compare_price and p.compare_price > p.price_cents:
            ET.SubElement(item, f"{{{G_NS}}}price").text = f"{p.compare_price / 100:.2f} {currency}"
            ET.SubElement(item, f"{{{G_NS}}}sale_price").text = f"{p.price_cents / 100:.2f} {currency}"
        else:
            ET.SubElement(item, f"{{{G_NS}}}price").text = f"{p.price_cents / 100:.2f} {currency}"

    xml_bytes = ET.tostring(rss, encoding="utf-8", xml_declaration=True)
    return Response(content=xml_bytes, media_type="application/xml")


@router.get("/store/{slug}/buyer-first-order")
@limiter.limit("20/minute")
async def check_first_order(
    request: Request,
    slug: str,
    phone: str,
    db: AsyncSession = Depends(get_db),
):
    """
    ¿Es la primera compra de este teléfono en esta tienda? Usado en el
    checkout para mostrar (con honestidad) si el descuento de bienvenida
    se va a aplicar, antes de confirmar el pedido. La validación real y
    autoritativa vuelve a ocurrir en create_order — este endpoint es solo
    para la vista previa, nunca la fuente de verdad del descuento.
    """
    store_q = await db.execute(select(Store.id).where(Store.slug == slug))
    store_id = store_q.scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    cleaned_phone = re.sub(r"\D", "", phone)
    if len(cleaned_phone) < 7:
        return {"is_first_order": False}

    count_q = await db.execute(
        select(func.count()).select_from(Order).where(
            Order.store_id == store_id,
            Order.buyer_phone == cleaned_phone,
        )
    )
    is_first = (count_q.scalar() or 0) == 0
    return {"is_first_order": is_first}


@router.post("/store/{slug}/orders", status_code=201)
@limiter.limit("8/minute")
async def create_order(
    slug: str,
    payload: PublicOrderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Create order — no login required.
    This is the core buyer checkout flow. Must be fast.
    """
    # Load store
    store_q = await db.execute(
        select(Store)
        .options(
            selectinload(Store.settings),
            selectinload(Store.user),       # ← AGREGAR
        )
        .where(Store.slug == slug, Store.deleted_at.is_(None))
    )

    store = store_q.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    if store.status != "active":
        raise HTTPException(status_code=403, detail="Esta tienda no está disponible en este momento")

    # El schema valida el documento de forma genérica (multi-país);
    # para tiendas peruanas el DNI debe ser exactamente 8 dígitos.
    if store.country == "PE" and payload.buyer_dni and not re.fullmatch(r"\d{8}", payload.buyer_dni):
        raise HTTPException(status_code=422, detail="El DNI debe tener 8 dígitos")

    # Plan limit: max orders per month
    await _check_order_limit(store, db)

    # Load & validate products
    product_ids = [item.product_id for item in payload.items]
    prod_q = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.id.in_(product_ids),
            Product.store_id == store.id,
            Product.status == "active",
            Product.deleted_at.is_(None),
        )
        .with_for_update()
    )
    products_map = {p.id: p for p in prod_q.scalars().all()}

    if len(products_map) != len(set(product_ids)):
        raise HTTPException(status_code=422, detail="Producto no disponible")

    # Build order items + subtotal
    order_items = []
    subtotal = 0
    for item in payload.items:
        product = products_map[item.product_id]
        if product.stock is not None and product.stock < item.quantity:
            raise HTTPException(
                status_code=422,
                detail=f"Stock insuficiente para '{product.name}'",
            )
        line = item.quantity * product.price_cents
        subtotal += line
        order_items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                product_sku=product.sku,
                unit_price=product.price_cents,
                quantity=item.quantity,
                subtotal=line,
                image_url=next(
                    (img.url for img in product.images if img.is_primary),
                    product.images[0].url if product.images else None,
                ),
            )
        )

    settings = store.settings
    delivery_cents = settings.delivery_fee_cents if settings else 0
    if settings and settings.free_delivery_above and subtotal >= settings.free_delivery_above:
        delivery_cents = 0

    total = subtotal + delivery_cents

    # Min order check — validate against total (subtotal + delivery) ANTES del
    # descuento de bienvenida: el mínimo aplica siempre, el descuento no lo esquiva.
    if settings and settings.min_order_cents and total < settings.min_order_cents:
        raise HTTPException(
            status_code=422,
            detail=f"Monto mínimo S/ {settings.min_order_cents / 100:.2f}",
        )

    # Descuento de bienvenida: auto-aplicado si es el primer pedido de este
    # teléfono en esta tienda. La autoridad es siempre el backend — nunca se
    # confía en nada que el cliente haya calculado o enviado.
    discount_cents = 0
    if settings and settings.welcome_discount_enabled and settings.welcome_discount_cents > 0:
        prior_q = await db.execute(
            select(func.count()).select_from(Order).where(
                Order.store_id == store.id,
                Order.buyer_phone == payload.buyer_phone,
            )
        )
        if (prior_q.scalar() or 0) == 0:
            discount_cents = min(settings.welcome_discount_cents, subtotal)
            total -= discount_cents

    # Validate payment method
    _method = (payload.payment_method or "cash").lower().strip()
    _allowed: list[str] = []
    if not settings or settings.accept_cash:     _allowed.append("cash")
    if settings and settings.accept_yape:        _allowed.append("yape")
    if settings and settings.accept_plin:        _allowed.append("plin")
    if settings and settings.accept_transfer:    _allowed.append("transfer")
    if settings and settings.accept_card:        _allowed.append("card")
    if _method not in _allowed:
        raise HTTPException(status_code=422, detail="Método de pago no disponible en esta tienda")

    # Generate order number
    from sqlalchemy import text
    num_result = await db.execute(
        text("SELECT generate_order_number(:store_id)"),
        {"store_id": str(store.id)},
    )
    order_number = num_result.scalar()

    order = Order(
        store_id=store.id,
        order_number=order_number,
        buyer_name=payload.buyer_name,
        buyer_phone=payload.buyer_phone,
        buyer_dni=payload.buyer_dni,
        buyer_email=payload.buyer_email,
        buyer_department=payload.buyer_department,
        buyer_province=payload.buyer_province,
        buyer_district=payload.buyer_district,
        buyer_address=payload.buyer_address,
        buyer_reference=payload.buyer_reference,
        subtotal_cents=subtotal,
        delivery_cents=delivery_cents,
        discount_cents=discount_cents,
        total_cents=total,
        payment_method=_method,
        notes=payload.notes,
        source=payload.source or "tiktok",
        utm_source=payload.utm_source,
        utm_campaign=payload.utm_campaign,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(order)
    await db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

        # Decrement stock
        if products_map[oi.product_id].stock is not None:
            products_map[oi.product_id].stock -= oi.quantity

    db.add(Payment(
        order_id=order.id,
        method=_method,
        status="pending",
        amount_cents=total,
    ))

    # Analytics: pedido creado (server-side, no depende del navegador)
    db.add(StoreEvent(store_id=store.id, event="order_created"))

    await db.commit()
    await db.refresh(order)

    # ── Push notification al vendedor (fire-and-forget) ──────
    if store.user and store.user.email:
        from app.services.push import send_push_to_vendor
        from app.services.push import notify_new_order_to_vendor
        import asyncio
        # WebPush para la PWA (ya existente)
        asyncio.ensure_future(
            send_push_to_vendor(
                vendor_email = store.user.email,
                order_number = order.order_number,
                buyer_name   = payload.buyer_name,
                total_cents  = order.total_cents,
            )
        )
        # Expo Push para la app móvil (nuevo)
        asyncio.ensure_future(
            notify_new_order_to_vendor(
                store_id     = str(store.id),
                order_number = order.order_number,
                buyer_name   = payload.buyer_name,
                total_cents  = order.total_cents,
                order_id     = str(order.id),
            )
        )

    # Hito "primer pedido" — dedupe lo resuelve emit_event, se puede llamar en cada pedido
    import asyncio
    from app.services.notifications import emit_event
    asyncio.ensure_future(emit_event(str(store.id), "first_order", order_number=order.order_number))

    # WhatsApp deep-link for vendor notification
    wa_link = None
    if store.whatsapp:
        items_text = "\n".join(
            f"  • {oi.quantity}x {oi.product_name} — S/ {oi.subtotal/100:.2f}"
            for oi in order_items
        )
        lines = [
            f"🛍️ *NUEVO PEDIDO #{order_number}*",
            "━━━━━━━━━━━━━━━━━━━━━━",
            f"👤 *Cliente:* {payload.buyer_name}",
            f"📱 *Cel:* +{payload.buyer_phone}",
        ]
        if payload.buyer_dni:
            lines.append(f"🪪 *DNI:* {payload.buyer_dni}")
        if payload.buyer_address:
            lines.append(f"📍 *Dirección:* {payload.buyer_address}")
        _ubigeo = " / ".join(
            p for p in [payload.buyer_district, payload.buyer_province, payload.buyer_department] if p
        )
        if _ubigeo:
            lines.append(f"🗺️ *Zona:* {_ubigeo}")
        if payload.buyer_reference:
            lines.append(f"🏠 *Ref:* {payload.buyer_reference}")
        if payload.notes:
            lines.append(f"📝 *Nota:* {payload.notes}")
        _method_label = {
            "cash": "💵 Efectivo (contra entrega)",
            "yape": "💜 Yape",
            "plin": "💚 Plin",
            "transfer": "🏦 Transferencia",
            "card": "💳 Tarjeta",
        }.get(_method, _method)
        lines += [
            f"💳 *Pago:* {_method_label}",
            "",
            "🛒 *Productos:*",
            items_text,
            "",
            f"💰 Subtotal: S/ {subtotal/100:.2f}",
        ]
        if delivery_cents > 0:
            lines.append(f"🚚 Delivery: S/ {delivery_cents/100:.2f}")
        if discount_cents > 0:
            lines.append(f"🎁 Descuento de bienvenida: -S/ {discount_cents/100:.2f}")
        lines += [
            f"💵 *TOTAL: S/ {total/100:.2f}*",
            "━━━━━━━━━━━━━━━━━━━━━━",
            "📋 Ver pedido: qtienda.shop/dashboard/pedidos",
        ]
        wa_link = f"https://wa.me/{store.whatsapp}?text={quote(chr(10).join(lines))}"

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "total_cents": order.total_cents,
        "subtotal_cents": order.subtotal_cents,
        "delivery_cents": order.delivery_cents,
        "discount_cents": order.discount_cents,
        "whatsapp_link": wa_link,
        "payment_methods": {
            "cash": settings.accept_cash if settings else True,
            "yape": settings.accept_yape if settings else False,
            "plin": settings.accept_plin if settings else False,
            "yape_phone": settings.yape_phone if settings else None,
            "plin_phone": settings.plin_phone if settings else None,
        },
    }


async def _check_order_limit(store: Store, db: AsyncSession) -> None:
    store_id = store.id
    sub = (await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.store_id == store_id,
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
            select(Plan).join(Store, Store.plan_id == Plan.id).where(Store.id == store_id)
        )).scalar_one_or_none()

    # max_orders_mo NULL o 0 = ilimitado
    if plan and plan.max_orders_mo:
        limit = plan.max_orders_mo
        if plan.slug == app_settings.FREE_PLAN_SLUG:
            from app.services.referrals import referral_bonus
            bonus = await referral_bonus(store.user_id, db)
            limit += bonus["extra_orders"]

        first_day = date.today().replace(day=1)
        count = (await db.execute(
            select(func.count()).select_from(Order).where(
                Order.store_id == store_id,
                Order.created_at >= first_day,
            )
        )).scalar()
        if count >= limit:
            raise HTTPException(
                status_code=503,
                detail="Esta tienda alcanzó su límite de pedidos del mes. Vuelve el próximo mes.",
            )


@router.get("/store/{slug}/orders/{order_number}/track")
@limiter.limit("30/minute")
async def track_order(request: Request, slug: str, order_number: str, db: AsyncSession = Depends(get_db)):
    """Buyer order tracking — public."""
    store_q = await db.execute(select(Store.id).where(Store.slug == slug))
    store_id = store_q.scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    order_q = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(
            Order.store_id == store_id,
            Order.order_number == order_number,
        )
    )
    order = order_q.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    return {
        "order_number": order.order_number,
        "status": order.status,
        "created_at": order.created_at,
        "total_cents": order.total_cents,
        "items": [
            {"name": i.product_name, "qty": i.quantity, "image_url": i.image_url}
            for i in order.items
        ],
    }


# ── Analytics de tienda (QT-008) ──────────────────────────────

ALLOWED_EVENTS = {"store_view", "product_view", "add_to_cart", "checkout_start", "product_favorite"}


@router.post("/store/{slug}/events", status_code=204)
@limiter.limit("120/minute")
async def track_event(
    request: Request,
    slug: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Registra un evento de uso del comprador. Best-effort: nunca rompe la tienda."""
    event = payload.get("event")
    if event not in ALLOWED_EVENTS:
        raise HTTPException(status_code=422, detail="Evento no valido")

    store_q = await db.execute(
        select(Store.id).where(
            Store.slug == slug,
            Store.status == "active",
            Store.deleted_at.is_(None),
        )
    )
    store_id = store_q.scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    product_id = payload.get("product_id")
    if product_id:
        # Validar que el producto pertenece a la tienda (evita basura en datos)
        prod_q = await db.execute(
            select(Product.id).where(Product.id == product_id, Product.store_id == store_id)
        )
        product_id = prod_q.scalar_one_or_none()

    device = payload.get("device")
    if device not in ("mobile", "tablet", "desktop"):
        device = None

    session_id = payload.get("session_id")
    if session_id is not None:
        session_id = str(session_id)[:64]

    db.add(StoreEvent(
        store_id=store_id,
        event=event,
        product_id=product_id,
        session_id=session_id,
        device=device,
    ))
    await db.commit()

    # Hitos de onboarding — el dedupe de "primera vez" lo resuelve el ON CONFLICT
    # del propio emit_event, así que llamar en cada evento es seguro y barato.
    if event == "store_view":
        import asyncio
        from app.services.notifications import emit_event
        asyncio.ensure_future(emit_event(str(store_id), "first_visit"))
    elif event == "product_favorite":
        import asyncio
        from app.services.notifications import emit_event
        asyncio.ensure_future(emit_event(str(store_id), "first_favorite"))


VIEWERS_WINDOW_MINUTES = 10


@router.get("/store/{slug}/products/{product_id}/viewers")
@limiter.limit("60/minute")
async def product_viewers(
    request: Request,
    slug: str,
    product_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Cuantas sesiones distintas vieron este producto en los ultimos minutos.
    Prueba social honesta: el frontend decide si el numero alcanza para mostrarse."""
    store_q = await db.execute(
        select(Store.id).where(
            Store.slug == slug,
            Store.status == "active",
            Store.deleted_at.is_(None),
        )
    )
    store_id = store_q.scalar_one_or_none()
    if not store_id:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    since = datetime.now(timezone.utc) - timedelta(minutes=VIEWERS_WINDOW_MINUTES)
    count = (
        await db.execute(
            select(func.count(func.distinct(StoreEvent.session_id))).where(
                StoreEvent.store_id == store_id,
                StoreEvent.product_id == product_id,
                StoreEvent.event == "product_view",
                StoreEvent.created_at >= since,
                StoreEvent.session_id.isnot(None),
            )
        )
    ).scalar()
    return {"count": count}


# ── Trafico del sitio (landing, /tiendas) — sin tienda asociada ──

ALLOWED_SITE_EVENTS = {"page_view"}


@router.post("/events", status_code=204)
@limiter.limit("120/minute")
async def track_site_event(
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Registra una visita a nivel dominio (landing, /tiendas). Best-effort: nunca rompe la pagina."""
    event = payload.get("event")
    if event not in ALLOWED_SITE_EVENTS:
        raise HTTPException(status_code=422, detail="Evento no valido")

    device = payload.get("device")
    if device not in ("mobile", "tablet", "desktop"):
        device = None

    session_id = payload.get("session_id")
    if session_id is not None:
        session_id = str(session_id)[:64]

    path = payload.get("path")
    if path is not None:
        path = str(path)[:200]

    referrer = payload.get("referrer")
    if referrer is not None:
        referrer = str(referrer)[:300]

    # Detras de nginx la IP real viene en X-Forwarded-For (mismo patron que el logging middleware)
    fwd = request.headers.get("x-forwarded-for")
    ip_address = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)

    db.add(SiteEvent(
        event=event,
        path=path,
        referrer=referrer,
        session_id=session_id,
        device=device,
        ip_address=ip_address,
    ))
    await db.commit()
