"""
Email service using Resend.
Falls back to a no-op if RESEND_API_KEY is not set (dev mode).
"""
import asyncio
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_sync(to_email: str, subject: str, html: str) -> None:
    import resend as resend_lib
    resend_lib.api_key = settings.RESEND_API_KEY
    resend_lib.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html,
    })


async def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    if not settings.RESEND_API_KEY:
        verify_url = f"{settings.APP_URL}/auth/verify-email?token={token}"
        logger.warning("RESEND_API_KEY not set — verification URL: %s", verify_url)
        return

    verify_url = f"{settings.APP_URL}/auth/verify-email?token={token}"

    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#2563EB;padding:32px 40px;text-align:center">
        <img src="{settings.APP_URL}/logo_qtienda.png" alt="qtienda" height="32" style="height:32px"/>
      </div>
      <div style="padding:40px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#0F172A">Hola, {full_name} 👋</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          Gracias por registrarte en <strong>qtienda.shop</strong>.<br>
          Confirma tu correo para activar tu cuenta y empezar a vender.
        </p>
        <a href="{verify_url}"
           style="display:inline-block;background:#2563EB;color:#fff;font-weight:700;
                  padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px">
          Verificar mi correo
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;line-height:1.5">
          Este enlace expira en 24 horas.<br>
          Si no creaste esta cuenta, ignora este mensaje.
        </p>
      </div>
      <div style="background:#F8FAFC;padding:20px 40px;text-align:center">
        <p style="color:#94A3B8;font-size:11px;margin:0">
          © qtienda.shop · Tu tienda en Redes Sociales
        </p>
      </div>
    </div>
    """

    try:
        await asyncio.to_thread(
            _send_sync, to_email, "Verifica tu correo en qtienda.shop", html
        )
    except Exception:
        logger.exception("Failed to send verification email to %s", to_email)
