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

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import AsyncSessionLocal
from app.models.models import Notification

log = logging.getLogger(__name__)

# Eventos que solo deben notificarse una vez por tienda (dedupe vía índice único parcial)
_ONCE_TYPES = {
    "store_created", "first_product", "products_5",
    "first_visit", "first_favorite", "first_order",
    "no_products_warn", "no_products_final", "no_products_urgent",
}


@dataclass
class NotifTemplate:
    icon: str
    title: Union[str, Callable[[dict], str]]
    body: Union[str, Callable[[dict], str]]
    action_url: str
    push: bool = True  # False para hitos tempranos donde el vendedor ya está en el dashboard

    def render(self, ctx: dict) -> tuple[str, str]:
        title = self.title(ctx) if callable(self.title) else self.title
        body = self.body(ctx) if callable(self.body) else self.body
        return title, body


TEMPLATES: dict[str, NotifTemplate] = {
    "store_created": NotifTemplate(
        icon="🎉",
        title="¡Bienvenido a QTienda!",
        body=lambda ctx: f"Tu tienda \"{ctx.get('store_name', '')}\" está lista. Agrega tu primer producto para empezar a vender.",
        action_url="/dashboard/productos",
        push=False,
    ),
    "first_product": NotifTemplate(
        icon="📦",
        title="¡Primer producto agregado!",
        body="Ya tienes tu primer producto publicado. Sigue agregando hasta tener al menos 5 para verte más profesional.",
        action_url="/dashboard/productos",
        push=False,
    ),
    "products_5": NotifTemplate(
        icon="🚀",
        title="¡Excelente progreso!",
        body="Ya tienes 5 productos publicados. Ahora comparte tu tienda para empezar a recibir pedidos.",
        action_url="/dashboard/configuracion",
        push=False,
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
    ),
    "no_products_final": NotifTemplate(
        icon="⚠️",
        title="Tu tienda sigue sin productos",
        body="Ya llevas dos semanas sin publicar nada. Sin productos tu tienda no puede recibir pedidos — agrégalos ahora para no perder terreno.",
        action_url="/dashboard/productos",
    ),
    "no_products_urgent": NotifTemplate(
        icon="🚨",
        title="Advertencia: tu tienda está en riesgo",
        body="Llevas 30 días sin agregar productos. Las tiendas inactivas por mucho tiempo pueden ser suspendidas — publica al menos un producto para mantenerla activa.",
        action_url="/dashboard/productos",
    ),
    "announcement": NotifTemplate(
        icon="✨",
        title=lambda ctx: ctx.get("title", "Novedades en QTienda"),
        body=lambda ctx: ctx.get("body", ""),
        action_url="/dashboard",
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
            stmt = stmt.on_conflict_do_nothing(index_elements=["store_id", "type"])
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


async def _dispatch_push(store_id: str, title: str, body: str, event_type: str) -> None:
    """Push best-effort por todos los canales — un canal fallando no afecta a los demás."""
    from app.services.push import send_expo_push_to_owner, send_webpush_to_owner

    try:
        await send_expo_push_to_owner(store_id, title, body, data={"type": event_type})
    except Exception:
        log.exception("[notifications] Expo push falló para store %s (%s)", store_id, event_type)

    try:
        await send_webpush_to_owner(store_id, {
            "title": title,
            "body": body,
            "url": "/dashboard",
            "icon": "/icon/icon-192.png",
            "badge": "/icon/icon-96.png",
            "tag": event_type,
        })
    except Exception:
        log.exception("[notifications] WebPush falló para store %s (%s)", store_id, event_type)
