"""Recordatorio de cita próxima — avisa al vendedor (push real, vía el
sistema de notificaciones ya existente) cuando una cita confirmada ocurre
dentro de la ventana configurada. Mismo patrón que review_reminder.py /
abandoned_cart_watcher.py (loop en el lifespan, dedupe por columna en la fila).

Esto es 100% automático porque es hacia el VENDEDOR (ya tiene push
registrado) — no manda nada al paciente, eso requeriría integración con
WhatsApp Business API que este proyecto no tiene (solo deep links wa.me que
requieren que el vendedor haga clic).
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import Appointment
from app.services.notifications import emit_event

logger = logging.getLogger(__name__)


async def send_appointment_reminders() -> int:
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=settings.APPOINTMENT_REMINDER_WINDOW_HOURS)

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Appointment)
            .options(selectinload(Appointment.service))
            .where(
                Appointment.status == "confirmed",
                Appointment.scheduled_at > now,
                Appointment.scheduled_at <= window_end,
                Appointment.reminder_sent_at.is_(None),
            )
        )).scalars().all()

        sent = 0
        for appt in rows:
            appt.reminder_sent_at = now
            try:
                asyncio.ensure_future(emit_event(
                    str(appt.store_id), "appointment_reminder",
                    patient_name=appt.patient_name,
                    service_name=appt.service.name if appt.service else "",
                    scheduled_at=appt.scheduled_at.strftime("%d/%m %H:%M"),
                ))
                sent += 1
            except Exception:
                logger.exception("Error armando recordatorio de cita %s", appt.id)

        await db.commit()

    return sent


async def appointment_reminder_watcher() -> None:
    """Corre dentro del lifespan del backend; revisa periódicamente."""
    await asyncio.sleep(60)  # dejar terminar el arranque
    while True:
        try:
            n = await send_appointment_reminders()
            if n:
                logger.info("Recordatorios de cita enviados: %d", n)
        except Exception:
            logger.exception("Fallo el chequeo de recordatorios de cita")
        await asyncio.sleep(settings.APPOINTMENT_REMINDER_CHECK_MINUTES * 60)
