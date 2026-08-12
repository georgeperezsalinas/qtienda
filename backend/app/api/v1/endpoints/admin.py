"""Admin endpoints — require admin role."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_admin
from app.models.models import (
    AuditLog, MallBanner, Order, Payment, Plan, PlanPaymentRequest, Product, Review, Role, SiteEvent,
    Store, StoreEvent, Subscription, User,
)
from app.schemas.auth import BannersUpdate

router = APIRouter()


@router.get("/stores")
async def list_stores(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    is_test: Optional[bool] = Query(None),
    has_products: Optional[bool] = Query(None),
    onboarding_incomplete: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = [Store.deleted_at.is_(None)]
    if status:
        filters.append(Store.status == status)
    if is_test is not None:
        filters.append(Store.is_test == is_test)
    if has_products is not None:
        exists_products = (
            select(Product.id)
            .where(Product.store_id == Store.id, Product.deleted_at.is_(None))
            .exists()
        )
        filters.append(exists_products if has_products else ~exists_products)
    if onboarding_incomplete:
        exists_products = (
            select(Product.id)
            .where(Product.store_id == Store.id, Product.deleted_at.is_(None))
            .exists()
        )
        filters.append(Store.status == "active")
        filters.append(
            or_(Store.logo_url.is_(None), Store.banner_url.is_(None), ~exists_products)
        )
    if q:
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                Store.name.ilike(term),
                Store.slug.ilike(term),
                Store.city.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(Store).where(and_(*filters)))
    ).scalar()

    order_col = (
        Store.created_at.asc() if (has_products is False or onboarding_incomplete)
        else Store.created_at.desc()
    )
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.user))
        .where(and_(*filters))
        .order_by(order_col)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    stores = result.scalars().all()

    store_ids = [s.id for s in stores]
    product_counts = {}
    order_counts = {}
    revenue_by_store = {}
    if store_ids:
        product_rows = (
            await db.execute(
                select(Product.store_id, func.count(Product.id))
                .where(Product.store_id.in_(store_ids), Product.deleted_at.is_(None))
                .group_by(Product.store_id)
            )
        ).all()
        product_counts = {store_id: count for store_id, count in product_rows}

        order_rows = (
            await db.execute(
                select(
                    Order.store_id,
                    func.count(Order.id),
                    func.coalesce(func.sum(Order.total_cents), 0),
                )
                .where(Order.store_id.in_(store_ids))
                .group_by(Order.store_id)
            )
        ).all()
        order_counts = {store_id: count for store_id, count, _ in order_rows}
        revenue_by_store = {store_id: revenue for store_id, _, revenue in order_rows}

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [
            {
                "id": s.id,
                "slug": s.slug,
                "name": s.name,
                "status": s.status,
                "is_test": s.is_test,
                "city": s.city,
                "country": s.country,
                "currency": s.currency,
                "created_at": s.created_at,
                "owner_email": s.user.email if s.user else None,
                "owner_name": s.user.full_name if s.user else None,
                "owner_phone": s.user.phone if s.user else None,
                "products_count": product_counts.get(s.id, 0),
                "orders_count": order_counts.get(s.id, 0),
                "revenue_cents": revenue_by_store.get(s.id, 0),
                "logo_url": s.logo_url,
                "banner_url": s.banner_url,
                "whatsapp": s.whatsapp,
                "campaign_contacted_at": s.campaign_contacted_at,
            }
            for s in stores
        ],
    }


@router.get("/stores/{store_id}")
async def get_store(
    store_id: UUID,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store)
        .options(selectinload(Store.user), selectinload(Store.settings))
        .where(Store.id == store_id)
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    order_count = (
        await db.execute(
            select(func.count()).select_from(Order).where(Order.store_id == store_id)
        )
    ).scalar()
    product_count = (
        await db.execute(
            select(func.count()).select_from(Product).where(
                Product.store_id == store_id,
                Product.deleted_at.is_(None),
            )
        )
    ).scalar()
    revenue_cents = (
        await db.execute(
            select(func.coalesce(func.sum(Order.total_cents), 0)).where(
                Order.store_id == store_id,
                Order.status != "cancelled",
            )
        )
    ).scalar()
    products = (
        await db.execute(
            select(Product)
            .where(Product.store_id == store_id, Product.deleted_at.is_(None))
            .order_by(Product.created_at.desc())
            .limit(8)
        )
    ).scalars().all()
    orders = (
        await db.execute(
            select(Order)
            .where(Order.store_id == store_id)
            .order_by(Order.created_at.desc())
            .limit(8)
        )
    ).scalars().all()

    return {
        "id": store.id,
        "slug": store.slug,
        "name": store.name,
        "status": store.status,
        "is_test": store.is_test,
        "city": store.city,
        "country": store.country,
        "currency": store.currency,
        "whatsapp": store.whatsapp,
        "created_at": store.created_at,
        "deleted_at": store.deleted_at,
        "logo_url": store.logo_url,
        "banner_url": store.banner_url,
        "primary_color": store.primary_color,
        "description": store.description,
        "owner": {
            "id": store.user.id,
            "email": store.user.email,
            "full_name": store.user.full_name,
            "phone": store.user.phone,
            "is_active": store.user.is_active,
        } if store.user else None,
        "order_count": order_count,
        "product_count": product_count,
        "revenue_cents": revenue_cents,
        "settings": {
            "accept_cash": store.settings.accept_cash,
            "accept_yape": store.settings.accept_yape,
            "accept_plin": store.settings.accept_plin,
            "accept_transfer": store.settings.accept_transfer,
            "accept_card": store.settings.accept_card,
            "delivery_fee_cents": store.settings.delivery_fee_cents,
            "min_order_cents": store.settings.min_order_cents,
        } if store.settings else None,
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "price_cents": p.price_cents,
                "stock": p.stock,
                "created_at": p.created_at,
            }
            for p in products
        ],
        "recent_orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "buyer_name": o.buyer_name,
                "total_cents": o.total_cents,
                "created_at": o.created_at,
            }
            for o in orders
        ],
    }


@router.post("/stores/{store_id}/approve")
async def approve_store(
    store_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    old_status = store.status
    store.status = "active"
    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=store.id,
        action="store.approved",
        entity="stores",
        entity_id=store.id,
        old_value={"status": old_status},
        new_value={"status": "active"},
    ))
    await db.commit()
    return {"store_id": store.id, "status": store.status}


@router.post("/stores/{store_id}/suspend")
async def suspend_store(
    store_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    old_status = store.status
    store.status = "suspended"
    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=store.id,
        action="store.suspended",
        entity="stores",
        entity_id=store.id,
        old_value={"status": old_status},
        new_value={"status": "suspended"},
    ))
    await db.commit()
    return {"store_id": store.id, "status": store.status}


class MarkTestRequest(BaseModel):
    is_test: bool


@router.post("/stores/{store_id}/mark-test")
async def mark_store_test(
    store_id: UUID,
    body: MarkTestRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Store).where(Store.id == store_id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    old_value = store.is_test
    store.is_test = body.is_test
    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=store.id,
        action="store.marked_test" if body.is_test else "store.unmarked_test",
        entity="stores",
        entity_id=store.id,
        old_value={"is_test": old_value},
        new_value={"is_test": body.is_test},
    ))
    await db.commit()
    return {"store_id": store.id, "is_test": store.is_test}


@router.post("/stores/{store_id}/mark-contacted")
async def mark_store_contacted(
    store_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Registra que el equipo ya contactó a esta tienda por la campaña de
    onboarding incompleto (WhatsApp manual desde el admin) — evita reenviar
    el mismo mensaje a quien ya recibió uno."""
    result = await db.execute(
        select(Store).where(Store.id == store_id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    now = datetime.now(timezone.utc)
    store.campaign_contacted_at = now
    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=store.id,
        action="store.campaign_contacted",
        entity="stores",
        entity_id=store.id,
        new_value={"campaign_contacted_at": now.isoformat()},
    ))
    await db.commit()
    return {"store_id": store.id, "campaign_contacted_at": store.campaign_contacted_at}


