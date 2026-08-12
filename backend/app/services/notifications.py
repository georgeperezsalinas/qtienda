"""
app/services/notifications.py — notificaciones inteligentes basadas en eventos de negocio.

emit_event() se llama fire-and-forget (asyncio.ensure_future) desde los endpoints
que disparan cada hito, igual que app.services.push. El dedupe de los eventos
"una sola vez" es atómico via INSERT ... ON CONFLICT DO NOTHING (índice único
parcial creado en la migración Bdatos/migrations/026_notifications.sql) — no
hace falta un SELECT previo ni columnas booleanas por evento.
"""
import logging
from dataclasses import dataclass
from typing import Callable, Union

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.models import Notification

log = logging.getLogger(__name__)

# Eventos que solo deben notificarse una vez por tienda (dedupe vía índice único parcial)
_ONCE_TYPES = {
    "store_created", "first_product", "products_5",
    "first_visit", "first_favorite", "first_order",
    "no_products_warn", "no_products_final", "no_products_urgent",
    "missing_branding_warn", "missing_branding_final", "missing_branding_urgent",
}


@dataclass
class NotifTemplate:
    icon: str
    title: Union[str, Callable[[dict], str]]
    body: Union[str, Callable[[dict], str]]
    action_url: str
    push: bool = True   # False para hitos tempranos donde el vendedor ya está en el dashboard
    email: bool = False  # True solo para hitos donde el email es el canal que realmente alcanza
                          # a alguien que no volvió a abrir la app/PWA (opt-in explícito por evento)

    def render(self, ctx: dict) -> tuple[str, str]:
        title = self.title(ctx) if callable(self.title) else self.title
        body = self.body(ctx) if callable(self.body) else self.body
        return title, body


def _branding_phrase(ctx: dict) -> str:
    """'tu logo' / 'tu banner' / 'tu logo ni tu banner' según lo que falte."""
    missing_logo = ctx.get("missing_logo")
    missing_banner = ctx.get("missing_banner")
    if missing_logo and missing_banner:
        return "tu logo ni tu banner"
    if missing_logo:
        return "tu logo"
    return "tu banner"


