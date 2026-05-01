import time, logging
from starlette.middleware.base import BaseHTTPMiddleware
logger = logging.getLogger("qtienda")
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, req, call_next):
        t = time.perf_counter()
        r = await call_next(req)
        logger.info(f"{req.method} {req.url.path} {r.status_code} {(time.perf_counter()-t)*1000:.0f}ms")
        return r
