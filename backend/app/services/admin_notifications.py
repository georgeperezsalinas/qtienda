"""Notificaciones globales del admin — inbox compartido, sin push/email
(el admin ya revisa el panel seguido; la campanita alcanza). Fire-and-forget,
mismo patrón que app/services/notifications.py."""
import logging

from app.db.session import AsyncSessionLocal
from app.models.models import AdminNotification

log = logging.getLogger("qtienda")


async def notify_admins(type: str, title: str, body: str, icon: str | None = None, action_url: str | None = None) -> None:
    async with AsyncSessionLocal() as db:
        try:
            db.add(AdminNotification(
                type=type,
                title=title,
                body=body,
                icon=icon,
                action_url=action_url,
            ))
            await db.commit()
        except Exception:
            log.exception("[admin_notifications] error creando notificación %s", type)