TEMPLATES: dict[str, NotifTemplate] = {
    "store_created": NotifTemplate(
        icon="🎉",
        title="¡Bienvenido a QTienda!",
        body=lambda ctx: f"Tu tienda \"{ctx.get('store_name', '')}\" está lista. Ahora súbele un logo, un banner y agrega tu primer producto para empezar a vender.",
        action_url="/dashboard/productos",
        push=False,
        email=True,
    ),
    "first_product": NotifTemplate(
        icon="📦",
        title="¡Primer producto agregado!",
        body="Ya tienes tu primer producto publicado. Sigue agregando hasta tener al menos 5 para verte más profesional.",
        action_url="/dashboard/productos",
        push=False,
        email=True,
    ),
    "products_5": NotifTemplate(
        icon="🚀",
        title="¡Excelente progreso!",
        body="Ya tienes 5 productos publicados. Ahora comparte tu tienda para empezar a recibir pedidos.",
        action_url="/dashboard/configuracion",
        push=False,
        email=True,
    ),
    "first_visit": NotifTemplate(
        icon="👀",
        title="¡Alguien visitó tu tienda!",
        body="Tu tienda ya tuvo su primera visita. Sigue compartiendo tu link para llegar a más clientes.",
        action_url="/dashboard",
    ),
    "first_favorite": NotifTemplate(
        icon="❤️",
        title="Un cliente guardó tu producto",
        body="A alguien le gustó tanto un producto tuyo que lo guardó como favorito.",
        action_url="/dashboard/productos",
    ),
    "first_order": NotifTemplate(
        icon="🎉",
        title="¡Felicidades, tu primer pedido!",
        body=lambda ctx: f"Recibiste el pedido #{ctx.get('order_number', '')}. Revísalo y prepáralo cuanto antes.",
        action_url="/dashboard/pedidos",
    ),
    "inactive_7d": NotifTemplate(
        icon="⏰",
        title="Reactiva tu tienda",
        body="No ha habido actividad en tu tienda en los últimos 7 días. Publica una oferta o comparte tu link para atraer clientes.",
        action_url="/dashboard",
    ),
    "no_sales_30d": NotifTemplate(
        icon="💡",
        title="Consejos para vender más",
        body="Llevas 30 días sin ventas. Revisa tus precios, tus fotos y comparte tu tienda en redes para impulsarla.",
        action_url="/dashboard",
    ),
    # Avisos escalonados de "sin productos" — solo advertencias, nunca suspenden
    # la tienda automáticamente (la decisión de cerrarla queda en el equipo/admin).
    "no_products_warn": NotifTemplate(
        icon="📸",
        title="Todavía no tienes productos",
        body="Han pasado varios días desde que creaste tu tienda pero aún no subes ningún producto. Agrega el primero — solo necesitas una foto y un precio.",
        action_url="/dashboard/productos",
        email=True,
    ),
    "no_products_final": NotifTemplate(
        icon="⚠️",
        title="Tu tienda sigue sin productos",
        body="Ya llevas dos semanas sin publicar nada. Sin productos tu tienda no puede recibir pedidos — agrégalos ahora para no perder terreno.",
        action_url="/dashboard/productos",
        email=True,
    ),
    "no_products_urgent": NotifTemplate(
        icon="🚨",
        title="Advertencia: tu tienda está en riesgo",
        body="Llevas 30 días sin agregar productos. Las tiendas inactivas por mucho tiempo pueden ser suspendidas — publica al menos un producto para mantenerla activa.",
        action_url="/dashboard/productos",
        email=True,
    ),
    # Avisos escalonados de "sin logo/banner" — a diferencia de "sin productos",
    # esto no arriesga la tienda (sí puede vender sin logo/banner), es solo un
    # empujón para que se vea profesional y genere más confianza. El texto
    # varía según falte uno, el otro o ambos (ctx: missing_logo, missing_banner).
    "missing_branding_warn": NotifTemplate(
        icon="🎨",
        title="Dale una cara a tu tienda",
        body=lambda ctx: f"Todavía no subiste {_branding_phrase(ctx)}. Las tiendas con logo y banner generan más confianza y venden más.",
        action_url="/dashboard/configuracion",
        email=True,
    ),
    "missing_branding_final": NotifTemplate(
        icon="🖼️",
        title="Tu tienda se ve incompleta",
        body=lambda ctx: f"Ya pasaron dos semanas y todavía no subiste {_branding_phrase(ctx)}. Toma 2 minutos y hace que tu tienda se vea mucho más profesional.",
        action_url="/dashboard/configuracion",
        email=True,
    ),
    "missing_branding_urgent": NotifTemplate(
        icon="💡",
        title="Un último empujón para tu tienda",
        body=lambda ctx: f"Llevas un mes sin subir {_branding_phrase(ctx)}. Muchos compradores desconfían de tiendas sin imagen — vale la pena completarlo.",
        action_url="/dashboard/configuracion",
        email=True,
    ),
    # Stock bajo — no es un evento "once" por tienda (_ONCE_TYPES), el dedupe
    # es por PRODUCTO vía Product.low_stock_notified_at, controlado por quien
    # llama a emit_event (public.py, al descontar stock en el checkout).
    "low_stock": NotifTemplate(
        icon="📦",
        title="Se te está acabando un producto",
        body=lambda ctx: f"A \"{ctx.get('product_name', '')}\" le quedan {ctx.get('stock', 0)} unidades. Actualiza el stock antes de que se agote.",
        action_url="/dashboard/productos",
    ),
    # Carrito abandonado — no es "once" por tienda, el dedupe es por carrito
    # (AbandonedCart.notified_at), controlado por quien llama a emit_event
    # (abandoned_cart_watcher.py).
    "abandoned_cart": NotifTemplate(
        icon="🛒",
        title="Un cliente dejó su carrito a medias",
        body=lambda ctx: (
            f"Agregó {ctx.get('items_count', 0)} producto(s) por S/ {ctx.get('subtotal_cents', 0) / 100:.2f} "
            + (f"y dejó su teléfono {ctx.get('buyer_phone')} — escríbele para ayudarlo a completar la compra." if ctx.get("buyer_phone") else "pero no completó el pedido — vale la pena revisar si algo trabó el checkout.")
        ),
        action_url="/dashboard",
    ),
    # Libro de Reclamaciones — no es "once" (una tienda puede recibir varios).
    "new_claim": NotifTemplate(
        icon="📋",
        title=lambda ctx: f"Nuevo {ctx.get('claim_type', 'reclamo')} — {ctx.get('claim_number', '')}",
        body=lambda ctx: f"{ctx.get('consumer_name', 'Un cliente')} registró un {ctx.get('claim_type', 'reclamo')} en tu Libro de Reclamaciones. Revísalo y responde cuanto antes.",
        action_url="/dashboard/reclamos",
        email=True,
    ),
    "announcement": NotifTemplate(
        icon="✨",
        title=lambda ctx: ctx.get("title", "Novedades en QTienda"),
        body=lambda ctx: ctx.get("body", ""),
        action_url="/dashboard",
    ),
    # Vencimiento de plan — el título/cuerpo ya vienen armados desde
    # plan_expiry.py (varían si está por vencer o ya venció). push=False
    # porque plan_expiry.py ya manda su propio push/email — esto solo
    # deja el registro en la campanita, para no duplicar el aviso.
    "plan_expiring": NotifTemplate(
        icon="⏰",
        title=lambda ctx: ctx.get("title", "Tu plan está por vencer"),
        body=lambda ctx: ctx.get("body", ""),
        action_url="/dashboard/planes",
        push=False,
    ),
    "plan_downgraded": NotifTemplate(
        icon="📉",
        title="Tu tienda pasó al plan gratuito",
        body=lambda ctx: (
            f"Tu Plan {ctx.get('old_plan_name', 'de pago')} venció y no se renovó, así que tu tienda pasó al {ctx.get('free_plan_name', 'plan gratuito')}. "
            + (
                f"Tienes {ctx.get('products_count')} productos publicados, pero tu plan actual permite hasta {ctx.get('products_limit')} — "
                "no se desactivó ninguno, pero no podrás agregar más hasta que estés dentro del límite o vuelvas a suscribirte."
                if ctx.get("products_over_limit")
                else "No se borró nada — puedes volver a suscribirte cuando quieras."
            )
        ),
        action_url="/dashboard/planes",
    ),
}


