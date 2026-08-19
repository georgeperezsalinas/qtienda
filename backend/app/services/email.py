"""
Email service using Resend.
Falls back to a no-op if RESEND_API_KEY is not set (dev mode).
"""
import asyncio
import html
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


async def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    reset_url = f"{settings.APP_URL}/auth/reset-password?token={token}"

    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — password reset URL: %s", reset_url)
        return

    html_body = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#2563EB;padding:32px 40px;text-align:center">
        <img src="{settings.APP_URL}/logo_qtienda.png" alt="qtienda" height="32" style="height:32px"/>
      </div>
      <div style="padding:40px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#0F172A">Hola, {full_name} 👋</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          Pediste restablecer tu contraseña en <strong>qtienda.shop</strong>.<br>
          Toca el botón para crear una nueva.
        </p>
        <a href="{reset_url}"
           style="display:inline-block;background:#2563EB;color:#fff;font-weight:700;
                  padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px">
          Restablecer contraseña
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;line-height:1.5">
          Este enlace expira en 1 hora.<br>
          Si no pediste esto, ignora este mensaje — tu contraseña sigue igual.
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
            _send_sync, to_email, "Restablece tu contraseña en qtienda.shop", html_body
        )
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)


async def send_plan_expiry_email(
    to_email: str,
    full_name: str,
    plan_name: str,
    ends_at_str: str,
    days_left: int,
    overdue: bool = False,
) -> None:
    """Recordatorio de renovación: el plan vence en pocos días, o ya venció (overdue=True)."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — expiry notice for %s skipped", to_email)
        return

    renew_url = f"{settings.APP_URL}/dashboard/planes"
    if overdue:
        when = f"hace {days_left} día{'s' if days_left != 1 else ''}"
        action = "venció"
    else:
        when = "mañana" if days_left == 1 else f"en {days_left} días"
        action = "vence"

    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#D97706;padding:32px 40px;text-align:center">
        <img src="{settings.APP_URL}/logo_qtienda.png" alt="qtienda" height="32" style="height:32px"/>
      </div>
      <div style="padding:40px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#0F172A">Hola, {full_name} ⏰</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          Tu <strong>Plan {plan_name}</strong> en qtienda.shop {action} <strong>{when}</strong>
          ({ends_at_str}).<br>
          Renuévalo para no perder tus beneficios: los días nuevos se suman a tu fecha de vencimiento.
        </p>
        <a href="{renew_url}"
           style="display:inline-block;background:#D97706;color:#fff;font-weight:700;
                  padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px">
          Renovar mi plan
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;line-height:1.5">
          Puedes pagar con Yape o tarjeta desde tu panel.<br>
          Si no renuevas, tu tienda pasará al plan gratuito automáticamente (no se borra nada).
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
            _send_sync, to_email,
            f"Tu Plan {plan_name} {action} {when} — renuévalo",
            html,
        )
    except Exception:
        logger.exception("Failed to send plan expiry email to %s", to_email)


async def send_notification_email(
    to_email: str,
    full_name: str,
    icon: str,
    title: str,
    body: str,
    cta_url: str,
    cta_label: str = "Ir a mi panel",
    secondary_url: str | None = None,
    secondary_label: str = "Ver mi tienda",
) -> None:
    """Email genérico para hitos/eventos de negocio (bienvenida, onboarding,
    avisos de inactividad, etc). Reutiliza el mismo título/cuerpo que ya se
    calculó para la campanita in-app — un solo texto, dos canales."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — notification email for %s skipped", to_email)
        return

    safe_name = html.escape(full_name or "")
    safe_title = html.escape(title)
    safe_body = html.escape(body)

    email_html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#2563EB;padding:32px 40px;text-align:center">
        <img src="{settings.APP_URL}/logo_qtienda.png" alt="qtienda" height="32" style="height:32px"/>
      </div>
      <div style="padding:40px;text-align:center">
        <div style="font-size:40px;line-height:1;margin-bottom:12px">{icon}</div>
        <h2 style="margin:0 0 12px;font-size:20px;color:#0F172A">{safe_title}</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6;text-align:left">
          Hola {safe_name} — {safe_body}
        </p>
        <a href="{cta_url}"
           style="display:inline-block;background:#2563EB;color:#fff;font-weight:700;
                  padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px">
          {cta_label}
        </a>
        {f'''<div style="margin-top:16px">
          <a href="{secondary_url}" style="color:#2563EB;font-size:13px;font-weight:600;text-decoration:none">
            {secondary_label} →
          </a>
        </div>''' if secondary_url else ""}
      </div>
      <div style="background:#F8FAFC;padding:20px 40px;text-align:center">
        <p style="color:#94A3B8;font-size:11px;margin:0">
          © qtienda.shop · Tu tienda en Redes Sociales
        </p>
      </div>
    </div>
    """

    try:
        await asyncio.to_thread(_send_sync, to_email, title, email_html)
    except Exception:
        logger.exception("Failed to send notification email to %s", to_email)
