"""Admin endpoints — require admin role."""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_admin
from app.models.models import (
    AuditLog, Order, Payment, Plan, PlanPaymentRequest, Product, Role, Store,
    Subscription, User,
)

router = APIRouter()


@router.get("/stores")
async def list_stores(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    is_test: Optional[bool] = Query(None),
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

    result = await db.execute(
        select(Store)
        .options(selectinload(Store.user))
        .where(and_(*filters))
        .order_by(Store.created_at.desc())
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
                "created_at": s.created_at,
                "owner_email": s.user.email if s.user else None,
                "owner_name": s.user.full_name if s.user else None,
                "owner_phone": s.user.phone if s.user else None,
                "products_count": product_counts.get(s.id, 0),
                "orders_count": order_counts.get(s.id, 0),
                "revenue_cents": revenue_by_store.get(s.id, 0),
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
            "reason": body.reason,
        },
    ))
    await db.commit()
    return {"store_id": store.id, "deleted_at": store.deleted_at, "status": store.status}


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


@router.get("/metrics")
async def global_metrics(
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

    test_stores = (
        await db.execute(
            select(func.count()).select_from(Store).where(
                Store.is_test.is_(True), Store.deleted_at.is_(None)
            )
        )
    ).scalar()

    total_users = (
        await db.execute(
            select(func.count()).select_from(User).where(User.deleted_at.is_(None))
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

    return {
        "stores": {"total": total_stores, "active": active_stores, "test": test_stores},
        "users": {"total": total_users},
        "this_month": {
            "orders": monthly_orders,
            "revenue_cents": monthly_revenue,
        },
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

    # Cancelar suscripción activa anterior
    old_sub = (await db.execute(
        select(Subscription).where(
            Subscription.store_id == req.store_id,
            Subscription.status.in_(["active", "trial"]),
        )
    )).scalars().first()
    if old_sub:
        old_sub.status = "cancelled"
        old_sub.cancelled_at = now

    from datetime import timedelta
    new_sub = Subscription(
        store_id=req.store_id,
        plan_id=req.plan_id,
        status="active",
        starts_at=now,
        ends_at=now + timedelta(days=30),
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
