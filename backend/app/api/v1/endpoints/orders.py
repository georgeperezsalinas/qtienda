"""
Vendor order management — authenticated, scoped to vendor's store.
Multi-tenant: vendors only see their own orders.
"""
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import Order, OrderItem, Product, ProductVariant, Store, AuditLog
from app.services.whatsapp import send_whatsapp_message


class OrderStatusUpdate(BaseModel):
    status: str

router = APIRouter()


# Solo se ofrece notificar por WhatsApp en los hitos clave (confirmar y entregar).
# Los pasos intermedios (preparando, en camino) los ve el comprador en su página
# de seguimiento: qtienda.shop/tienda/{slug}/pedido/{num}
_BUYER_MESSAGES = {
    "confirmed": (
        "✅ *¡Tu pedido fue confirmado!*\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "📋 Pedido: *#{num}*\n"
        "🏪 Tienda: {store}\n\n"
        "Ya recibimos tu pedido y lo estamos alistando 🙌\n\n"
        "📍 Sigue el avance de tu pedido aquí:\n"
        "qtienda.shop/tienda/{slug}/pedido/{num}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "Gracias por tu compra 🙏"
    ),
    "delivered": (
        "📦 *¡Tu pedido llegó!*\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "📋 Pedido: *#{num}*\n"
        "🏪 Tienda: {store}\n\n"
        "Esperamos que todo haya llegado perfecto 😊\n"
        "¡Gracias por elegirnos! 🙏\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "¿Todo bien con tu pedido? Cuéntanos aquí 💬"
    ),
}


def _buyer_wa_text(order, store) -> Optional[str]:
    template = _BUYER_MESSAGES.get(order.status)
    if not template or not order.buyer_phone:
        return None
    return template.format(num=order.order_number, store=store.name, slug=store.slug)


def _buyer_wa_link(order, store) -> Optional[str]:
    """WhatsApp deep-link — queda como respaldo manual si el envío automático falla."""
    msg = _buyer_wa_text(order, store)
    if not msg:
        return None
    phone = order.buyer_phone.lstrip("+").replace(" ", "").replace("-", "")
    if len(phone) == 9:
        phone = f"51{phone}"
    return f"https://wa.me/{phone}?text={quote(msg)}"


async def get_vendor_store(user, db: AsyncSession) -> Store:
    """Ensure vendor has an active store and return it."""
    result = await db.execute(
        select(Store).where(
            Store.user_id == user.id,
            Store.deleted_at.is_(None),
        )
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


VALID_STATUSES = {"pending", "confirmed", "preparing", "on_the_way", "delivered", "cancelled"}
STATUS_TRANSITIONS = {
    "pending":    {"confirmed", "cancelled"},
    "confirmed":  {"preparing", "cancelled"},
    "preparing":  {"on_the_way", "cancelled"},
    "on_the_way": {"delivered", "cancelled"},
    "delivered":  set(),
    "cancelled":  {"pending"},
}


@router.get("/stats/summary")
async def order_stats(
    from_date: Optional[date] = Query(None, description="YYYY-MM-DD"),
    to_date:   Optional[date] = Query(None, description="YYYY-MM-DD"),
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """KPI summary for vendor. Defaults to current month if no dates given."""
    store = await get_vendor_store(current_user, db)

    from sqlalchemy import case

    now = datetime.now(timezone.utc)

    if from_date is None:
        # Default: first day of current month
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    else:
        start = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)

    if to_date is None:
        end = now
    else:
        # Include the full to_date day
        end = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)

    base_filter = [
        Order.store_id == store.id,
        Order.created_at >= start,
        Order.created_at <= end,
    ]

    row = (await db.execute(
        select(
            func.count().label("total"),
            func.count(case((Order.status == "pending",   1))).label("pending"),
            func.count(case((Order.status == "delivered", 1))).label("delivered"),
            func.count(case((Order.status == "cancelled", 1))).label("cancelled"),
            func.coalesce(func.sum(
                case((Order.status != "cancelled", Order.total_cents), else_=0)
            ), 0).label("revenue_cents"),
        )
        .where(*base_filter)
    )).one()

    pm_rows = (await db.execute(
        select(
            Order.payment_method,
            func.count().label("cnt"),
            func.coalesce(func.sum(
                case((Order.status != "cancelled", Order.total_cents), else_=0)
            ), 0).label("rev"),
        )
        .where(*base_filter)
        .group_by(Order.payment_method)
    )).all()

    return {
        "this_month": {
            "total_orders":  row.total,
            "pending":       row.pending,
            "delivered":     row.delivered,
            "cancelled":     row.cancelled,
            "revenue_cents": row.revenue_cents,
            "by_payment": [
                {"method": r.payment_method, "count": r.cnt, "revenue_cents": r.rev}
                for r in pm_rows
            ],
        }
    }


