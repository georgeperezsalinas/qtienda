"""Admin endpoints — require admin role."""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete as sql_delete, func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import require_admin
from app.models.models import AuditLog, Order, Payment, Role, Store, User

router = APIRouter()


@router.get("/stores")
async def list_stores(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = [Store.deleted_at.is_(None)]
    if status:
        filters.append(Store.status == status)

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
                "city": s.city,
                "created_at": s.created_at,
                "owner_email": s.user.email if s.user else None,
                "owner_name": s.user.full_name if s.user else None,
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

    return {
        "id": store.id,
        "slug": store.slug,
        "name": store.name,
        "status": store.status,
        "city": store.city,
        "country": store.country,
        "whatsapp": store.whatsapp,
        "created_at": store.created_at,
        "deleted_at": store.deleted_at,
        "owner": {
            "id": store.user.id,
            "email": store.user.email,
            "full_name": store.user.full_name,
            "phone": store.user.phone,
            "is_active": store.user.is_active,
        } if store.user else None,
        "order_count": order_count,
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

    total_users = (
        await db.execute(
            select(func.count()).select_from(User).where(User.deleted_at.is_(None))
        )
    ).scalar()

    from sqlalchemy import extract
    monthly_orders = (
        await db.execute(
            select(func.count()).select_from(Order).where(
                extract("month", Order.created_at) == now.month,
                extract("year", Order.created_at) == now.year,
            )
        )
    ).scalar()

    monthly_revenue = (
        await db.execute(
            select(func.coalesce(func.sum(Order.total_cents), 0)).where(
                Order.status != "cancelled",
                extract("month", Order.created_at) == now.month,
                extract("year", Order.created_at) == now.year,
            )
        )
    ).scalar()

    return {
        "stores": {"total": total_stores, "active": active_stores},
        "users": {"total": total_users},
        "this_month": {
            "orders": monthly_orders,
            "revenue_cents": monthly_revenue,
        },
    }


class ResetConfirm(BaseModel):
    confirm: str


@router.post("/reset-test-data")
async def reset_test_data(
    body: ResetConfirm,
    current_admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
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
