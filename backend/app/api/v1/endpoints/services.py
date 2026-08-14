"""Servicios con cita — CRUD del vendedor, configuración de horario, bloqueos
puntuales y gestión de citas. Mismo patrón de auth/scoping que products.py."""
from datetime import datetime, date as date_cls, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import (
    Appointment, AvailabilityException, Service, Store, StoreSettings,
)
from app.schemas.auth import (
    AppointmentStatusUpdate, AvailabilityExceptionCreate, ServiceCreate, ServiceUpdate,
)

router = APIRouter()


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


def _service_out(s: Service) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "duration_minutes": s.duration_minutes,
        "price_cents": s.price_cents,
        "is_active": s.is_active,
        "sort_order": s.sort_order,
        "image_url": s.image_url,
        "created_at": s.created_at,
    }


def _appointment_out(a: Appointment) -> dict:
    return {
        "id": a.id,
        "service_id": a.service_id,
        "service_name": a.service.name if a.service else None,
        "patient_name": a.patient_name,
        "patient_phone": a.patient_phone,
        "patient_email": a.patient_email,
        "scheduled_at": a.scheduled_at,
        "duration_minutes": a.duration_minutes,
        "status": a.status,
        "notes": a.notes,
        "cancel_reason": a.cancel_reason,
        "created_at": a.created_at,
    }


# ── Servicios ─────────────────────────────────────────────────────

@router.get("/")
async def list_services(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Service).where(Service.store_id == store.id)
        .order_by(Service.sort_order, Service.created_at)
    )
    return [_service_out(s) for s in result.scalars().all()]


@router.post("/", status_code=201)
async def create_service(
    body: ServiceCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    service = Service(store_id=store.id, **body.model_dump())
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return _service_out(service)


# ── Configuración de horario ──────────────────────────────────────

@router.get("/appointment-settings")
async def get_appointment_settings(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    settings = (await db.execute(
        select(StoreSettings).where(StoreSettings.store_id == store.id)
    )).scalar_one_or_none()
    return {
        "appointment_hours": settings.appointment_hours if settings else {},
        "appointments_auto_confirm": settings.appointments_auto_confirm if settings else True,
    }


@router.patch("/appointment-settings")
async def update_appointment_settings(
    body: dict,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    settings = (await db.execute(
        select(StoreSettings).where(StoreSettings.store_id == store.id)
    )).scalar_one_or_none()
    if not settings:
        settings = StoreSettings(store_id=store.id)
        db.add(settings)
    if "appointment_hours" in body:
        settings.appointment_hours = body["appointment_hours"]
    if "appointments_auto_confirm" in body:
        settings.appointments_auto_confirm = bool(body["appointments_auto_confirm"])
    await db.commit()
    return {
        "appointment_hours": settings.appointment_hours,
        "appointments_auto_confirm": settings.appointments_auto_confirm,
    }


# ── Bloqueos puntuales ─────────────────────────────────────────────

@router.get("/availability-exceptions")
async def list_availability_exceptions(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(AvailabilityException)
        .where(AvailabilityException.store_id == store.id, AvailabilityException.date >= date_cls.today())
        .order_by(AvailabilityException.date)
    )
    return [
        {
            "id": e.id, "date": e.date, "start_time": e.start_time,
            "end_time": e.end_time, "reason": e.reason,
        }
        for e in result.scalars().all()
    ]


@router.post("/availability-exceptions", status_code=201)
async def create_availability_exception(
    body: AvailabilityExceptionCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    try:
        parsed_date = date_cls.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida")
    exc = AvailabilityException(
        store_id=store.id, date=parsed_date,
        start_time=body.start_time, end_time=body.end_time, reason=body.reason,
    )
    db.add(exc)
    await db.commit()
    await db.refresh(exc)
    return {"id": exc.id, "date": exc.date, "start_time": exc.start_time, "end_time": exc.end_time, "reason": exc.reason}


@router.delete("/availability-exceptions/{exception_id}")
async def delete_availability_exception(
    exception_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    exc = (await db.execute(
        select(AvailabilityException).where(
            AvailabilityException.id == exception_id, AvailabilityException.store_id == store.id,
        )
    )).scalar_one_or_none()
    if not exc:
        raise HTTPException(status_code=404, detail="No encontrado")
    await db.delete(exc)
    await db.commit()
    return {"ok": True}


# ── Citas ──────────────────────────────────────────────────────────

@router.get("/appointments")
async def list_appointments(
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None, description="YYYY-MM-DD — filtra solo ese día"),
    today: bool = Query(False),
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    filters = [Appointment.store_id == store.id]
    if status:
        filters.append(Appointment.status == status)

    target_date = None
    if today:
        target_date = date_cls.today()
    elif date:
        try:
            target_date = date_cls.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=422, detail="Fecha inválida")
    if target_date:
        start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        filters.append(Appointment.scheduled_at >= start)
        filters.append(Appointment.scheduled_at < end)

    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.service))
        .where(and_(*filters))
        .order_by(Appointment.scheduled_at)
    )
    return [_appointment_out(a) for a in result.scalars().all()]


@router.patch("/appointments/{appointment_id}")
async def update_appointment(
    appointment_id: UUID,
    body: AppointmentStatusUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    appt = (await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.service))
        .where(Appointment.id == appointment_id, Appointment.store_id == store.id)
    )).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    appt.status = body.status
    if body.notes is not None:
        appt.notes = body.notes
    if body.status == "cancelled":
        appt.cancelled_at = datetime.now(timezone.utc)
        appt.cancel_reason = body.cancel_reason
    await db.commit()
    await db.refresh(appt)
    return _appointment_out(appt)


# ── Servicio individual — registrado AL FINAL a propósito: "{service_id}"
#    es un comodín de un solo segmento que, si va antes, intercepta rutas
#    fijas como /appointment-settings (FastAPI matchea en orden de registro,
#    "appointment-settings" terminaba pasando como service_id → 422). ──

@router.patch("/{service_id}")
async def update_service(
    service_id: UUID,
    body: ServiceUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    service = (await db.execute(
        select(Service).where(Service.id == service_id, Service.store_id == store.id)
    )).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(service, k, v)
    await db.commit()
    await db.refresh(service)
    return _service_out(service)


@router.delete("/{service_id}")
async def delete_service(
    service_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    service = (await db.execute(
        select(Service).where(Service.id == service_id, Service.store_id == store.id)
    )).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    # Soft: solo se desactiva — no se borra físicamente, porque citas viejas
    # referencian este servicio (ON DELETE RESTRICT en la FK a propósito).
    service.is_active = False
    await db.commit()
    return {"ok": True}
