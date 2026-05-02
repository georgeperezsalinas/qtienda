"""
qtienda.shop — FastAPI Backend
"""
# ── SSL compat para Cloudflare R2 en Debian Bookworm (va PRIMERO) ──────
# botocore usa urllib3.util.ssl_.create_urllib3_context, NO ssl.create_default_context.
# Hay que parchear ambas antes de que botocore sea importado.
import ssl as _ssl
import urllib3.util.ssl_ as _u3ssl

def _patch_ctx(ctx):
    try:
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
    except _ssl.SSLError:
        pass
    return ctx

_o1 = _ssl.create_default_context
_ssl.create_default_context = lambda *a, **kw: _patch_ctx(_o1(*a, **kw))

_o2 = _u3ssl.create_urllib3_context
_u3ssl.create_urllib3_context = lambda *a, **kw: _patch_ctx(_o2(*a, **kw))
# ────────────────────────────────────────────────────────────────────────

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles

import os

from app.core.config import settings
from app.db.session import engine
from app.api.v1.router import api_router
from app.middleware.logging import RequestLoggingMiddleware

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/tmp/qtienda-uploads"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown
    await engine.dispose()


app = FastAPI(
    title="qtienda.shop API",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

# ── Routes ───────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")

# ── Static uploads (local dev / fallback when S3 not configured) ─
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "qtienda-api"}
