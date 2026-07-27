"""
Public endpoints — accessed by buyers via /tienda/{slug}
No authentication required.
"""
import re
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_, or_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import Plan, Store, Product, Category, Order, OrderItem, Payment, StoreSettings, StoreEvent, SiteEvent, Subscription
from app.schemas.orders import PublicOrderCreate, OrderResponse
from app.core.limiter import limiter
from app.core.config import settings as app_settings

router = APIRouter()


@router.get("/stores")
@limiter.limit("60/minute")
async def list_stores(request: Request, db: AsyncSession = Depends(get_db)):
    """Public store directory — returns active stores for /tiendas y la landing."""
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.settings))
        .where(
            Store.status == "active",
            Store.deleted_at.is_(None),
        )
        .order_by(Store.created_at.desc())
        .limit(24)
    )
    stores = result.scalars().all()
    store_ids = [s.id for s in stores]

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

    return [
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
            "store_hours": s.settings.store_hours if s.settings else None,
        }
        for s in stores
    ]


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

    return {
        "id": store.id,
        "slug": store.slug,
        "name": store.name,
        "description": store.description,
        "logo_url": store.logo_url,
        "banner_url": store.banner_url,
        "banner_link": store.banner_link,
        "banners": [
            {"url": b.image_url, "link": b.link_url}
            for b in store.banners
        ],
        "store_hours": store.settings.store_hours if store.settings else None,
        "whatsapp": store.whatsapp,
        "primary_color": store.primary_color,
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
            "bank_account": store.settings.bank_account if store.settings else None,
            "delivery_fee_cents": store.settings.delivery_fee_cents if store.settings else 0,
            "min_order_cents": store.settings.min_order_cents if store.settings else 0,
            "free_delivery_above": store.settings.free_delivery_above if store.settings else None,
            "welcome_discount_enabled": store.settings.welcome_discount_enabled if store.settings else False,
            "welcome_discount_cents": store.settings.welcome_discount_cents if store.settings else 0,
        } if store.settings else {},
        "meta_title": store.meta_title or store.name,
        "meta_desc": store.meta_desc,
    }


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

ALLOWED_EVENTS = {"store_view", "product_view", "add_to_cart", "checkout_start"}


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