async def emit_event(store_id: str, event_type: str, **ctx) -> None:
    """Crea (si corresponde) una notificación para la tienda y despacha push best-effort.
    Fire-and-forget: llamar con asyncio.ensure_future(emit_event(...)).
    """
    template = TEMPLATES.get(event_type)
    if template is None:
        log.warning("[notifications] tipo de evento desconocido: %s", event_type)
        return

    title, body = template.render(ctx)
    action_url = ctx.get("action_url", template.action_url)

    async with AsyncSessionLocal() as db:
        stmt = pg_insert(Notification).values(
            store_id=store_id,
            type=event_type,
            title=title,
            body=body,
            icon=template.icon,
            action_url=action_url,
        )
        if event_type in _ONCE_TYPES:
            # uq_notifications_store_once es un índice ÚNICO PARCIAL (solo
            # cubre los tipos "once") — Postgres exige repetir el mismo WHERE
            # acá para poder inferirlo, si no tira "no unique or exclusion
            # constraint matching the ON CONFLICT specification".
            stmt = stmt.on_conflict_do_nothing(
                index_elements=["store_id", "type"],
                index_where=Notification.type.in_(_ONCE_TYPES),
            )
        stmt = stmt.returning(Notification.id)

        try:
            result = await db.execute(stmt)
            inserted_id = result.scalar_one_or_none()
            await db.commit()
        except Exception:
            log.exception("[notifications] error creando notificación %s para store %s", event_type, store_id)
            return

    if inserted_id is None:
        return  # ya existía (evento "once" ya disparado) — no se re-notifica

    if template.push:
        await _dispatch_push(store_id, title, body, event_type)

    if template.email:
        await _dispatch_email(store_id, template.icon, title, body, action_url)


async def _dispatch_email(store_id: str, icon: str, title: str, body: str, action_url: str) -> None:
    """Email best-effort — canal separado del push, no afecta a los demás si falla.
    Resuelve el email/nombre del vendedor por store_id (mismo patrón que
    send_expo_push_to_owner en app.services.push)."""
    from app.models.models import Store, User
    from app.services.email import send_notification_email

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).join(Store, Store.user_id == User.id).where(Store.id == store_id)
            )
            user = result.scalar_one_or_none()
    except Exception:
        log.exception("[notifications] no se pudo resolver el usuario de store %s para email", store_id)
        return

    if not user or not user.email:
        return

    try:
        await send_notification_email(
            to_email=user.email,
            full_name=user.full_name or "",
            icon=icon,
            title=title,
            body=body,
            cta_url=f"{settings.APP_URL}{action_url}",
        )
    except Exception:
        log.exception("[notifications] email falló para store %s (%s)", store_id, title)


async def _dispatch_push(store_id: str, title: str, body: str, event_type: str) -> None:
    """Push best-effort por todos los canales — un canal fallando no afecta a los demás."""
    from app.services.push import send_expo_push_to_owner, send_webpush_to_owner

    unread_count = None
    try:
        async with AsyncSessionLocal() as db:
            unread_count = (await db.execute(
                select(func.count()).select_from(Notification).where(
                    Notification.store_id == store_id, Notification.read_at.is_(None)
                )
            )).scalar()
    except Exception:
        log.exception("[notifications] no se pudo calcular unread_count para store %s", store_id)

    try:
        await send_expo_push_to_owner(store_id, title, body, data={"type": event_type}, badge=unread_count)
    except Exception:
        log.exception("[notifications] Expo push falló para store %s (%s)", store_id, event_type)

    try:
        await send_webpush_to_owner(store_id, {
            "title": title,
            "body": body,
            "url": "/dashboard",
            "icon": "/icon/icon-192.png",
            "badge": "/icon/icon-96.png",
            "badgeCount": unread_count,
            "tag": event_type,
        })
    except Exception:
        log.exception("[notifications] WebPush falló para store %s (%s)", store_id, event_type)