@router.get("/stats/daily")
async def order_stats_daily(
    from_date: Optional[date] = Query(None),
    to_date:   Optional[date] = Query(None),
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """Day-by-day orders + revenue for chart rendering."""
    from sqlalchemy import case
    store = await get_vendor_store(current_user, db)

    now = datetime.now(timezone.utc)
    start = (
        datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        if from_date
        else datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    )
    end = (
        datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        if to_date
        else now
    )

    rows = (await db.execute(
        select(
            func.date_trunc("day", Order.created_at).label("day"),
            func.count().label("orders"),
            func.coalesce(func.sum(
                case((Order.status != "cancelled", Order.total_cents), else_=0)
            ), 0).label("revenue_cents"),
        )
        .where(
            Order.store_id == store.id,
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .group_by("day")
        .order_by("day")
    )).all()

    return [
        {
            "date": r.day.strftime("%Y-%m-%d"),
            "orders": r.orders,
            "revenue_cents": r.revenue_cents,
        }
        for r in rows
    ]


@router.get("/stats/top-products")
async def order_stats_top_products(
    from_date: Optional[date] = Query(None),
    to_date:   Optional[date] = Query(None),
    limit: int = Query(10, ge=1, le=20),
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """Productos más vendidos del período — por ingresos y por unidades.
    Agrupa por product_id (o por nombre si el producto ya se eliminó, para
    no mezclar productos distintos bajo un mismo NULL)."""
    store = await get_vendor_store(current_user, db)

    now = datetime.now(timezone.utc)
    start = (
        datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        if from_date
        else datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    )
    end = (
        datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        if to_date
        else now
    )

    rows = (await db.execute(
        select(
            OrderItem.product_id,
            OrderItem.product_name,
            func.max(OrderItem.image_url).label("image_url"),
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.subtotal).label("revenue_cents"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.store_id == store.id,
            Order.status != "cancelled",
            Order.created_at >= start,
            Order.created_at <= end,
        )
        .group_by(OrderItem.product_id, OrderItem.product_name)
        .order_by(func.sum(OrderItem.subtotal).desc())
        .limit(limit)
    )).all()

    return [
        {
            "product_id": r.product_id,
            "product_name": r.product_name,
            "image_url": r.image_url,
            "units_sold": r.units_sold,
            "revenue_cents": r.revenue_cents,
        }
        for r in rows
    ]


@router.get("/")
async def list_orders(
    status: Optional[str]  = Query(None),
    page: int              = Query(1, ge=1),
    limit: int             = Query(20, le=100),
    search: Optional[str]  = Query(None),
    from_date: Optional[date] = Query(None, description="YYYY-MM-DD"),
    to_date:   Optional[date] = Query(None, description="YYYY-MM-DD"),
    current_user           = Depends(require_vendor),
    db: AsyncSession       = Depends(get_db),
):
    store = await get_vendor_store(current_user, db)

    filters = [Order.store_id == store.id]
    if status:
        filters.append(Order.status == status)
    if from_date:
        filters.append(Order.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc))
    if to_date:
        filters.append(Order.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc))
    if search:
        filters.append(
            Order.buyer_name.ilike(f"%{search}%") |
            Order.buyer_phone.ilike(f"%{search}%") |
            Order.order_number.ilike(f"%{search}%")
        )

    total_q = await db.execute(select(func.count()).select_from(Order).where(and_(*filters)))
    total = total_q.scalar()

    from app.models.models import User
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.assigned_to))
        .where(and_(*filters))
        .order_by(Order.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    orders = result.scalars().all()

    # Aviso anti-spam: cuántos pedidos cancelados tiene este mismo teléfono
    # en esta tienda — una sola query agregada para toda la página, no una
    # por pedido. Es información para que el vendedor decida, no bloquea nada.
    phones = list({o.buyer_phone for o in orders if o.buyer_phone})
    cancelled_counts: dict[str, int] = {}
    if phones:
        rows = (await db.execute(
            select(Order.buyer_phone, func.count()).where(
                Order.store_id == store.id,
                Order.buyer_phone.in_(phones),
                Order.status == "cancelled",
            ).group_by(Order.buyer_phone)
        )).all()
        cancelled_counts = {phone: count for phone, count in rows}

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "buyer_name": o.buyer_name,
                "buyer_phone": o.buyer_phone,
                "total_cents": o.total_cents,
                "items_count": len(o.items),
                "created_at": o.created_at,
                "assigned_to_id": o.assigned_to_id,
                "assigned_to_name": o.assigned_to.full_name if o.assigned_to else None,
                "service_type": o.service_type,
                "buyer_cancelled_count": cancelled_counts.get(o.buyer_phone, 0) - (1 if o.status == "cancelled" else 0),
            }
            for o in orders
        ],
    }


