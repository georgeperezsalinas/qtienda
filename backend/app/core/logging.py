"""Logging estructurado (QT-013).

En produccion (DEBUG=False) emite JSON por linea — facil de filtrar en el VPS:
    docker logs qtienda_api | grep '"level": "ERROR"'
    docker logs qtienda_api | python3 -c "import sys,json; [print(json.loads(l)['message']) for l in sys.stdin]"

En desarrollo mantiene formato legible.
"""
import json
import logging
import sys
from datetime import datetime, timezone

# Campos extra que el middleware adjunta via logger.info(..., extra={...})
EXTRA_FIELDS = ("method", "path", "status", "duration_ms", "ip")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in EXTRA_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                entry[field] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


def setup_logging(debug: bool) -> None:
    handler = logging.StreamHandler(sys.stdout)
    if debug:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s — %(message)s"))
    else:
        handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.DEBUG if debug else logging.INFO)

    # El middleware ya loguea cada request; el access log de uvicorn seria duplicado
    logging.getLogger("uvicorn.access").disabled = True
    # uvicorn.error trae los tracebacks de arranque: dejarlo pasar al root handler
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
