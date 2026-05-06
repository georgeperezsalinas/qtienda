import httpx
from app.core.config import settings

CULQI_BASE = "https://api.culqi.com/v2"


async def create_charge(
    token_id: str,
    amount_cents: int,
    email: str,
    description: str,
) -> dict:
    if not settings.CULQI_SECRET_KEY:
        raise ValueError("CULQI_SECRET_KEY no configurada")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{CULQI_BASE}/charges",
            headers={
                "Authorization": f"Bearer {settings.CULQI_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "amount": amount_cents,
                "currency_code": "PEN",
                "email": email,
                "source_id": token_id,
                "description": description,
            },
        )

    data = resp.json()
    if resp.status_code != 201:
        msg = (
            data.get("user_message")
            or data.get("merchant_message")
            or "Error procesando pago"
        )
        raise ValueError(msg)

    outcome = data.get("outcome", {})
    if outcome.get("type") != "venta_exitosa":
        raise ValueError(outcome.get("user_message") or "Pago rechazado")

    return data
