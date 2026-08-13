"""Inbox global de notificaciones del admin — eventos que requieren su
atención (reactivación solicitada, reclamo nuevo, pago Yape pendiente).
Sin store_id: mismo endpoint para todos los admins."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_admin
from app.models.models import AdminNotification

router = APIRouter()


def _serialize(n: AdminNotification) -> dict:
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
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if before_id:
        filters.append(AdminNotification.id < before_id)

    items = (await db.execute(
        select(AdminNotification)
        .where(*filters)
        .order_by(AdminNotification.id.desc())
        .limit(limit)
    )).scalars().all()

    unread_count = (await db.execute(
        select(func.count()).select_from(AdminNotification).where(AdminNotification.read_at.is_(None))
    )).scalar()

    return {
        "items": [_serialize(n) for n in items],
        "unread_count": unread_count,
    }


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminNotification).where(AdminNotification.id == notification_id))
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")

    if notif.read_at is None:
        notif.read_at = datetime.now(timezone.utc)
        await db.commit()

    return _serialize(notif)


@router.post("/read-all")
async def mark_all_read(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    unread = (await db.execute(
        select(AdminNotification).where(AdminNotification.read_at.is_(None))
    )).scalars().all()
    for n in unread:
        n.read_at = now
    await db.commit()

    return {"marked_read": len(unread)}
