"""
Buyer endpoints — authenticated buyer order history and favorites.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import User, Order, Product, Store, Favorite
from app.core.security import get_current_user

router = APIRouter()


@router.get("/orders")
async def get_buyer_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all orders placed by the authenticated buyer (matched by email)."""
    if not current_user.email:
        return []

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.store))
        .where(Order.buyer_email == current_user.email)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    return [
        {
            "order_number": o.order_number,
            "status": o.status,
            "total_cents": o.total_cents,
            "created_at": o.created_at,
            "store_name": o.store.name if o.store else None,
            "store_slug": o.store.slug if o.store else None,
            "store_logo_url": o.store.logo_url if o.store else None,
            "store_color": o.store.primary_color if o.store else "#6366f1",
            "items_count": len(o.items),
        }
        for o in orders
    ]


@router.get("/orders/{order_number}")
async def get_buyer_order_detail(
    order_number: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return detail for a single order — only if buyer_email matches."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.store))
        .where(Order.order_number == order_number)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if order.buyer_email != current_user.email:
        raise HTTPException(status_code=403, detail="No autorizado")

    return {
        "order_number": order.order_number,
        "status": order.status,
        "total_cents": order.total_cents,
        "subtotal_cents": order.subtotal_cents,
        "delivery_cents": order.delivery_cents,
        "created_at": order.created_at,
        "buyer_name": order.buyer_name,
        "buyer_phone": order.buyer_phone,
        "buyer_address": order.buyer_address,
        "notes": order.notes,
        "store_name": order.store.name if order.store else None,
        "store_slug": order.store.slug if order.store else None,
        "store_logo_url": order.store.logo_url if order.store else None,
        "store_color": order.store.primary_color if order.store else "#6366f1",
        "items": [
            {
                "product_name": i.product_name,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "subtotal": i.subtotal,
                "image_url": i.image_url,
            }
            for i in order.items
        ],
    }


# ── Favoritos — el localStorage del navegador es la fuente de verdad
# inmediata (funciona sin sesión); esto es la copia de respaldo/
# multi-dispositivo que se fusiona al iniciar sesión. ───────────

@router.get("/favorites")
async def list_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite.product_id, Store.slug)
        .join(Store, Store.id == Favorite.store_id)
        .where(Favorite.user_id == current_user.id)
    )
    return [{"product_id": pid, "store_slug": slug} for pid, slug in result.all()]


class FavoriteCreate(BaseModel):
    product_id: UUID


@router.post("/favorites", status_code=201)
async def add_favorite(
    payload: FavoriteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = (
        await db.execute(select(Product.id, Product.store_id).where(Product.id == payload.product_id))
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    stmt = pg_insert(Favorite).values(
        user_id=current_user.id, store_id=product.store_id, product_id=product.id
    ).on_conflict_do_nothing(index_elements=["user_id", "product_id"])
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.delete("/favorites/{product_id}")
async def remove_favorite(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        sql_delete(Favorite).where(Favorite.user_id == current_user.id, Favorite.product_id == product_id)
    )
    await db.commit()
    return {"ok": True}


class FavoriteSyncRequest(BaseModel):
    product_ids: list[UUID]


@router.post("/favorites/sync")
async def sync_favorites(
    payload: FavoriteSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sube los favoritos guardados en el navegador antes de iniciar sesión —
    se llama una sola vez al detectar sesión. Es una unión, nunca reemplaza
    ni borra lo que ya había en la cuenta (ej. de otro dispositivo)."""
    if not payload.product_ids:
        return {"synced": 0}

    products = (
        await db.execute(select(Product.id, Product.store_id).where(Product.id.in_(payload.product_ids)))
    ).all()
    for pid, store_id in products:
        stmt = pg_insert(Favorite).values(
            user_id=current_user.id, store_id=store_id, product_id=pid
        ).on_conflict_do_nothing(index_elements=["user_id", "product_id"])
        await db.execute(stmt)
    await db.commit()
    return {"synced": len(products)}
