from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import require_vendor
from app.db.session import get_db
from app.models.models import Plan, PlanPaymentRequest, Product, Store, Subscription
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

    import asyncio
    from app.services.admin_notifications import notify_admins
    asyncio.ensure_future(notify_admins(
        "yape_payment_pending",
        "Pago Yape por aprobar",
        f"{store.name} ({store.slug}) pagó el plan {plan.name} — S/ {plan.price_cents / 100:.2f}, operación {operation}.",
        icon="💳",
        action_url="/admin/pagos",
    ))

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
    hidden_products = (await db.execute(
        select(func.count()).select_from(Product).where(
            Product.store_id == store.id,
            Product.deleted_at.is_(None),
            Product.hidden_by_plan_at.is_not(None),
        )
    )).scalar()

    sub = await _active_sub(store.id, db)
    if sub:
        out = _sub_out(sub)
        out["hidden_products_count"] = hidden_products
        return out

    # _active_sub() excluye a propósito las suscripciones ya vencidas (para
    # límites/renovación ya no cuentan) — pero el vendedor SÍ debe verla
    # mientras está en el período de gracia, antes de que el watcher la baje
    # a plan gratuito (ver app.services.plan_expiry.downgrade_expired_subscriptions).
    now = datetime.now(timezone.utc)
    overdue_sub = (await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.store_id == store.id,
            Subscription.status == "active",
            Subscription.ends_at.is_not(None),
            Subscription.ends_at <= now,
        )
        .order_by(Subscription.ends_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    if overdue_sub:
        out = _sub_out(overdue_sub)
        grace_deadline = overdue_sub.ends_at + timedelta(days=settings.PLAN_EXPIRY_GRACE_DAYS)
        out["overdue"] = True
        out["grace_days_left"] = max(0, (grace_deadline - now).days)
        out["hidden_products_count"] = hidden_products
        return out

    if hidden_products:
        return {"plan_slug": "free", "plan_name": "Gratis", "hidden_products_count": hidden_products}

    raise HTTPException(status_code=404, detail="Sin suscripción activa")


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

    now = datetime.now(timezone.utc)

    # Cancelar suscripción anterior. Si renueva el mismo plan antes de vencer,
    # los días restantes se suman (los 30 nuevos corren desde ends_at).
    old_sub = await _active_sub(store.id, db)
    base = now
    if old_sub:
        if old_sub.plan_id == plan.id and old_sub.ends_at and old_sub.ends_at > now:
            base = old_sub.ends_at
        old_sub.status = "cancelled"
        old_sub.cancelled_at = now

    new_sub = Subscription(
        store_id=store.id,
        plan_id=plan.id,
        status="active",
        starts_at=now,
        ends_at=base + timedelta(days=30),
        payment_ref=charge_id,
    )
    db.add(new_sub)

    # Actualizar plan en tienda y reactivar (si alcanza) los productos que se
    # habían ocultado por un downgrade anterior — ver apply_plan_product_limit().
    store.plan_id = plan.id
    from app.services.plan_expiry import apply_plan_product_limit
    await apply_plan_product_limit(store, plan, db)

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
    # Una suscripción con ends_at pasado ya no cuenta: la tienda vuelve a free
    return (await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.store_id == store_id,
            Subscription.status.in_(["active", "trial"]),
            or_(
                Subscription.ends_at.is_(None),
                Subscription.ends_at > datetime.now(timezone.utc),
            ),
        )
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()