@router.get("/{order_id}")
async def get_order(
    order_id: UUID,
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await get_vendor_store(current_user, db)

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.payment),
            selectinload(Order.delivery),
            selectinload(Order.assigned_to), 
        )
        .where(Order.id == order_id, Order.store_id == store.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    buyer_cancelled_count = 0
    if order.buyer_phone:
        buyer_cancelled_count = (await db.execute(
            select(func.count()).select_from(Order).where(
                Order.store_id == store.id,
                Order.buyer_phone == order.buyer_phone,
                Order.status == "cancelled",
                Order.id != order.id,
            )
        )).scalar()

    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "buyer_name": order.buyer_name,
        "buyer_phone": order.buyer_phone,
        "buyer_cancelled_count": buyer_cancelled_count,
        "buyer_dni": order.buyer_dni,
        "buyer_email": order.buyer_email,
        "buyer_department": order.buyer_department,
        "buyer_province": order.buyer_province,
        "buyer_district": order.buyer_district,
        "buyer_address": order.buyer_address,
        "buyer_reference": order.buyer_reference,
        "service_type": order.service_type,
        "subtotal_cents": order.subtotal_cents,
        "delivery_cents": order.delivery_cents,
        "discount_cents": order.discount_cents,
        "total_cents": order.total_cents,
        "notes": order.notes,
        "source": order.source,
        "assigned_to_id":   str(order.assigned_to_id) if order.assigned_to_id else None,
        "assigned_to_name": order.assigned_to.full_name if order.assigned_to else None,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "items": [
            {
                "id": i.id,
                "product_id": i.product_id,
                "product_name": i.product_name,
                "product_sku": i.product_sku,
                "variant_label": i.variant_label,
                "variant_sku": i.variant_sku,
                "unit_price": i.unit_price,
                "quantity": i.quantity,
                "subtotal": i.subtotal,
                "image_url": i.image_url,
            }
            for i in order.items
        ],
        "payment": {
            "method": order.payment.method,
            "status": order.payment.status,
            "amount_cents": order.payment.amount_cents,
            "reference": order.payment.reference,
        } if order.payment else None,
        "delivery": {
            "courier_name": order.delivery.courier_name,
            "courier_phone": order.delivery.courier_phone,
            "tracking_code": order.delivery.tracking_code,
            "estimated_at": order.delivery.estimated_at,
            "delivered_at": order.delivery.delivered_at,
            "notes": order.delivery.notes,
        } if order.delivery else None,
    }


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: UUID,
    body: OrderStatusUpdate,
    current_user = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await get_vendor_store(current_user, db)

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id, Order.store_id == store.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    new_status = body.status
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido")

    allowed = STATUS_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"No se puede pasar de '{order.status}' a '{new_status}'",
        )

    old_status = order.status
    order.status = new_status
    if new_status == "delivered" and not order.delivered_at:
        order.delivered_at = datetime.now(timezone.utc)

    # Cancelar libera el stock que se había reservado al crear el pedido —
    # sin esto, un pedido cancelado dejaba esas unidades "perdidas" para
    # siempre en el sistema. Reactivar (cancelled → pending) vuelve a
    # descontarlo (se permite quedar en negativo; es un caso raro y el
    # vendedor lo ve reflejado para ajustarlo a mano si hace falta).
    if new_status == "cancelled" or (old_status == "cancelled" and new_status == "pending"):
        product_ids = [i.product_id for i in order.items if i.product_id]
        variant_ids = [i.variant_id for i in order.items if i.variant_id]
        sign = 1 if new_status == "cancelled" else -1

        products_by_id = {}
        if product_ids:
            products = (
                await db.execute(select(Product).where(Product.id.in_(product_ids)).with_for_update())
            ).scalars().all()
            products_by_id = {p.id: p for p in products}

        variants_by_id = {}
        if variant_ids:
            variants = (
                await db.execute(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)).with_for_update())
            ).scalars().all()
            variants_by_id = {v.id: v for v in variants}

        for item in order.items:
            if item.variant_id:
                variant = variants_by_id.get(item.variant_id)
                if variant and variant.stock is not None:
                    variant.stock += sign * item.quantity
            else:
                product = products_by_id.get(item.product_id)
                if product and product.stock is not None:
                    product.stock += sign * item.quantity

    # Audit
    db.add(AuditLog(
        user_id=current_user.id,
        store_id=store.id,
        action="order.status_change",
        entity="orders",
        entity_id=order.id,
        old_value={"status": old_status},
        new_value={"status": new_status},
    ))

    await db.commit()

    # Push notification to buyer (fire-and-forget, uses its own DB session)
    # if order.buyer_email:
    #     from app.services.push import send_push_to_buyer
    #     import asyncio
    #     asyncio.ensure_future(
    #         send_push_to_buyer(order.buyer_email, new_status, order.order_number, store.slug)
    #     )

    import asyncio
    from app.services.push import send_push_to_buyer

    # 1. Push WebPush al comprador (ya existente)
    if order.buyer_email:
        asyncio.ensure_future(
            send_push_to_buyer(order.buyer_email, new_status, order.order_number, store.slug)
        )

    # 2. Expo Push al vendor en su app móvil (nuevo)
    #    Solo notificamos en estados relevantes para el vendor
    if new_status in ("cancelled",):
        from app.services.push import send_expo_push_to_vendor_by_store
        asyncio.ensure_future(
            send_expo_push_to_vendor_by_store(
                store_id     = store.id,
                title        = f"⚠️ Pedido #{order.order_number} cancelado",
                body         = f"El pedido de {order.buyer_name} fue cancelado",
                order_id     = str(order.id),
            )
        )

    # Aviso al comprador (confirmado/entregado) — automático de verdad ahora
    # que hay envío real por WhatsApp. Se espera la respuesta (no fire-and-
    # forget) para poder avisarle al vendedor en el toast si de verdad se
    # mandó o si tiene que usar el link manual de respaldo.
    whatsapp_text = _buyer_wa_text(order, store)
    whatsapp_sent = False
    if whatsapp_text:
        whatsapp_sent = await send_whatsapp_message(order.buyer_phone, whatsapp_text)

    buyer_wa_link = _buyer_wa_link(order, store)
    return {
        "order_id": order.id,
        "status": order.status,
        "buyer_wa_link": buyer_wa_link,
        "whatsapp_sent": whatsapp_sent,
    }


class OrderAssign(BaseModel):
    staff_id: Optional[str] = None  # None = desasignar


@router.patch("/{order_id}/assign")
async def assign_order(
    order_id: UUID,
    body: OrderAssign,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import User, Role
    store = await get_vendor_store(current_user, db)

    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.store_id == store.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if body.staff_id:
        role_q = await db.execute(select(Role).where(Role.name == "delivery"))
        delivery_role = role_q.scalar_one_or_none()
        staff_q = await db.execute(
            select(User).where(
                User.id == UUID(body.staff_id),
                User.delivery_store_id == store.id,
                User.role_id == delivery_role.id if delivery_role else False,
            )
        )
        staff = staff_q.scalar_one_or_none()
        if not staff:
            raise HTTPException(status_code=404, detail="Repartidor no encontrado")
        order.assigned_to_id = staff.id
    else:
        order.assigned_to_id = None

    await db.commit()
    return {"order_id": order.id, "assigned_to_id": order.assigned_to_id}

