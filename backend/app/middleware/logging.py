import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("qtienda")

SLOW_MS = 2000  # requests mas lentos que esto se loguean como WARNING


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, req, call_next):
        t = time.perf_counter()
        try:
            r = await call_next(req)
        except Exception:
            # Excepcion no manejada: dejar traceback visible antes de re-lanzar (500)
            ms = (time.perf_counter() - t) * 1000
            logger.exception(
                f"{req.method} {req.url.path} 500 {ms:.0f}ms",
                extra=self._extra(req, 500, ms),
            )
            raise

        ms = (time.perf_counter() - t) * 1000
        msg = f"{req.method} {req.url.path} {r.status_code} {ms:.0f}ms"
        extra = self._extra(req, r.status_code, ms)
        if r.status_code >= 500:
            logger.error(msg, extra=extra)
        elif r.status_code >= 400 or ms >= SLOW_MS:
            logger.warning(msg, extra=extra)
        else:
            logger.info(msg, extra=extra)
        return r

    @staticmethod
    def _extra(req, status: int, ms: float) -> dict:
        # Detras de nginx la IP real viene en X-Forwarded-For
        fwd = req.headers.get("x-forwarded-for")
        ip = fwd.split(",")[0].strip() if fwd else (req.client.host if req.client else None)
        return {
            "method": req.method,
            "path": req.url.path,
            "status": status,
            "duration_ms": round(ms),
            "ip": ip,
        }
