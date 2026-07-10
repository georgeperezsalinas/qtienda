from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import require_vendor
from app.db.session import get_db
from app.models.models import Plan, PlanPaymentRequest, Store, Subscription
from app.services import culqi as culqi_svc

router = APIRouter()


class SubscribeRequest(BaseModel):
    culqi_token: str


class YapeRequestBody(BaseModel):
    operation_number: str
    payer_phone: Optional[str] = None
    note: Optional[str] = None


def _payment_request_out(req: PlanPaymentRequest) -> dict:
    return {
        "id": str(req.id),
        "plan_id": str(req.plan_id),
        "plan_name": req.plan.name if req.plan else None,
        "plan_slug": req.plan.slug if req.plan else None,
        "method": req.method,
        "amount_cents": req.amount_cents,
        "operation_number": req.operation_number,
        "status": req.status,
        "reject_reason": req.reject_reason,
        "created_at": req.created_at,
        "reviewed_at": req.reviewed_at,
    }


def _sub_out(sub: Subscription) -> dict:
    return {
        "id": str(sub.id),
        "plan_id": str(sub.plan_id),
        "plan_slug": sub.plan.slug if sub.plan else None,
        "plan_name": sub.plan.name if sub.plan else None,
        "status": sub.status,
        "starts_at": sub.starts_at,
        "ends_at": sub.ends_at,
        "trial_ends_at": sub.trial_ends_at,
        "cancelled_at": sub.cancelled_at,
        "max_orders_mo": sub.plan.max_orders_mo if sub.plan else None,
        "max_products": sub.plan.max_products if sub.plan else None,
    }


@router.get("/")
async def list_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.price_cents)
    )
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "price_cents": p.price_cents,
            "currency": p.currency,
            "interval": p.interval,
            "max_products": p.max_products,
            "max_orders_mo": p.max_orders_mo,
            "features": p.features,
        }
        for p in plans
    ]


@router.get("/payment-info")
async def payment_info():
    """Datos para pagar un plan con Yape directo (sin pasarela)."""
    return {
        "yape_phone": settings.YAPE_PAYMENT_PHONE,
        "yape_name": settings.YAPE_PAYMENT_NAME,
    }


@router.post("/{plan_id}/yape-request", status_code=201)
async def create_yape_request(
    plan_id: UUID,
    body: YapeRequestBody,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    """El vendedor ya yapeó: registra el nº de operación para que admin apruebe."""
    plan = (await db.execute(
        select(Plan).where(Plan.id == plan_id, Plan.is_active.is_(True))
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    if plan.slug == settings.FREE_PLAN_SLUG:
        raise HTTPException(status_code=400, detail="El plan gratuito no requiere pago")

    operation = body.operation_number.strip()
    if not operation:
        raise HTTPException(status_code=422, detail="Ingresa el número de operación de tu Yape")

    store = await _get_store(current_user, db)

    pending = (await db.execute(
        select(PlanPaymentRequest).where(
            PlanPaymentRequest.store_id == store.id,
            PlanPaymentRequest.status == "pending",
        )
    )).scalars().first()
    if pending:
        raise HTTPException(
            status_code=409,
            detail="Ya tienes un pago en verificación. Te avisaremos al confirmarlo.",
        )

    req = PlanPaymentRequest(
        store_id=store.id,
        plan_id=plan.id,
        method="yape",
        amount_cents=plan.price_cents,
        operation_number=operation[:40],
        payer_phone=(body.payer_phone or "").strip()[:20] or None,
        note=(body.note or "").strip() or None,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    await db.refresh(req, ["plan"])
    return _payment_request_out(req)


@router.get("/yape-request/latest")
async def latest_yape_request(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    req = (await db.execute(
        select(PlanPaymentRequest)
        .options(selectinload(PlanPaymentRequest.plan))
        .where(PlanPaymentRequest.store_id == store.id)
        .order_by(PlanPaymentRequest.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Sin solicitudes de pago")
    return _payment_request_out(req)


@router.get("/my-subscription")
async def my_subscription(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    sub = await _active_sub(store.id, db)
    if not sub:
        raise HTTPException(status_code=404, detail="Sin suscripción activa")
    return _sub_out(sub)


@router.post("/{plan_id}/subscribe", status_code=201)
async def subscribe(
    plan_id: UUID,
    body: SubscribeRequest,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    plan = (await db.execute(
        select(Plan).where(Plan.id == plan_id, Plan.is_active.is_(True))
    )).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    if plan.slug == settings.FREE_PLAN_SLUG:
        raise HTTPException(status_code=400, detail="El plan gratuito no requiere pago")

    store = await _get_store(current_user, db)

    # Cobrar con Culqi
    try:
        charge = await culqi_svc.create_charge(
            token_id=body.culqi_token,
            amount_cents=plan.price_cents,
            email=current_user.email,
            description=f"{plan.name} - qtienda.shop",
        )
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    charge_id: str = charge.get("id", "")

    # Cancelar suscripción anterior
    old_sub = await _active_sub(store.id, db)
    if old_sub:
        old_sub.status = "cancelled"
        old_sub.cancelled_at = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    new_sub = Subscription(
        store_id=store.id,
        plan_id=plan.id,
        status="active",
        starts_at=now,
        ends_at=now + timedelta(days=30),
        payment_ref=charge_id,
    )
    db.add(new_sub)

    # Actualizar plan en tienda
    store.plan_id = plan.id

    await db.commit()
    await db.refresh(new_sub)
    await db.refresh(new_sub, ["plan"])

    return _sub_out(new_sub)


@router.delete("/my-subscription", status_code=200)
async def cancel_subscription(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    sub = await _active_sub(store.id, db)
    if not sub:
        raise HTTPException(status_code=404, detail="Sin suscripción activa")

    sub.status = "cancelled"
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    return {"cancelled": True, "ends_at": sub.ends_at}


# ── Helpers ───────────────────────────────────────────────────

async def _get_store(user, db: AsyncSession) -> Store:
    store = (await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda")
    return store


async def _active_sub(store_id: UUID, db: AsyncSession):
    return (await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.store_id == store_id,
            Subscription.status.in_(["active", "trial"]),
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()
