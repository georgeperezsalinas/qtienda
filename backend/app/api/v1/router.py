from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    stores,
    products,
    categories,
    orders,
    admin,
    uploads,
    public,
)

api_router = APIRouter()

# Public (no auth)
api_router.include_router(public.router,    prefix="/public",    tags=["Public Store"])

# Auth
api_router.include_router(auth.router,      prefix="/auth",      tags=["Auth"])

# Vendor
api_router.include_router(stores.router,    prefix="/stores",    tags=["Stores"])
api_router.include_router(products.router,  prefix="/products",  tags=["Products"])
api_router.include_router(categories.router,prefix="/categories",tags=["Categories"])
api_router.include_router(orders.router,    prefix="/orders",    tags=["Orders"])
api_router.include_router(uploads.router,   prefix="/uploads",   tags=["Uploads"])

# Admin
api_router.include_router(admin.router,     prefix="/admin",     tags=["Admin"])
