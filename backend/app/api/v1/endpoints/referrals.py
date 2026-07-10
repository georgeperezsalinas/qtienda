"""Referidos del vendedor: código propio, progreso y bonus de límites."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import require_vendor
from app.db.session import get_db
from app.models.models import Plan, Store, Subscription
from app.services.referrals import ensure_referral_code, referral_bonus

router = APIRouter()


@router.get("/me")
async def my_referrals(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    code = await ensure_referral_code(current_user, db)
    await db.commit()

    bonus = await referral_bonus(current_user.id, db)

    # Plan actual (para calcular límites efectivos; el bonus solo aplica al free)
    store = (await db.execute(
        select(Store).where(Store.user_id == current_user.id, Store.deleted_at.is_(None))
    )).scalar_one_or_none()

    plan = None
    if store:
        sub = (await db.execute(
            select(Subscription)
            .options(selectinload(Subscription.plan))
            .where(
                Subscription.store_id == store.id,
                Subscription.status.in_(["active", "trial"]),
            )
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()
        plan = sub.plan if sub else None
        if plan is None and store.plan_id:
            plan = (await db.execute(
                select(Plan).where(Plan.id == store.plan_id)
            )).scalar_one_or_none()

    is_free = plan is None or plan.slug == settings.FREE_PLAN_SLUG
    base_products = plan.max_products if plan else 10
    base_orders = plan.max_orders_mo if plan else 500

    return {
        "code": code,
        "share_url": f"{settings.APP_URL}/auth/register?ref={code}",
        "plan_slug": plan.slug if plan else settings.FREE_PLAN_SLUG,
        "bonus_applies": is_free,
        **bonus,
        "effective_limits": {
            "max_products": (base_products + bonus["extra_products"]) if (is_free and base_products) else base_products,
            "max_orders_mo": (base_orders + bonus["extra_orders"]) if (is_free and base_orders) else base_orders,
        },
    }
