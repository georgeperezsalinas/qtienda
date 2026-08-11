"""Recordatorio de reseña — antes calificar un pedido era 100% pasivo (el
comprador solo lo hacía si entraba por su cuenta a Mis Pedidos). Este watcher
le manda un correo una vez, un tiempo después de que su pedido fue entregado,
invitándolo a calificar — mismo patrón que store_health_watcher/plan_expiry
(loop en el lifespan del backend, dedupe por columna en la fila).

Solo alcanza a compradores con cuenta registrada (se busca por email, ya que
calificar requiere sesión iniciada) — un pedido de invitado sin cuenta no
tiene forma de dejar una reseña, así que no tiene sentido recordárselo.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import Order, Review, User
from app.services.email import send_notification_email

logger = logging.getLogger(__name__)


async def send_review_reminders() -> int:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=settings.REVIEW_REMINDER_DELAY_HOURS)
    too_old = now - timedelta(days=settings.REVIEW_REMINDER_MAX_AGE_DAYS)

    async with AsyncSessionLocal() as db:
        reviewed_subq = select(Review.order_id)

        rows = (await db.execute(
            select(Order, User)
            .join(User, func.lower(User.email) == func.lower(Order.buyer_email))
            .where(
                Order.status == "delivered",
                Order.delivered_at.is_not(None),
                Order.delivered_at <= cutoff,
                Order.review_reminder_sent_at.is_(None),
                Order.buyer_email.is_not(None),
                Order.id.not_in(reviewed_subq),
            )
        )).all()

        sent = 0
        for order, user in rows:
            order.review_reminder_sent_at = now
            if order.delivered_at < too_old:
                continue  # marca como "ya procesado" sin mandar nada — es muy viejo
            try:
                await send_notification_email(
                    to_email=user.email,
                    full_name=user.full_name or "",
                    icon="⭐",
                    title="¿Cómo te fue con tu pedido?",
                    body=(
                        f"Tu pedido #{order.order_number} ya fue entregado. "
                        "Cuéntanos cómo te fue — te toma menos de un minuto y ayuda "
                        "a otros compradores a confiar en la tienda."
                    ),
                    cta_url="https://qtienda.shop/mis-pedidos",
                    cta_label="Calificar mi pedido",
                )
                sent += 1
            except Exception:
                logger.exception("Error enviando recordatorio de reseña para pedido %s", order.id)

        await db.commit()

    return sent


async def review_reminder_watcher() -> None:
    """Corre dentro del lifespan del backend; revisa periódicamente."""
    await asyncio.sleep(60)  # dejar terminar el arranque
    while True:
        try:
            n = await send_review_reminders()
            if n:
                logger.info("Recordatorios de reseña enviados: %d", n)
        except Exception:
            logger.exception("Fallo el chequeo de recordatorios de reseña")
        await asyncio.sleep(settings.REVIEW_REMINDER_CHECK_HOURS * 3600)
