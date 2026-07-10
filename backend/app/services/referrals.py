"""Referidos: bonus de límites del plan free por invitar usuarios que crean tienda."""
import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import Store, User

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin 0/O/1/I para evitar confusión


def generate_referral_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


async def ensure_referral_code(user: User, db: AsyncSession) -> str:
    """Devuelve el código del usuario, generándolo si aún no tiene (commit a cargo del caller)."""
    if user.referral_code:
        return user.referral_code
    for _ in range(5):
        code = generate_referral_code()
        exists = (await db.execute(
            select(User.id).where(User.referral_code == code)
        )).scalar_one_or_none()
        if not exists:
            user.referral_code = code
            return code
    raise RuntimeError("No se pudo generar un código de referido único")


async def count_referrals_with_store(user_id, db: AsyncSession) -> int:
    """Referidos activos que ya crearon su tienda (los que otorgan bonus)."""
    return (await db.execute(
        select(func.count(func.distinct(User.id)))
        .join(Store, Store.user_id == User.id)
        .where(
            User.referred_by_user_id == user_id,
            User.deleted_at.is_(None),
            Store.deleted_at.is_(None),
        )
    )).scalar() or 0


async def referral_bonus(user_id, db: AsyncSession) -> dict:
    """Bonus vigente: +productos y +pedidos/mes, con tope de referidos contables."""
    referred = await count_referrals_with_store(user_id, db)
    counted = min(referred, settings.REFERRAL_MAX_REFERRALS)
    return {
        "referred_with_store": referred,
        "counted": counted,
        "max_referrals": settings.REFERRAL_MAX_REFERRALS,
        "extra_products": counted * settings.REFERRAL_BONUS_PRODUCTS,
        "extra_orders": counted * settings.REFERRAL_BONUS_ORDERS,
        "bonus_per_referral": {
            "products": settings.REFERRAL_BONUS_PRODUCTS,
            "orders": settings.REFERRAL_BONUS_ORDERS,
        },
    }
