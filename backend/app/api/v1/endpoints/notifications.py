"""Notificaciones del vendedor: inbox de hitos/eventos + progreso de onboarding."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import Notification, Product, Store

router = APIRouter()


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


def _serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "icon": n.icon,
        "action_url": n.action_url,
        "read": n.read_at is not None,
        "created_at": n.created_at,
    }


@router.get("/")
async def list_notifications(
    limit: int = Query(20, le=50),
    before_id: Optional[int] = Query(None),
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)

    filters = [Notification.store_id == store.id]
    if before_id:
        filters.append(Notification.id < before_id)

    items = (await db.execute(
        select(Notification)
        .where(*filters)
        .order_by(Notification.id.desc())
        .limit(limit)
    )).scalars().all()

    unread_count = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.store_id == store.id, Notification.read_at.is_(None)
        )
    )).scalar()

    return {
        "items": [_serialize(n) for n in items],
        "unread_count": unread_count,
    }


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)

    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.store_id == store.id
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")

    if notif.read_at is None:
        notif.read_at = datetime.now(timezone.utc)
        await db.commit()

    return _serialize(notif)


@router.post("/read-all")
async def mark_all_read(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    now = datetime.now(timezone.utc)

    unread = (await db.execute(
        select(Notification).where(
            Notification.store_id == store.id, Notification.read_at.is_(None)
        )
    )).scalars().all()
    for n in unread:
        n.read_at = now
    await db.commit()

    return {"marked_read": len(unread)}


@router.get("/onboarding-progress")
async def onboarding_progress(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """Progreso de onboarding calculado en vivo — no se guarda estado aparte
    para que nunca se desincronice con la tienda real."""
    store = await _get_store(current_user, db)

    products_count = (await db.execute(
        select(func.count()).select_from(Product).where(
            Product.store_id == store.id, Product.deleted_at.is_(None)
        )
    )).scalar()

    products_target = 5
    return {
        "store_created": True,
        "logo_added": bool(store.logo_url),
        "products_count": products_count,
        "products_target": products_target,
        "shared": store.shared_at is not None,
        "complete": bool(store.logo_url) and products_count >= products_target and store.shared_at is not None,
    }