@router.post("/stores/{store_id}/campaign-email")
async def send_campaign_email(
    store_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Igual que la campaña de WhatsApp, pero por correo — para las tiendas
    cuyo dueño no registró teléfono y por eso no se les puede armar un
    link de wa.me."""
    result = await db.execute(
        select(Store).options(selectinload(Store.user)).where(
            Store.id == store_id, Store.deleted_at.is_(None)
        )
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    if not store.user or not store.user.email:
        raise HTTPException(status_code=422, detail="Esta tienda no tiene un correo registrado")

    active_products = (await db.execute(
        select(func.count()).select_from(Product).where(
            Product.store_id == store.id, Product.deleted_at.is_(None), Product.status == "active",
        )
    )).scalar()

    missing = []
    if not store.logo_url:
        missing.append("logo")
    if not store.banner_url:
        missing.append("banner")
    if not active_products:
        missing.append("productos")

    if not missing:
        raise HTTPException(status_code=422, detail="Esta tienda ya completó su onboarding")

    missing_text = (
        f"tu {missing[0]}" if len(missing) == 1
        else f"tu {missing[0]} y tu {missing[1]}" if len(missing) == 2
        else f"tu {missing[0]}, tu {missing[1]} y tus {missing[2]}"
    )
    first_name = (store.user.full_name or "").split(" ")[0] or ""
    greeting = f"Hola {first_name}" if first_name else "Hola"

    from app.services.email import send_notification_email
    await send_notification_email(
        to_email=store.user.email,
        full_name=store.user.full_name or "",
        icon="👋",
        title=f"{greeting}, te falta un paso para vender",
        body=(
            f'Vimos que creaste tu tienda "{store.name}" pero te falta agregar {missing_text} '
            f"para que quede lista y puedas empezar a vender."
        ),
        cta_url="https://qtienda.shop/dashboard",
        cta_label="Completar mi tienda",
    )

    now = datetime.now(timezone.utc)
    store.campaign_contacted_at = now
    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=store.id,
        action="store.campaign_emailed",
        entity="stores",
        entity_id=store.id,
        new_value={"campaign_contacted_at": now.isoformat()},
    ))
    await db.commit()
    return {"store_id": store.id, "campaign_contacted_at": store.campaign_contacted_at}


class StoreDeleteRequest(BaseModel):
    confirm: str
    reason: Optional[str] = None


@router.delete("/stores/{store_id}")
async def delete_store(
    store_id: UUID,
    body: StoreDeleteRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmación inválida. Envía { confirm: 'DELETE' }")

    result = await db.execute(select(Store).where(Store.id == store_id, Store.deleted_at.is_(None)))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    old_value = {
        "status": store.status,
        "deleted_at": None,
        "slug": store.slug,
        "name": store.name,
    }
    store.status = "suspended"
    store.deleted_at = datetime.now(timezone.utc)
    # Libera el slug para que se pueda reutilizar — el índice único de la BD
    # no distingue tiendas eliminadas, así que sin esto un slug borrado queda
    # bloqueado para siempre y crear una tienda nueva con ese nombre revienta
    # con IntegrityError (bug real: qtienda.shop/jpsystem, agosto 2026).
    store.slug = f"{store.slug[:40]}-del-{store.deleted_at.strftime('%Y%m%d%H%M%S')}"
    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=store.id,
        action="store.soft_deleted",
        entity="stores",
        entity_id=store.id,
        old_value=old_value,
        new_value={
            "status": store.status,
            "deleted_at": store.deleted_at.isoformat(),
            "slug": store.slug,
            "reason": body.reason,
        },
    ))
    await db.commit()
    return {"store_id": store.id, "deleted_at": store.deleted_at, "status": store.status}


@router.get("/orders")
async def list_orders(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    store_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if status:
        filters.append(Order.status == status)
    if store_id:
        filters.append(Order.store_id == store_id)
    if q:
        term = f"%{q.strip()}%"
        filters.append(or_(
            Order.buyer_name.ilike(term),
            Order.buyer_phone.ilike(term),
            Order.order_number.ilike(term),
        ))
    where_clause = and_(*filters) if filters else True

    total = (
        await db.execute(select(func.count()).select_from(Order).where(where_clause))
    ).scalar()

    result = await db.execute(
        select(Order, Store.name, Store.slug, Store.country, Store.currency)
        .join(Store, Order.store_id == Store.id)
        .where(where_clause)
        .order_by(Order.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

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
                "payment_method": o.payment_method,
                "created_at": o.created_at,
                "store": {"name": sname, "slug": sslug, "country": scountry, "currency": scurrency},
            }
            for o, sname, sslug, scountry, scurrency in rows
        ],
    }


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (
        await db.execute(
            select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        )
    ).scalar()

    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.deleted_at.is_(None))
        .order_by(User.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.name,
                "is_active": u.is_active,
                "created_at": u.created_at,
                "last_login_at": u.last_login_at,
            }
            for u in users
        ],
    }


class UserUpdateRequest(BaseModel):
    is_active: bool


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    body: UserUpdateRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_admin.id and not body.is_active:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")

    old_value = user.is_active
    user.is_active = body.is_active
    db.add(AuditLog(
        user_id=current_admin.id,
        action="user.activated" if body.is_active else "user.suspended",
        entity="users",
        entity_id=user.id,
        old_value={"is_active": old_value},
        new_value={"is_active": body.is_active},
    ))
    await db.commit()
    return {"user_id": user.id, "is_active": user.is_active}


@router.get("/audit-logs")
async def list_audit_logs(
    entity: Optional[str] = Query(None),
    store_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if entity:
        filters.append(AuditLog.entity == entity)
    if store_id:
        filters.append(AuditLog.store_id == store_id)
    where_clause = and_(*filters) if filters else True

    total = (
        await db.execute(select(func.count()).select_from(AuditLog).where(where_clause))
    ).scalar()

    result = await db.execute(
        select(AuditLog, User.full_name, User.email, Store.name, Store.slug)
        .outerjoin(User, AuditLog.user_id == User.id)
        .outerjoin(Store, AuditLog.store_id == Store.id)
        .where(where_clause)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [
            {
                "id": log.id,
                "action": log.action,
                "entity": log.entity,
                "entity_id": log.entity_id,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "created_at": log.created_at,
                "admin": {"name": full_name, "email": email} if email else None,
                "store": {"name": store_name, "slug": store_slug} if store_name else None,
            }
            for log, full_name, email, store_name, store_slug in rows
        ],
    }


@router.get("/metrics")
async def global_metrics(
    request: Request,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    total_stores = (
        await db.execute(
            select(func.count()).select_from(Store).where(Store.deleted_at.is_(None))
        )
    ).scalar()

    active_stores = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.status == "active", Store.deleted_at.is_(None)
            )
        )
    ).scalar()

    pending_stores = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.status == "pending", Store.deleted_at.is_(None)
            )
        )
    ).scalar()

    suspended_stores = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.status == "suspended", Store.deleted_at.is_(None)
            )
        )
    ).scalar()

    test_stores = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.is_test.is_(True), Store.deleted_at.is_(None)
            )
        )
    ).scalar()

    stores_without_products = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.status == "active",
                Store.deleted_at.is_(None),
                Store.is_test.is_(False),
                ~select(Product.id)
                    .where(Product.store_id == Store.id, Product.deleted_at.is_(None))
                    .exists(),
            )
        )
    ).scalar()

    subscriptions_expiring_soon = (
        await db.execute(
            select(func.count()).select_from(Subscription).where(
                Subscription.status == "active",
                Subscription.ends_at.is_not(None),
                Subscription.ends_at <= now + timedelta(days=14),
            )
        )
    ).scalar()

    stores_onboarding_incomplete = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.status == "active",
                Store.deleted_at.is_(None),
                Store.is_test.is_(False),
                or_(
                    Store.logo_url.is_(None),
                    Store.banner_url.is_(None),
                    ~select(Product.id)
                        .where(Product.store_id == Store.id, Product.deleted_at.is_(None))
                        .exists(),
                ),
            )
        )
    ).scalar()

    total_users = (
        await db.execute(
            select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        )
    ).scalar()

    total_products = (
        await db.execute(
            select(func.count()).select_from(Product).where(Product.deleted_at.is_(None))
        )
    ).scalar()

    total_orders = (
        await db.execute(select(func.count()).select_from(Order))
    ).scalar()

    plan_requests_pending = (
        await db.execute(
            select(func.count()).select_from(PlanPaymentRequest).where(
                PlanPaymentRequest.status == "pending"
            )
        )
    ).scalar()

    from sqlalchemy import extract
    # Excluir tiendas marcadas como prueba para no inflar metricas de marcha blanca
    monthly_orders = (
        await db.execute(
            select(func.count())
            .select_from(Order)
            .join(Store, Order.store_id == Store.id)
            .where(
                Store.is_test.is_(False),
                extract("month", Order.created_at) == now.month,
                extract("year", Order.created_at) == now.year,
            )
        )
    ).scalar()

    monthly_revenue = (
        await db.execute(
            select(func.coalesce(func.sum(Order.total_cents), 0))
            .select_from(Order)
            .join(Store, Order.store_id == Store.id)
            .where(
                Store.is_test.is_(False),
                Order.status != "cancelled",
                extract("month", Order.created_at) == now.month,
                extract("year", Order.created_at) == now.year,
            )
        )
    ).scalar()

    # Tendencia de altas (tiendas y usuarios) de los últimos 14 días, día a día
    since = now - timedelta(days=13)
    day_bucket_start = datetime(since.year, since.month, since.day, tzinfo=timezone.utc)

    store_day = func.date_trunc("day", Store.created_at)
    stores_trend_rows = (
        await db.execute(
            select(store_day, func.count())
            .where(Store.created_at >= day_bucket_start, Store.deleted_at.is_(None))
            .group_by(store_day)
        )
    ).all()
    user_day = func.date_trunc("day", User.created_at)
    users_trend_rows = (
        await db.execute(
            select(user_day, func.count())
            .where(User.created_at >= day_bucket_start, User.deleted_at.is_(None))
            .group_by(user_day)
        )
    ).all()
    stores_by_day = {d.date().isoformat(): c for d, c in stores_trend_rows}
    users_by_day = {d.date().isoformat(): c for d, c in users_trend_rows}
    trend = []
    for i in range(14):
        day = (day_bucket_start + timedelta(days=i)).date().isoformat()
        trend.append({"date": day, "stores": stores_by_day.get(day, 0), "users": users_by_day.get(day, 0)})

    # Top 5 tiendas por ventas (excluye canceladas y tiendas de prueba)
    top_rows = (
        await db.execute(
            select(
                Store.id, Store.name, Store.slug, Store.country, Store.currency,
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_cents), 0),
            )
            .join(Order, Order.store_id == Store.id)
            .where(
                Store.deleted_at.is_(None),
                Store.is_test.is_(False),
                Order.status != "cancelled",
            )
            .group_by(Store.id, Store.name, Store.slug, Store.country, Store.currency)
            .order_by(func.coalesce(func.sum(Order.total_cents), 0).desc())
            .limit(5)
        )
    ).all()
    top_stores = [
        {
            "id": sid, "name": name, "slug": slug, "country": country, "currency": currency,
            "orders": orders, "revenue_cents": revenue,
        }
        for sid, name, slug, country, currency, orders, revenue in top_rows
    ]

    started_at = getattr(request.app.state, "started_at", None)
    uptime_seconds = (now - started_at).total_seconds() if started_at else None

    return {
        "stores": {
            "total": total_stores,
            "active": active_stores,
            "pending": pending_stores,
            "suspended": suspended_stores,
            "test": test_stores,
            "without_products": stores_without_products,
            "onboarding_incomplete": stores_onboarding_incomplete,
        },
        "users": {"total": total_users},
        "products": {"total": total_products},
        "orders": {"total": total_orders},
        "plan_requests": {"pending": plan_requests_pending},
        "subscriptions": {"expiring_soon": subscriptions_expiring_soon},
        "this_month": {
            "orders": monthly_orders,
            "revenue_cents": monthly_revenue,
        },
        "trend": trend,
        "top_stores": top_stores,
        "technical": {
            "version": request.app.version,
            "environment": "development" if settings.DEBUG else "production",
            "uptime_seconds": uptime_seconds,
            "database": "PostgreSQL",
            "plan_expiry_watcher": True,
        },
    }


@router.get("/site-traffic")
async def site_traffic(
    days: int = Query(30, ge=1, le=90),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trafico agregado de todo el dominio: landing/tiendas (site_events) +
    visitas a tiendas individuales sin filtrar por tienda (store_events)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # ── Landing / directorio de tiendas ──
    site_base = [SiteEvent.created_at >= since]

    page_views = (
        await db.execute(
            select(func.count()).select_from(SiteEvent).where(
                *site_base, SiteEvent.event == "page_view"
            )
        )
    ).scalar()

    site_unique_visitors = (
        await db.execute(
            select(func.count(func.distinct(SiteEvent.session_id))).where(
                *site_base, SiteEvent.event == "page_view", SiteEvent.session_id.isnot(None)
            )
        )
    ).scalar()

    site_device_rows = (
        await db.execute(
            select(SiteEvent.device, func.count())
            .where(*site_base, SiteEvent.event == "page_view", SiteEvent.device.isnot(None))
            .group_by(SiteEvent.device)
        )
    ).all()

    top_path_rows = (
        await db.execute(
            select(SiteEvent.path, func.count())
            .where(*site_base, SiteEvent.event == "page_view", SiteEvent.path.isnot(None))
            .group_by(SiteEvent.path)
            .order_by(func.count().desc())
            .limit(8)
        )
    ).all()

    # ── Tiendas (todas, no una en particular) ──
    store_base = [StoreEvent.created_at >= since]

    store_event_rows = (
        await db.execute(
            select(StoreEvent.event, func.count())
            .where(*store_base)
            .group_by(StoreEvent.event)
        )
    ).all()
    store_event_totals = {ev: c for ev, c in store_event_rows}

    stores_unique_visitors = (
        await db.execute(
            select(func.count(func.distinct(StoreEvent.session_id))).where(
                *store_base, StoreEvent.event == "store_view", StoreEvent.session_id.isnot(None)
            )
        )
    ).scalar()

    stores_device_rows = (
        await db.execute(
            select(StoreEvent.device, func.count())
            .where(*store_base, StoreEvent.event == "store_view", StoreEvent.device.isnot(None))
            .group_by(StoreEvent.device)
        )
    ).all()

    top_viewed_rows = (
        await db.execute(
            select(Store.id, Store.name, Store.slug, func.count(StoreEvent.id))
            .join(StoreEvent, StoreEvent.store_id == Store.id)
            .where(*store_base, StoreEvent.event == "store_view", Store.deleted_at.is_(None))
            .group_by(Store.id, Store.name, Store.slug)
            .order_by(func.count(StoreEvent.id).desc())
            .limit(8)
        )
    ).all()

    return {
        "period_days": days,
        "site": {
            "page_views": page_views,
            "unique_visitors": site_unique_visitors,
            "devices": {d: c for d, c in site_device_rows},
            "top_paths": [{"path": p, "views": c} for p, c in top_path_rows],
        },
        "stores": {
            "store_views": store_event_totals.get("store_view", 0),
            "product_views": store_event_totals.get("product_view", 0),
            "add_to_cart": store_event_totals.get("add_to_cart", 0),
            "checkout_start": store_event_totals.get("checkout_start", 0),
            "unique_visitors": stores_unique_visitors,
            "devices": {d: c for d, c in stores_device_rows},
            "top_viewed": [
                {"id": sid, "name": name, "slug": slug, "views": views}
                for sid, name, slug, views in top_viewed_rows
            ],
        },
    }


# ── Suscripciones por vencer/vencidas ──────────────────────────

@router.get("/subscriptions")
async def list_subscriptions_at_risk(
    within_days: int = Query(14, ge=1, le=90),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suscripciones de pago activas que vencen dentro de `within_days` días
    (incluye las que ya vencieron y siguen marcadas como activas). Ordenadas
    por fecha de vencimiento — las más urgentes primero."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=within_days)

    filters = [
        Subscription.status == "active",
        Subscription.ends_at.is_not(None),
        Subscription.ends_at <= window_end,
    ]

    total = (
        await db.execute(select(func.count()).select_from(Subscription).where(and_(*filters)))
    ).scalar()

    result = await db.execute(
        select(Subscription)
        .options(
            selectinload(Subscription.plan),
            selectinload(Subscription.store).selectinload(Store.user),
        )
        .where(and_(*filters))
        .order_by(Subscription.ends_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    subs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit),
        "items": [
            {
                "id": sub.id,
                "store_id": sub.store.id if sub.store else None,
                "store_name": sub.store.name if sub.store else None,
                "store_slug": sub.store.slug if sub.store else None,
                "owner_email": sub.store.user.email if sub.store and sub.store.user else None,
                "owner_name": sub.store.user.full_name if sub.store and sub.store.user else None,
                "owner_phone": sub.store.user.phone if sub.store and sub.store.user else None,
                "plan_name": sub.plan.name if sub.plan else None,
                "ends_at": sub.ends_at,
                "days_left": (sub.ends_at - now).days if sub.ends_at else None,
                "expired": sub.ends_at < now if sub.ends_at else False,
                "notified": sub.expiry_notified_at is not None,
            }
            for sub in subs
        ],
    }


# ── Pagos manuales de planes (Yape directo) ──────────────────

@router.get("/plan-requests")
async def list_plan_requests(
    status: Optional[str] = Query("pending"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if status:
        filters.append(PlanPaymentRequest.status == status)

    total = (
        await db.execute(
            select(func.count()).select_from(PlanPaymentRequest).where(and_(*filters) if filters else True)
        )
    ).scalar()

    result = await db.execute(
        select(PlanPaymentRequest)
        .options(
            selectinload(PlanPaymentRequest.plan),
            selectinload(PlanPaymentRequest.store).selectinload(Store.user),
        )
        .where(and_(*filters) if filters else True)
        .order_by(PlanPaymentRequest.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    reqs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "pages": -(-total // limit),
        "items": [
            {
                "id": r.id,
                "status": r.status,
                "method": r.method,
                "amount_cents": r.amount_cents,
                "operation_number": r.operation_number,
                "payer_phone": r.payer_phone,
                "note": r.note,
                "reject_reason": r.reject_reason,
                "created_at": r.created_at,
                "reviewed_at": r.reviewed_at,
                "plan": {"id": r.plan.id, "name": r.plan.name, "slug": r.plan.slug} if r.plan else None,
                "store": {
                    "id": r.store.id,
                    "name": r.store.name,
                    "slug": r.store.slug,
                    "owner_email": r.store.user.email if r.store and r.store.user else None,
                    "owner_phone": r.store.user.phone if r.store and r.store.user else None,
                } if r.store else None,
            }
            for r in reqs
        ],
    }


@router.post("/plan-requests/{request_id}/approve")
async def approve_plan_request(
    request_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    req = (await db.execute(
        select(PlanPaymentRequest)
        .options(selectinload(PlanPaymentRequest.plan), selectinload(PlanPaymentRequest.store))
        .where(PlanPaymentRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"La solicitud ya fue {req.status}")

    now = datetime.now(timezone.utc)

    # Cancelar suscripción activa anterior. Si renueva el mismo plan antes de
    # vencer, los 30 días nuevos corren desde ends_at (no pierde lo pagado).
    old_sub = (await db.execute(
        select(Subscription).where(
            Subscription.store_id == req.store_id,
            Subscription.status.in_(["active", "trial"]),
        )
    )).scalars().first()
    base = now
    if old_sub:
        if old_sub.plan_id == req.plan_id and old_sub.ends_at and old_sub.ends_at > now:
            base = old_sub.ends_at
        old_sub.status = "cancelled"
        old_sub.cancelled_at = now

    from datetime import timedelta
    new_sub = Subscription(
        store_id=req.store_id,
        plan_id=req.plan_id,
        status="active",
        starts_at=now,
        ends_at=base + timedelta(days=30),
        payment_ref=f"yape:{req.operation_number or req.id}",
    )
    db.add(new_sub)

    if req.store:
        req.store.plan_id = req.plan_id

    req.status = "approved"
    req.reviewed_by = current_admin.id
    req.reviewed_at = now

    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=req.store_id,
        action="plan_payment.approved",
        entity="plan_payment_requests",
        entity_id=req.id,
        old_value={"status": "pending"},
        new_value={
            "status": "approved",
            "plan": req.plan.slug if req.plan else str(req.plan_id),
            "amount_cents": req.amount_cents,
            "operation_number": req.operation_number,
        },
    ))
    await db.commit()
    return {"request_id": req.id, "status": req.status, "subscription_ends_at": new_sub.ends_at}


class RejectRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/plan-requests/{request_id}/reject")
async def reject_plan_request(
    request_id: UUID,
    body: RejectRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    req = (await db.execute(
        select(PlanPaymentRequest).where(PlanPaymentRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"La solicitud ya fue {req.status}")

    req.status = "rejected"
    req.reviewed_by = current_admin.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.reject_reason = (body.reason or "").strip() or None

    db.add(AuditLog(
        user_id=current_admin.id,
        store_id=req.store_id,
        action="plan_payment.rejected",
        entity="plan_payment_requests",
        entity_id=req.id,
        old_value={"status": "pending"},
        new_value={"status": "rejected", "reason": req.reject_reason},
    ))
    await db.commit()
    return {"request_id": req.id, "status": req.status}


class ResetConfirm(BaseModel):
    confirm: str


@router.post("/reset-test-data")
async def reset_test_data(
    body: ResetConfirm,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not settings.DEBUG:
        raise HTTPException(status_code=403, detail="Reset masivo deshabilitado en producción")

    if body.confirm != "RESET":
        raise HTTPException(status_code=400, detail="Confirmación inválida. Envía { confirm: 'RESET' }")

    # Contar antes de borrar
    total_orders = (await db.execute(select(func.count()).select_from(Order))).scalar()
    total_stores = (await db.execute(select(func.count()).select_from(Store))).scalar()

    admin_role_id = (
        await db.execute(select(Role.id).where(Role.name == "admin"))
    ).scalar_one()
    total_users = (
        await db.execute(
            select(func.count()).select_from(User).where(User.role_id != admin_role_id)
        )
    ).scalar()

    # Borrar en orden correcto respetando FK constraints
    # 1. Payments no tienen ondelete en orders.id → borrar primero
    await db.execute(sql_delete(Payment))
    # 2. Orders → cascada a order_items y deliveries (ondelete=CASCADE en DB)
    await db.execute(sql_delete(Order))
    # 3. Stores → cascada a store_settings, categories, products, product_images, subscriptions
    await db.execute(sql_delete(Store))
    # 4. Usuarios no-admin
    await db.execute(sql_delete(User).where(User.role_id != admin_role_id))

    await db.commit()

    return {
        "deleted": {
            "orders": total_orders,
            "stores": total_stores,
            "users": total_users,
        }
    }


# ── Anuncios (nueva función / nuevo plan) ──────────────────────

class BroadcastRequest(BaseModel):
    title: str
    body: str
    action_url: Optional[str] = None
    plan_id: Optional[UUID] = None  # None = todas las tiendas activas


@router.post("/notifications/broadcast")
async def broadcast_notification(
    payload: BroadcastRequest,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Envía un anuncio (nueva función, nuevo plan, etc.) a todas las tiendas
    o a las de un plan específico. Fire-and-forget, igual que los demás hitos."""
    import asyncio
    from app.services.notifications import emit_event

    filters = [Store.status == "active", Store.deleted_at.is_(None)]
    if payload.plan_id:
        filters.append(Store.plan_id == payload.plan_id)

    store_ids = (await db.execute(select(Store.id).where(*filters))).scalars().all()

    extra_ctx = {"title": payload.title, "body": payload.body}
    if payload.action_url:
        extra_ctx["action_url"] = payload.action_url

    for store_id in store_ids:
        asyncio.ensure_future(emit_event(str(store_id), "announcement", **extra_ctx))

    return {"targeted_stores": len(store_ids)}


# ── Banners rotatorios del Mall (/tiendas) ──────────────────────

MAX_MALL_BANNERS = 6


@router.get("/mall-banners")
async def list_mall_banners(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MallBanner).order_by(MallBanner.sort_order))
    return {
        "banners": [
            {"id": b.id, "image_url": b.image_url, "link_url": b.link_url}
            for b in result.scalars().all()
        ]
    }


