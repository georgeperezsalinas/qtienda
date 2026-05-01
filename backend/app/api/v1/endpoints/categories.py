"""Vendor category management — authenticated, scoped to vendor's store."""
import re
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import require_vendor
from app.models.models import Category, Product, Store

router = APIRouter()

_SLUG_RE = re.compile(r"[^a-z0-9\-]")


class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None


async def _get_store(user, db: AsyncSession) -> Store:
    result = await db.execute(
        select(Store).where(Store.user_id == user.id, Store.deleted_at.is_(None))
    )
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="No tienes una tienda activa")
    return store


def _slugify(text: str) -> str:
    return _SLUG_RE.sub("", text.lower().replace(" ", "-"))[:80] or "categoria"


def _serialize(c: Category) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "slug": c.slug,
        "icon": c.icon,
        "sort_order": c.sort_order,
        "created_at": c.created_at,
    }


@router.get("/")
async def list_categories(
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Category)
        .where(Category.store_id == store.id)
        .order_by(Category.sort_order, Category.name)
    )
    return [_serialize(c) for c in result.scalars().all()]


@router.post("/", status_code=201)
async def create_category(
    payload: CategoryCreate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    slug = _slugify(payload.name)

    dup = (
        await db.execute(
            select(Category.id).where(
                Category.store_id == store.id, Category.slug == slug
            )
        )
    ).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre")

    cat = Category(
        store_id=store.id,
        name=payload.name,
        slug=slug,
        icon=payload.icon,
        sort_order=payload.sort_order,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return _serialize(cat)


@router.patch("/{category_id}")
async def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.store_id == store.id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)
    return _serialize(cat)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID,
    current_user=Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store(current_user, db)
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.store_id == store.id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    # Unlink products from this category before deleting
    await db.execute(
        sa_update(Product)
        .where(Product.category_id == category_id, Product.store_id == store.id)
        .values(category_id=None)
    )

    await db.delete(cat)
    await db.commit()
