"""
qtienda.shop — FastAPI Backend
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.limiter import limiter
from app.db.session import engine
from app.api.v1.router import api_router
from app.middleware.logging import RequestLoggingMiddleware

UPLOADS_DIR = Path(settings.UPLOADS_DIR)

setup_logging(debug=settings.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    import asyncio
    from app.services.plan_expiry import expiry_watcher
    from app.services.store_health_watcher import store_health_watcher
    from app.services.review_reminder import review_reminder_watcher
    from app.services.abandoned_cart_watcher import abandoned_cart_watcher
    from app.services.appointment_reminder_watcher import appointment_reminder_watcher
    app.state.started_at = datetime.now(timezone.utc)
    expiry_task = asyncio.create_task(expiry_watcher())
    store_health_task = asyncio.create_task(store_health_watcher())
    review_reminder_task = asyncio.create_task(review_reminder_watcher())
    abandoned_cart_task = asyncio.create_task(abandoned_cart_watcher())
    appointment_reminder_task = asyncio.create_task(appointment_reminder_watcher())
    yield
    # shutdown
    expiry_task.cancel()
    store_health_task.cancel()
    review_reminder_task.cancel()
    abandoned_cart_task.cancel()
    appointment_reminder_task.cancel()
    await engine.dispose()


app = FastAPI(
    title="qtienda.shop API",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Rate limiting ─────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(RequestLoggingMiddleware)

# ── Routes ───────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")

# ── Static uploads (local dev / fallback when S3 not configured) ─
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
async def health():
    started_at = getattr(app.state, "started_at", None)
    uptime_seconds = (
        (datetime.now(timezone.utc) - started_at).total_seconds() if started_at else None
    )
    return {
        "status": "ok",
        "service": "qtienda-api",
        "version": app.version,
        "environment": "development" if settings.DEBUG else "production",
        "uptime_seconds": uptime_seconds,
    }

