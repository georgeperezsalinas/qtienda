"""
app/services/whatsapp.py — envío de WhatsApp vía Evolution API (Baileys,
no oficial). Usado hoy solo para códigos de verificación de teléfono.

Formato de la API ya validado en producción por el usuario:
  POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}
  header apikey: {EVOLUTION_API_KEY}
  body {"number": "51XXXXXXXXX", "text": "..."}
"""
import logging
import re

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


def normalize_phone_pe(phone: str) -> str:
    """Antepone el código de país (51) a celulares peruanos de 9 dígitos
    (empiezan con 9). Si ya viene con más dígitos, se asume que ya incluye
    código de país y se usa tal cual — no es perfecto para todos los países,
    cubre el caso real de uso de hoy (compradores peruanos)."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 9 and digits.startswith("9"):
        return f"51{digits}"
    return digits


async def send_whatsapp_message(phone: str, text: str) -> bool:
    """Best-effort: no levanta excepción, devuelve False si falla (el
    endpoint que use esto decide qué responder al usuario)."""
    if not settings.EVOLUTION_API_URL or not settings.EVOLUTION_API_KEY or not settings.EVOLUTION_INSTANCE:
        log.warning("[whatsapp] Evolution API no configurada — omitiendo envío")
        return False

    number = normalize_phone_pe(phone)
    url = f"{settings.EVOLUTION_API_URL.rstrip('/')}/message/sendText/{settings.EVOLUTION_INSTANCE}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                headers={"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"},
                json={"number": number, "text": text},
            )
        if resp.status_code >= 300:
            log.warning("[whatsapp] Evolution API respondió %s: %s", resp.status_code, resp.text[:300])
            return False
        return True
    except Exception:
        log.exception("[whatsapp] error enviando mensaje a %s", number)
        return False