@router.put("/mall-banners")
async def update_mall_banners(
    payload: BannersUpdate,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reemplaza la lista completa de banners del Mall — mismo patrón que
    PUT /stores/me/banners (borra y recrea en el orden recibido)."""
    if len(payload.banners) > MAX_MALL_BANNERS:
        raise HTTPException(
            status_code=422,
            detail=f"Máximo {MAX_MALL_BANNERS} banners.",
        )

    await db.execute(sql_delete(MallBanner))
    for i, b in enumerate(payload.banners):
        db.add(MallBanner(image_url=b.image_url, link_url=b.link_url, sort_order=i))

    db.add(AuditLog(
        user_id=current_admin.id,
        action="mall_banners.updated",
        entity="mall_banners",
        new_value={"count": len(payload.banners)},
    ))

    await db.commit()
    return {"updated": True, "count": len(payload.banners)}


# ── Moderación de reseñas ────────────────────────────────────────

@router.get("/reviews")
async def list_reviews(
    q: Optional[str] = Query(None, description="Nombre/slug de tienda o texto de la reseña"),
    rating: Optional[int] = Query(None, ge=1, le=5),
    hidden: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if rating:
        filters.append(Review.rating == rating)
    if hidden is not None:
        filters.append(Review.hidden_at.is_not(None) if hidden else Review.hidden_at.is_(None))
    if q:
        like = f"%{q}%"
        filters.append(or_(Store.name.ilike(like), Store.slug.ilike(like), Review.comment.ilike(like)))

    base = select(Review, Store, Order.buyer_name).join(Store, Store.id == Review.store_id).join(Order, Order.id == Review.order_id)
    if filters:
        base = base.where(and_(*filters))

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar()

    result = await db.execute(
        base.order_by(Review.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": -(-total // limit) if total else 0,
        "items": [
            {
                "id": review.id,
                "rating": review.rating,
                "comment": review.comment,
                "photo_urls": review.photo_urls or [],
                "buyer_name": buyer_name,
                "store_name": store.name,
                "store_slug": store.slug,
                "created_at": review.created_at,
                "hidden_at": review.hidden_at,
            }
            for review, store, buyer_name in result.all()
        ],
    }


@router.post("/reviews/{review_id}/hide")
async def hide_review(
    review_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    review = (await db.execute(select(Review).where(Review.id == review_id))).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    review.hidden_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_admin.id, action="review.hidden", entity="review", entity_id=review.id,
    ))
    await db.commit()
    return {"hidden": True}


@router.post("/reviews/{review_id}/unhide")
async def unhide_review(
    review_id: UUID,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    review = (await db.execute(select(Review).where(Review.id == review_id))).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    review.hidden_at = None
    db.add(AuditLog(
        user_id=current_admin.id, action="review.unhidden", entity="review", entity_id=review.id,
    ))
    await db.commit()
    return {"hidden": False}
