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


async def send_order_confirmation_email(
    to_email: str,
    buyer_name: str,
    order_number: str,
    store_name: str,
    store_slug: str,
    items: list[dict],
    total_cents: int,
    whatsapp_link: str | None,
    payment_note: str | None = None,
) -> None:
    """Respaldo del aviso por WhatsApp a la tienda — en laptop/desktop wa.me
    no siempre abre solo (requiere una sesión de WhatsApp Web ya iniciada),
    así que el comprador se queda sin ninguna confirmación de su compra.
    Este correo repite los datos del pedido y el mismo botón de WhatsApp
    para que lo pueda abrir manualmente cuando quiera.
    items: [{"name": ..., "qty": int, "subtotal_cents": int}, ...]"""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — order confirmation for %s skipped", order_number)
        return

    safe_name = html.escape(buyer_name or "")
    safe_store = html.escape(store_name or "")
    tracking_url = f"https://{store_slug}.qtienda.shop/pedido/{order_number}"

    items_html = "".join(
        f"""
        <tr>
          <td style="padding:8px 0;color:#0F172A;font-size:14px">{item['qty']}× {html.escape(item['name'])}</td>
          <td style="padding:8px 0;color:#0F172A;font-size:14px;text-align:right;white-space:nowrap">S/ {item['subtotal_cents']/100:.2f}</td>
        </tr>
        """
        for item in items
    )

    wa_button = f"""
        <a href="{whatsapp_link}"
           style="display:block;background:#25D366;color:#fff;font-weight:700;text-align:center;
                  padding:14px 24px;border-radius:10px;text-decoration:none;font-size:15px;margin-top:20px">
          💬 Avisar a la tienda por WhatsApp
        </a>
    """ if whatsapp_link else ""

    payment_html = f"""
        <p style="background:#FEF3C7;color:#92400E;padding:12px 16px;border-radius:10px;
                  font-size:13px;line-height:1.5;margin:20px 0 0">
          ⚠️ {html.escape(payment_note)}
        </p>
    """ if payment_note else ""

    email_html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#2563EB;padding:32px 40px;text-align:center">
        <img src="{settings.APP_URL}/logo_qtienda.png" alt="qtienda" height="32" style="height:32px"/>
      </div>
      <div style="padding:40px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#0F172A">¡Gracias, {safe_name}! 🎉</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          Tu pedido <strong>#{order_number}</strong> en <strong>{safe_store}</strong> quedó registrado.
        </p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0">
          {items_html}
        </table>
        <p style="text-align:right;font-weight:800;font-size:16px;color:#0F172A;margin:12px 0 0">
          Total: S/ {total_cents/100:.2f}
        </p>
        {payment_html}
        {wa_button}
        <a href="{tracking_url}"
           style="display:block;text-align:center;color:#2563EB;font-weight:700;
                  padding:12px 24px;font-size:14px;text-decoration:none;margin-top:10px">
          📍 Seguir mi pedido
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;line-height:1.5">
          Guarda este correo — puedes volver a ver tu pedido cuando quieras desde el link de arriba.
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
            _send_sync, to_email, f"Tu pedido #{order_number} en {store_name}", email_html
        )
    except Exception:
        logger.exception("Failed to send order confirmation email to %s", to_email)


async def send_digital_download_email(
    to_email: str,
    buyer_name: str,
    order_number: str,
    store_name: str,
    download_links: list[dict],
) -> None:
    """download_links: [{"name": ..., "url": ...}, ...] — un link por cada
    producto digital del pedido. Se manda solo cuando el vendedor confirma
    el pedido (el link también queda disponible en la página de seguimiento
    sin depender de que este email llegue)."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — download links for order %s: %s", order_number, download_links)
        return

    safe_name = html.escape(buyer_name or "")
    safe_store = html.escape(store_name or "")
    links_html = "".join(
        f"""
        <a href="{link['url']}"
           style="display:block;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;
                  padding:14px 18px;margin-bottom:10px;color:#2563EB;font-weight:700;
                  text-decoration:none;font-size:14px">
          ⬇️ Descargar {html.escape(link['name'])}
        </a>
        """
        for link in download_links
    )

    email_html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#2563EB;padding:32px 40px;text-align:center">
        <img src="{settings.APP_URL}/logo_qtienda.png" alt="qtienda" height="32" style="height:32px"/>
      </div>
      <div style="padding:40px">
        <h2 style="margin:0 0 8px;font-size:22px;color:#0F172A">Hola, {safe_name} 👋</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          Tu pedido <strong>#{order_number}</strong> en <strong>{safe_store}</strong> fue confirmado.
          Ya puedes descargar tu compra:
        </p>
        {links_html}
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;line-height:1.5">
          Guarda este correo — puedes volver a descargar cuando quieras desde estos links.
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
            _send_sync, to_email, f"Tu descarga del pedido #{order_number} está lista", email_html
        )
    except Exception:
        logger.exception("Failed to send digital download email to %s", to_email)
