# QTIENDA - Tracking Marcha Blanca

Fecha de analisis: 2026-07-09  
Ultima actualizacion: 2026-07-21  
Estado del producto: marcha blanca desplegada en VPS con Docker  
Contexto operativo: ya existen usuarios reales creando tiendas desde web responsive, principalmente celular y posiblemente laptop. A la fecha de esta actualizacion se reportan 3 tiendas creadas en los ultimos dias (dato del dueño del producto, no verificado contra el admin panel en esta revision).

## Actualizacion 2026-07-21 — Panel Admin nivel "Pro" + trafico del sitio

Ciclo enfocado exclusivamente en el panel Admin (`/admin/*`), que seguia con paleta fria/generica heredada de antes del rediseño cálido, `window.confirm()/prompt()` nativos en acciones destructivas, y huecos funcionales marcados como pendientes desde el analisis inicial (usuarios sin acciones, sin visor de auditoria, sin vista global de pedidos, sin datos de trafico). Tambien se agrego un guardrail de producto: los productos nuevos ya no se publican automaticamente en la tienda al crearlos.

| Area | Que se hizo | Impacto esperado |
|---|---|---|
| Publicar producto | `ProductCreate.status` nace en `"inactive"` (borrador) por defecto en vez de `"active"`; toggle "Publicar en la tienda" explicito en el formulario de crear/editar, tanto en dashboard web como en la app movil. | El vendedor decide cuando un producto se hace visible al comprador, en vez de que se publique solo porque tiene stock cargado. |
| Admin — pulido visual | Los 4 screens (`layout`, dashboard, tiendas, usuarios) migrados de hex hardcodeado (grises/azules/verdes genericos tipo Tailwind) a los tokens calidos del resto de la app (`--accent`, `--success`, `--warn`, `--danger` + variantes `-soft`). Avatares con degradado terracota en vez de rojo/morado. | El admin dejo de sentirse una app distinta pegada al resto de qtienda. |
| Admin — modales propios | Nuevo `ConfirmModal` reutilizable (`admin/_components/`) con soporte de motivo y confirmacion tipeada ("escribe DELETE"); reemplaza todos los `window.confirm()/prompt()` nativos en suspender/eliminar tienda y aprobar/rechazar pago Yape. | Se ve como una app real, no como un prototipo con popups del navegador. |
| Admin — usuarios | Accion suspender/activar usuario (`PATCH /admin/users/{id}`, usa la columna `is_active` que ya existia pero no tenia endpoint), con guardrail para no poder autosuspenderse. | Cierra el hueco "Admin Usuarios: sin acciones" del backlog original. |
| Admin — auditoria | Nueva pantalla `/admin/auditoria`: visor paginado y filtrable por entidad de la tabla `audit_logs` (ya existia y se llenaba desde 2026-07-09, pero no habia UI para verla). Traduce cada `action` a texto legible en español. | Cierra "Admin Auditoria: base creada, sin pantalla" del backlog original. |
| Admin — pedidos globales | Nueva pantalla `/admin/pedidos` + `GET /admin/orders`: lista de pedidos de **todas** las tiendas con filtro por estado y busqueda por comprador/celular/numero. | Cierra "Admin Pedidos" del backlog (ver detalle/exportar CSV quedan pendientes, ver mas abajo). |
| Admin — tablas de escritorio | `/admin/tiendas` y `/admin/usuarios` ahora muestran tabla densa real en `lg:` (antes tarjetas moviles estiradas a lo ancho); tarjetas se mantienen en movil/tablet. Contenedor con scroll horizontal para no cortar la columna de acciones en laptops medianos. | Uso real en laptop deja de sentirse una app de celular estirada. |
| Dashboard admin — datos de la app | Nuevas secciones: resumen (productos/pedidos historico/pendientes), sparklines de altas de tiendas/usuarios (14 dias), ranking de tiendas destacadas por ventas, panel "Datos tecnicos de qtienda" (version API, entorno, uptime del proceso, motor de BD, estado del watcher de vencimiento de planes). | El dashboard de inicio pasa de 4 tarjetas sueltas a un resumen operativo real. |
| Trafico del sitio (nuevo) | Migracion `022_site_events.sql` + tabla `SiteEvent` + endpoint publico `POST /public/events` (IP real detras de nginx via `X-Forwarded-For`, mismo patron que el logging middleware) para trackear landing (`/`) y directorio (`/tiendas`), que antes no emitian ningun evento. Nuevo `GET /admin/site-traffic` agrega esto **mas** los `store_events` existentes (QT-008) mirados por primera vez a nivel global (todas las tiendas, no una por una). Superficie en el dashboard: vistas/visitantes unicos de landing+directorio, paginas mas vistas, y embudo de conversion agregado (vio tienda → vio producto → agrego carrito → fue a pagar) con datos reales que ya existian sin ser visibles en ningun panel (352 vistas de tienda / 39 inicios de checkout historicos al momento de este corte). | Primera vez que hay visibilidad de trafico a nivel dominio, no solo por tienda individual. |

**Migraciones nuevas de este ciclo:** `022_site_events.sql` — aplicada en local; VPS actualizado el 2026-07-21 (confirmado por el dueño de producto, no reverificado en este ciclo contra la BD de produccion).

**Deuda dejada explicitamente pendiente en este ciclo** (alcance decidido para no sobre-extender): `/admin/pedidos` no tiene "ver detalle" ni exportar CSV; `/admin/productos` (vista global de productos, cross-tienda) sigue sin construir; `/admin/usuarios` sigue sin poder cambiar rol ni ver la tienda asociada al vendedor. Ver filas actualizadas en "Backlog Especifico Admin".

## Actualizacion 2026-07-20 — Ciclo de conversion, checkout y calidez visual

Entre el 2026-07-11 y el 2026-07-20 se trabajo un ciclo enfocado en checkout, retencion de compradores y percepcion visual (la marcha blanca seguia friccionando en UX "fria" y en datos de checkout incompletos para LATAM). Resumen de lo entregado (commits en `main`, ver detalle en cada mensaje de commit):

| Area | Que se hizo | Impacto esperado |
|---|---|---|
| Checkout | DNI + direccion completa (departamento/provincia/distrito/referencia), formulario adaptado segun pais de la tienda (Peru estricto con DNI de 8 digitos y ubigeo; resto de paises con documento y region/ciudad genericos, configurable en Ajustes). | Pedidos con datos suficientes para entrega real; tiendas fuera de Peru dejan de ver campos que no aplican. |
| Seguimiento de pedido | Pagina publica `/tienda/{slug}/pedido/{numero}` con linea de tiempo real, mas buscador de pedido por numero en la tienda (acepta "42", "00042" o "QT-00042"). Enlazada desde WhatsApp y desde la pantalla de exito del checkout. | Compradores dejan de escribirle al vendedor para preguntar "¿como va mi pedido?". |
| Pedidos (vendedor) | Hoja de ruta explicita de estados (en vez de botones sueltos que confundian "como llegue aqui"), con seleccion de repartidor integrada al pasar a "en camino" (o "yo mismo lo entrego" si no hay repartidores registrados) y alerta cuando falta asignar. WhatsApp al comprador acotado solo a los hitos clave (confirmar y entregar) para no generar ruido. | El modulo de Delivery deja de sentirse aislado del flujo principal de pedidos. |
| Conversion checkout | (1) Barra de progreso "Te faltan S/X para envio gratis" en el carrito. (2) Cross-sell "Otros tambien compraron" en la ficha de producto (misma categoria del catalogo real, nunca inventado). (3) Cupon de bienvenida automatico en el primer pedido por tienda (toggle + monto en Ajustes, aplicado por backend segun telefono unico, preview honesto en el checkout antes de confirmar). (4) Countdown real de oferta con fecha de fin definida por el vendedor (nunca fecha inventada; se autooculta al expirar). | Palancas estandar de e-commerce para subir ticket promedio y bajar abandono, sin inventar urgencia falsa. |
| Onboarding | Tour guiado de bienvenida en el dashboard del vendedor y en la tienda publica del comprador (se puede relanzar con el boton "?"). | Menos soporte manual explicando donde esta cada cosa. |
| Calidez visual | Rediseno de landing, login, registro, header/logo, dashboard (menu inferior, tarjetas de inicio) y Configuracion (tabs, toggles, avatares, tokens de color) con la paleta de marca en vez de gris/negro plano. Se corrigio un bug preexistente donde un `display: flex` inline sobrescribia `md:hidden` de Tailwind y duplicaba la barra de tabs en escritorio. | La app dejo de sentirse "fria"/generica; queja explicita del dueño de producto durante este ciclo. |
| Cache | Revalidacion de la pagina de tienda publica bajada de 60s a 20s. | Cambios de Ajustes (envio, precios, cupon) se reflejan casi al instante en vez de tardar hasta un minuto. |

**Migraciones 019-021:** aplicadas en VPS (confirmado por el dueño de producto el 2026-07-21, junto con la 022 del ciclo siguiente).

**Idea capturada, no implementada — evaluar mas adelante:** el dueño de producto propuso evolucionar qtienda hacia un "centro comercial virtual": una vitrina que vende el descubrimiento de tiendas, no solo la creacion de la tuya. Recomendacion dada en el momento: con 3 tiendas activas es prematuro para ser la historia principal del landing (el landing hoy le vende a *vendedores*, un mall le vende a *compradores* — son funnels distintos y mezclarlos ahora diluiria la captacion de vendedores, que sigue siendo la prioridad). Camino sugerido en dos pasos: (1) corto plazo, pulir `/tiendas` (que ya existe como directorio basico) como version embrionaria del "mall" sin tocar el hero del landing; (2) cuando haya 20-30+ tiendas activas reales, recien evaluar promoverlo a protagonista de la home. Ver QT-040 en la tabla de pendientes.

## Resumen Ejecutivo

Qtienda es una plataforma ecommerce multi-tenant para vendedores que quieren crear una tienda publica, cargar productos y recibir pedidos. El repositorio contiene tres superficies principales:

| Superficie | Tecnologia | Estado | Notas |
|---|---|---:|---|
| Backend API | FastAPI, SQLAlchemy async, PostgreSQL | 78% | Funcional, pero con deuda de hardening, tests, migraciones y observabilidad. |
| Web app | Next.js 14, App Router, Tailwind, Zustand | 80% | Cubre landing, tienda publica, dashboard vendedor, comprador y admin basico. Actualizado 2026-07-20: checkout multi-pais, seguimiento de pedido, cross-sell, cupon de bienvenida, countdown de oferta, rediseno visual calido. |
| Mobile app | Expo, React Native, Expo Router | 68% | Flujos comprador/vendedor/repartidor avanzados, pero requiere limpieza y QA de builds. |
| Infraestructura | Docker Compose, Nginx, Postgres compartido | 65% | VPS operativo, pero falta estandarizar dominios, respaldos, monitoreo y despliegue. |
| Admin/operacion | Endpoints + pantallas admin | 45% | Existe base admin, pero faltan herramientas clave para marcha blanca real. |

La aplicacion ya puede operar con usuarios reales, pero todavia esta en una etapa donde el mayor riesgo no es crear nuevas funcionalidades, sino no tener control operativo suficiente sobre lo que ocurre en produccion: tiendas creadas, productos publicados, pedidos generados, usuarios activos, datos de prueba, errores, conversion y uso por dispositivo.

Prioridad inmediata:

| Prioridad | Recomendacion |
|---|---|
| P0 | Fortalecer admin: ver tiendas, usuarios, productos, pedidos, estado, actividad y eliminar/suspender tiendas de prueba de forma controlada. |
| P0 | Proteger o deshabilitar acciones destructivas generales en produccion, especialmente reseteos masivos. |
| P0 | Agregar validaciones de negocio criticas en checkout publico. |
| P1 | Crear dashboard operativo para marcha blanca: metricas, actividad reciente, tiendas sin productos, tiendas con pedidos, usuarios nuevos. |
| P1 | Implementar auditoria visible y trazabilidad de acciones admin. |
| P1 | Formalizar backups, migraciones y smoke tests antes de aumentar usuarios. |

## Arquitectura General

```text
Internet
  |
  v
Nginx host / reverse proxy
  |
  +-- Next.js web: landing, tienda publica, dashboard, admin
  |
  +-- FastAPI backend: API /api/v1
  |
  +-- Uploads locales o CDN/R2
  |
  v
PostgreSQL compartido en VPS
```

### Componentes

| Componente | Ruta | Responsabilidad | Estado | Riesgo principal |
|---|---|---|---:|---|
| Backend | `backend/` | API, auth, negocio, persistencia | 78% | Logica concentrada en endpoints, poca cobertura automatizada. |
| Frontend web | `frontend/` | Web responsive, PWA, dashboard | 75% | Necesita mas herramientas admin y QA responsive real. |
| Mobile | `qtienda-mobile/` | App Expo para vendedor, comprador y delivery | 68% | Logs debug, builds y flujos nativos requieren validacion. |
| Base de datos | `Bdatos/`, `infra/postgres/` | Schema y migraciones SQL | 60% | Migraciones manuales, falta control formal tipo Alembic. |
| Infra | `docker-compose.yml`, `deploy.sh`, `infra/nginx/` | Deploy VPS Docker/Nginx | 65% | Falta monitoreo, backup y dominio API consistente. |

## Mapa De Modulos

### Backend

| Modulo | Estado | % | Archivos clave | Notas | Pendientes |
|---|---|---:|---|---|---|
| Bootstrap API | Estable | 80% | `backend/app/main.py`, `backend/app/api/v1/router.py` | FastAPI con CORS, rate limit, logging y uploads. | Healthcheck extendido, version endpoint, entorno visible para admin. |
| Configuracion | Funcional | 70% | `backend/app/core/config.py` | Variables por entorno con Pydantic. | Validar configuracion obligatoria por ambiente. |
| Auth y roles | Funcional | 75% | `backend/app/core/security.py`, `backend/app/api/v1/endpoints/auth.py` | JWT access/refresh, Google login, roles admin/vendor/buyer/delivery. | Rotacion/revocacion refresh token, proteccion contra sesiones robadas. |
| Tiendas | Funcional | 75% | `backend/app/api/v1/endpoints/stores.py` | Creacion, configuracion, settings, plan free. | Admin debe poder inspeccionar y eliminar/suspender tiendas de prueba. |
| Catalogo | Funcional | 75% | `products.py`, `categories.py`, `uploads.py` | Productos, categorias, imagenes, R2/local fallback. | Operaciones de imagen mas atomicas, panel admin de productos por tienda. |
| Checkout publico | Critico funcional | 85% | `public.py` | Crea pedidos sin login, valida productos, stock, metodo de pago, limites de plan, DNI/ubigeo multi-pais, cupon de bienvenida por telefono, countdown de oferta. | Mas proteccion antifraude/spam; webhook de pagos con tarjeta. |
| Pedidos vendedor | Funcional | 85% | `orders.py` | Estados, stats, detalle, asignacion delivery, WhatsApp link, hoja de ruta con seleccion de repartidor integrada. | Mejorar filtros admin, historial y busqueda global. |
| Delivery | Avanzado | 75% | `delivery.py` | Repartidores, asignacion, foto, GPS, pago cobrado. | Panel admin/tienda con evidencia, trazabilidad de entregas. |
| Planes y pagos | Funcional | 80% | `plans.py`, `services/culqi.py`, `services/plan_expiry.py` | Culqi (tarjeta/Yape), Yape directo con aprobacion admin, expiracion automatica, renovacion que suma dias, aviso previo por email/push. | Webhook Culqi para tarjeta, facturacion. |
| Referidos | Funcional | 85% | `referrals.py`, `services/referrals.py` | Codigo por usuario, registro con `?ref=`, bonus de limites en plan free (+5 prod/+50 pedidos por referido con tienda, tope 10). | Panel admin de referidos, antifraude (mismo IP/dispositivo). |
| Push | Parcial | 65% | `push.py`, `devices.py` | WebPush y Expo Push. | Manejo de errores, limpieza tokens, metricas de entrega. |
| Admin | Funcional | 70% | `admin.py` | Tiendas/usuarios/metricas, approve/suspend/mark-test/delete tienda, suspender/activar usuario, pedidos globales (`/orders`), auditoria (`/audit-logs`), trafico del sitio (`/site-traffic`), reset test data. | Vista global de productos, ver detalle de pedido, exportar CSV, editar rol de usuario. |
| Auditoria | Funcional | 65% | `models.py`, `orders.py`, `admin.py` | Tabla `audit_logs` usada en cambios de estado; visor propio en `/admin/auditoria` desde 2026-07-21 (filtro por entidad). | Filtro por tienda especifica, exportar. |

### Frontend Web

| Modulo | Estado | % | Archivos clave | Notas | Pendientes |
|---|---|---:|---|---|---|
| Landing | Funcional | 82% | `frontend/src/app/page.tsx` | Muestra tiendas activas y CTA; rediseno visual calido 2026-07-20 (header, hero, CTA final). Sigue orientado a captacion de vendedores. | Medir conversion real y origen de trafico; evaluar seccion de descubrimiento (ver QT-040). |
| Tienda publica | Funcional | 85% | `frontend/src/app/tienda/[slug]/page.tsx`, `components/store/StorePage.tsx` | SEO, JSON-LD, busqueda, categorias, carrito, PWA, tour guiado, seguimiento de pedido, cross-sell, countdown de oferta, banner de cupon de bienvenida. | Analytics por tienda mas fino; revisar overlap de badges en `ProductDetailSheet` (bug preexistente menor, no bloqueante). |
| Carrito/checkout | Funcional | 82% | `CartDrawer.tsx`, `cartStore.ts` | Compra sin login, DNI/ubigeo multi-pais, barra de envio gratis, preview de cupon de bienvenida. | Recuperacion de carrito abandonado. |
| Auth web | Funcional | 78% | `auth/*`, `authStore.ts`, `api.ts` | Zustand persist, refresh automatico, rediseno visual calido, logout redirige a home. | Redireccion por rol mas robusta, expiracion visible, flujo real de "olvide mi contraseña" (boton hoy es decorativo). |
| Dashboard vendedor | Funcional | 82% | `dashboard/page.tsx`, `layout.tsx` | Stats, pedidos recientes, tienda, tour guiado de onboarding, top bar consistente en todas las paginas, rediseno visual calido. | Checklist de tienda lista mas completo. |
| Productos | Funcional | 75% | `dashboard/productos/page.tsx` | CRUD, imagenes, TipTap, precio de oferta con countdown de fecha real. | Edicion de imagenes mas segura; validaciones de plan visibles. |
| Pedidos | Funcional | 82% | `dashboard/pedidos/page.tsx` | Lista, detalle, hoja de ruta de estados explicita, asignacion de repartidor integrada al envio. | Mejor UX desktop/tablet, filtros por fecha/metodo/repartidor. |
| Configuracion | Funcional | 78% | `dashboard/configuracion/page.tsx` | Tienda, pagos, categorias, delivery staff, cupon de bienvenida, pais de la tienda, rediseno visual calido (tabs, toggles, avatares). | Validaciones, preview tienda, gestion de zonas. |
| Finanzas | Parcial | 60% | `dashboard/finanzas/page.tsx` | Estadisticas basicas. | Reportes descargables, ventas por metodo, conciliacion. |
| Planes | Funcional | 85% | `dashboard/planes/page.tsx`, `admin/pagos/page.tsx` | Modal Yape directo/tarjeta, estado de pago en verificacion, renovacion visible al vencer, admin aprueba/rechaza Yapes. | Historial de pagos del vendedor. |
| Admin web | Funcional | 72% | `admin/*` | Dashboard con datos de app/trafico/tecnicos, tiendas y usuarios (tarjetas + tabla escritorio), pedidos globales, auditoria, pagos Yape — todo con la paleta calida y modales propios (`ConfirmModal`) desde 2026-07-21. | Vista global de productos, ver detalle de pedido, exportar CSV. |
| PWA | Funcional | 80% | `public/sw.js`, `PWARegister.tsx` | Cache, push, banner "nueva version disponible" con versionado automatico por build Docker. | Revisar cache de datos dinamicos y estrategia offline. |

### Mobile App

| Modulo | Estado | % | Archivos clave | Notas | Pendientes |
|---|---|---:|---|---|---|
| Router/Auth guard | Funcional | 70% | `qtienda-mobile/app/_layout.tsx` | Redireccion por rol, SecureStore. | Reducir logs y validar deep links. |
| API client | Funcional | 70% | `qtienda-mobile/lib/api.ts` | Axios con refresh. | Confirmar dominio API final. |
| Vendedor | Funcional | 65% | `app/(vendor)/*` | Dashboard, pedidos, productos, configuracion, finanzas. | QA de flujos completos y errores offline. |
| Comprador | Funcional | 65% | `app/(buyer)/*`, `app/(auth)/tienda/[slug].tsx` | Tiendas, pedidos, checkout. | Evitar duplicacion entre auth/buyer tienda. |
| Delivery | Avanzado | 75% | `app/(delivery)/app.tsx` | Foto, GPS, entrega, cobro. | Validacion en dispositivos reales, permisos, subida robusta. |
| Push nativo | Parcial | 60% | `hooks/usePushNotifications.ts` | Expo Push token registrado en backend. | Produccion sin logs, manejo tokens invalidos. |
| Build EAS | Configurado | 65% | `app.json`, `eas.json` | Android configurado. | Checklist release y versionado. |

## Estado Actual De Marcha Blanca

| Aspecto | Situacion actual | Riesgo | Recomendacion |
|---|---|---|---|
| Usuarios reales | Ya hay alrededor de 4 usuarios publicos usando web responsive | Falta visibilidad de comportamiento y soporte | Crear panel admin de actividad y tiendas creadas. |
| Tiendas creadas | Hay tiendas reales y tiendas de prueba; ~3 tiendas creadas reportadas en los ultimos dias (2026-07-20, dato del dueño de producto, no verificado contra admin panel en esta revision) | Se mezclan datos reales con prueba; aun sin masa critica para justificar un cambio de posicionamiento tipo "mall" (ver QT-040) | Agregar clasificacion, suspension y eliminacion controlada. |
| Dispositivos | Uso confirmado en celulares, posiblemente laptops | No hay medicion clara | Agregar analytics por dispositivo y navegador. |
| Deploy | VPS Docker + Nginx | Riesgo operativo si no hay backup/monitoreo | Checklist diario y backups automatizados. |
| Soporte | Manual | Dificil diagnosticar problemas de usuarios | Admin debe ver tienda, usuario, productos, pedidos y errores. |

## Herramientas Admin Recomendadas

### Admin Dashboard Operativo

| Feature | Prioridad | Descripcion | Beneficio |
|---|---:|---|---|
| Vista general marcha blanca | P0 | Usuarios nuevos, tiendas creadas, productos publicados, pedidos, GMV, errores recientes. | Control diario del piloto. |
| Tiendas creadas | P0 | Tabla con tienda, duenio, email, celular, fecha, estado, productos, pedidos, ultima actividad. | Saber que estan creando los usuarios. |
| Ver tienda como admin | P0 | Boton para abrir tienda publica y detalle interno admin. | Soporte rapido. |
| Detalle de tienda | P0 | Productos, categorias, pagos configurados, pedidos, imagenes, estado, plan. | Diagnostico sin entrar como usuario. |
| Suspender tienda | P0 | Cambiar `status` a suspended con razon. | Ocultar tienda problematica sin borrar datos. |
| Eliminar tienda de prueba | P0 | Soft delete con confirmacion, razon, usuario admin y auditoria. | Limpiar marcha blanca sin borrar por error. |
| Marcar como prueba | P0 | Flag o tag `is_test` / metadata admin. | Separar metricas reales de pruebas. |
| Busqueda global | P1 | Buscar por email, telefono, slug, nombre tienda, pedido. | Soporte y operacion. |
| Auditoria admin | P1 | Ver acciones: suspendio, elimino, reactivo, cambio plan. | Trazabilidad. |
| Export CSV | P1 | Usuarios, tiendas, pedidos, productos. | Analisis comercial. |
| Analytics dispositivo | P1 | Mobile/desktop, browser, origen, landing vs tienda. | Saber como usan la app. |

### Acciones Admin Sobre Tiendas

| Accion | Tipo recomendado | Debe borrar datos fisicamente | Auditoria | Comentario |
|---|---|---:|---:|---|
| Suspender tienda | Cambio de estado | No | Si | Primera opcion para tiendas reales o dudosas. |
| Reactivar tienda | Cambio de estado | No | Si | Para soporte. |
| Marcar tienda como prueba | Metadata/admin flag | No | Si | Para excluir de metricas. |
| Ocultar tienda publica | Cambio `status` | No | Si | Evita ventas sin eliminar historial. |
| Eliminar tienda de prueba | Soft delete | No inicialmente | Si | Debe pedir razon y confirmacion. |
| Purga fisica | Job/manual restringido | Si | Si | Solo para datos claramente descartables y con backup. |

## Riesgos Criticos Detectados

| ID | Prioridad | Area | Riesgo | Recomendacion |
|---|---:|---|---|---|
| R-001 | P0 | Checkout | `POST /public/store/{slug}/orders` no valida que la tienda este `active`. | Resuelto 2026-07-09: responde 403 si la tienda no esta activa. |
| R-002 | P0 | Admin | Existe endpoint `/admin/reset-test-data`. | Resuelto: bloqueado con 403 cuando `DEBUG=False` y exige confirmacion. |
| R-003 | P0 | QA | No hay tests propios detectables. | Agregar smoke tests API y flujo web minimo. |
| R-004 | P0 | Operacion | No hay panel admin suficiente para ver actividad real. | Priorizar admin operativo. |
| R-005 | P1 | DB | Migraciones SQL manuales. | Resuelto 2026-07-10: `apply_migrations.sh` versionado con tabla de control (sin Alembic, suficiente para esta etapa). |
| R-006 | P1 | Pagos | Culqi no tiene webhook/conciliacion. | Mitigado parcialmente: Yape directo con aprobacion manual admin es la via principal. Webhook sigue pendiente para tarjeta. |
| R-009 | P0 | Planes | Plans pro/elite tenian limites en 0 y el check los trataba como "limite alcanzado": bloqueaba pedidos/productos a clientes de pago. | Resuelto 2026-07-10: migracion 011 normaliza a NULL y el codigo trata 0/NULL como ilimitado. Verificar que 011 corra en VPS. |
| R-010 | P1 | Planes | Migracion 011 dice free = 50 pedidos/mes, BD local tiene 500 y el texto de features dice "500 pedidos/mes". | Resuelto 2026-07-10: limite definitivo 50/mes, migracion 016 converge todo. |
| R-007 | P1 | Mobile | Logs debug en produccion. | Resuelto 2026-07-10: logger condicionado por `__DEV__` en `lib/logger.ts`, sin console.* directos. |
| R-008 | P1 | Deploy | Posible inconsistencia `qtienda.shop/api` vs `api.qtienda.shop/api`. | Definir dominio canonico de API. |

## Tracking De Pendientes

| ID | Prioridad | Modulo | Pendiente | Resultado esperado | Estado |
|---|---:|---|---|---|---|
| QT-001 | P0 | Backend/Public | Validar tienda activa en checkout publico. | No se aceptan pedidos en tiendas suspendidas/pending/banned. | Hecho (403 si status != active) |
| QT-002 | P0 | Admin | Deshabilitar o blindar `/reset-test-data` en produccion. | No existe riesgo de borrado masivo accidental. | Hecho (403 si no DEBUG + confirmacion) |
| QT-003 | P0 | Admin | Crear listado admin de tiendas con filtros y metricas. | Ver todas las tiendas creadas por usuarios. | Hecho (endpoint + `admin/tiendas`) |
| QT-004 | P0 | Admin | Crear detalle admin de tienda. | Ver productos, pedidos, pagos, configuracion y actividad. | Hecho (drawer en `admin/tiendas`) |
| QT-005 | P0 | Admin | Suspender/reactivar tiendas desde admin. | Control operativo sin borrar datos. | Hecho (suspend/approve con auditoria) |
| QT-006 | P0 | Admin | Eliminar tiendas de prueba con soft delete y auditoria. | Limpieza segura de marcha blanca. | Hecho (confirm DELETE + razon + audit log) |
| QT-007 | P0 | Admin | Marcar tiendas/usuarios como prueba. | Separar metricas reales de pruebas. | Hecho para tiendas (`is_test` + migracion 010) |
| QT-008 | P1 | Analytics | Registrar eventos basicos: tienda vista, producto visto, add cart, checkout. | Saber uso real por celular/laptop y conversion. | Hecho 2026-07-10 (migracion 017 `store_events`, endpoint publico + `order_created` server-side, dispositivo/sesion, metricas en `GET /stores/me/analytics` y tarjeta "ultimos 30 dias" en dashboard) |
| QT-009 | P1 | QA | Smoke tests backend. | Validacion rapida antes de deploy. | Hecho 2026-07-10 (`smoke_test.py` solo lecturas, integrado al final de `deploy.sh`, probado contra produccion 5/5) |
| QT-010 | P1 | QA | Smoke tests web responsive. | Validar landing, tienda, login, dashboard y checkout. | Hecho 2026-07-10 (seccion web en `smoke_test.py`: landing, tienda publica renderizada, manifest y sw.js; probado contra produccion 9/9) |
| QT-011 | P1 | DB | Definir estrategia backup diaria. | Recuperacion ante error operativo. | Parcial (script `infra/backup_postgres.sh` con rotacion 14 dias listo; falta programar cron en VPS y verificar primer backup) |
| QT-012 | P1 | DB | Formalizar migraciones. | Despliegues reproducibles. | Hecho 2026-07-10 (`Bdatos/apply_migrations.sh` con tabla `schema_migrations`, solo pendientes, aborta si falla; integrado en deploy.sh; primera vez en VPS: `BASELINE=015 ./Bdatos/apply_migrations.sh`) |
| QT-013 | P1 | Observabilidad | Logs estructurados y errores visibles. | Diagnostico rapido en VPS. | Hecho 2026-07-10 (JSON por linea en produccion via `core/logging.py`, middleware con status/duracion/IP real, WARNING en 4xx y lentos >2s, ERROR con traceback en excepciones no manejadas) |
| QT-014 | P1 | Pagos | Webhook Culqi. | Suscripciones confiables. | Pendiente (mitigado: Yape directo manual es la via principal) |
| QT-015 | P1 | Mobile | Limpiar logs debug. | Build listo para usuarios reales. | Hecho 2026-07-10 (`lib/logger.ts` condicionado a `__DEV__`, 21 console.* migrados en 7 archivos) |
| QT-016 | P1 | Frontend | Mejorar panel pedidos desktop/tablet. | Soporte a vendedores en laptop. | Hecho 2026-07-10 (layout dos paneles en desktop: lista + detalle lateral fijo con pedido seleccionado resaltado; drawer inferior se mantiene en movil; filtro por fecha Hoy/7d/30d con soporte `from_date`/`to_date` en API) |
| QT-017 | P2 | Producto | Onboarding/checklist vendedor. | Mejor activacion de nuevos usuarios. | Backlog |
| QT-018 | P2 | Producto | Reportes exportables. | Analisis comercial y soporte. | Backlog |
| QT-019 | P2 | Producto | Cupones, variantes, dominios propios. | Roadmap comercial. | Backlog |
| QT-020 | P0 | Pagos | Yape directo para suscripciones (pago manual al celular admin + aprobacion en `admin/pagos`). | Vendedores sin tarjeta pueden pagar plan. | Hecho 2026-07-10 (migracion 013, probado e2e) |
| QT-021 | P1 | Producto | Sistema de referidos con bonus de limites en plan free y banner en dashboard. | Crecimiento organico de usuarios. | Hecho 2026-07-10 (migracion 012, probado e2e) |
| QT-022 | P1 | Planes | Expiracion automatica de suscripcion, renovacion que suma dias y aviso previo (email + push web + Expo) 3 dias antes. | Ciclo de suscripcion completo. | Hecho 2026-07-10 (migracion 014, watcher en lifespan) |
| QT-023 | P1 | PWA | Banner "nueva version disponible" con versionado automatico del SW en build Docker. | Usuarios con cache vieja se enteran de mejoras. | Hecho 2026-07-10 |
| QT-024 | P0 | Deploy | Ejecutar y verificar migraciones 010-018 en Postgres del VPS. | Backend nuevo funciona en produccion. | Hecho 2026-07-10 (verificado contra prod: banners/store_hours/sold_count presentes en API, smoke test 9/9) |
| QT-025 | P1 | Planes | Alinear limite de pedidos free: migracion 011 dice 50, BD local 500, features dice "500 pedidos/mes". | Un solo valor consistente en archivo, BD y UI. | Hecho 2026-07-10 (decision: 50/mes; migracion 016 converge cualquier BD, fallback en referrals.py corregido; produccion ya estaba en 50) |
| QT-026 | P2 | Pagos | Activar Yape en panel de Culqi (opcional, ya existe Yape directo). | Yape tambien via pasarela. | Backlog |
| QT-027 | P2 | Admin | Notificar al admin (push/email) cuando llega una solicitud de pago Yape. | Aprobacion mas rapida sin revisar panel. | Backlog |
| QT-028 | P1 | Frontend | Mostrar banner del vendedor en tienda publica (estilo TEMU: se desliza y desvanece al hacer scroll) y hacerlo clickeable con enlace opcional configurable en ajustes. | Banner subido en configuracion se usa en la tienda y puede dirigir a una promo/producto. | Hecho 2026-07-10 (migracion 015, validacion de esquema http/ruta contra XSS) |
| QT-029 | P1 | Frontend | UX tienda publica: indicador Abierto/Cerrado (horario por dia configurable en ajustes, usa columna `store_hours` existente), skeletons shimmer en imagenes de productos y badges de prueba social ("X vendidos" con pedidos no cancelados, "NUEVO" primeros 14 dias). | Tienda se siente mas viva, rapida y confiable para el comprador. | Hecho 2026-07-10 (sin migracion, `store_hours` ya existia) |
| QT-030 | P2 | Producto | Carrusel de hasta 3 banners rotando (swipe + auto-rotacion) como feature del plan Pro; requiere tabla `store_banners`. | Diferenciador visible del plan Pro. | Hecho 2026-07-10 (migracion 018 migra banner existente; free=1 / pro-elite=3 con 403 si excede; carrusel con swipe, auto-rotacion 5s pausable y puntitos; `stores.banner_url` sincronizado con el 1er banner para app movil y OG) |
| QT-031 | P1 | Frontend | Rediseno "pro" de tienda publica: franja de marca con color del vendedor, layout desktop/tablet aprovechado (contenedor 5xl, grilla 3-4 columnas, lista a 2 columnas), banner panoramico en desktop, hover con zoom de imagen y elevacion, footer con identidad de tienda + boton WhatsApp. | Tienda se ve profesional en celular, tablet y laptop. | Hecho 2026-07-10 (build de produccion verificado) |
| QT-033 | P1 | Frontend | Version laptop/tablet de toda la app: tienda publica hasta 1280px con grilla de 5 col (y grilla por defecto en desktop), dashboard inicio con stats+analytics lado a lado, catalogo hasta 1280px con 2-3 col, finanzas en 2 columnas (hero+KPIs, plan+pagos, grafico y movimientos a lo ancho), delivery en 2 columnas, ajustes/mis-pedidos/tiendas ensanchados. | App completa aprovecha pantallas grandes sin verse como celular centrado. | Hecho 2026-07-10 (tercera pasada: header desktop de una fila con buscador al centro estilo ecommerce, mas aire en grillas, vista lista con alturas iguales; build verificado; falta deploy) |
| QT-034 | — | Producto | Tema oscuro: evaluado 2026-07-11 y descartado por decision de producto. Seria viable solo en dashboard (sistema de 44 variables CSS lo permite), pero la tienda publica debe seguir clara (colores de marca de vendedores, banners y conversion), y tener la app mitad oscura/mitad clara se sentiria inconsistente. Se mantiene todo en claro. | — | Descartado (no reabrir salvo pedido explicito) |
| QT-032 | P1 | VPS | Housekeeping servidor (verificar 2026-07-11): (a) confirmar primer backup en /opt/qtienda/backups tras el cron de las 3:30am; (b) eliminar config nginx duplicada de qtienda.shop en sites-enabled (warns "conflicting server name"); (c) reinicio pendiente del VPS por kernel (verificar antes restart policy de contenedores y despues `curl /health`). | VPS limpio, backup verificado y kernel actualizado. | Pendiente (nginx /health ya aplicado, smoke test 10/10 el 2026-07-10) |
| QT-035 | P1 | Checkout | DNI + ubigeo (departamento/provincia/distrito/referencia) en el pedido, adaptado segun pais de la tienda configurado en Ajustes. | Datos suficientes para coordinar entrega real; tiendas fuera de Peru no ven campos que no aplican. | Hecho 2026-07-20 (migracion 019, verificado e2e con Playwright) |
| QT-036 | P1 | Checkout/Delivery | Pagina publica de seguimiento de pedido (linea de tiempo) + buscador por numero en la tienda; hoja de ruta de estados en el panel del vendedor con seleccion de repartidor integrada al pasar a "en camino". | Comprador deja de preguntarle al vendedor "¿como va mi pedido?"; Delivery deja de sentirse aislado del flujo de Pedidos. | Hecho 2026-07-20 (sin migracion nueva, usa columnas existentes) |
| QT-037 | P2 | Producto | Onboarding guiado: tour en el dashboard del vendedor y en la tienda publica del comprador, relanzable con boton "?". | Menos soporte manual explicando la interfaz. | Hecho 2026-07-20 |
| QT-038 | P1 | Conversion | Envio gratis con barra de progreso, cross-sell "otros tambien compraron", cupon de bienvenida en el primer pedido (por telefono, preview honesto pre-confirmacion), countdown real de oferta con fecha definida por el vendedor. | Palancas estandar de e-commerce para ticket promedio y abandono, sin urgencia falsa. | Hecho 2026-07-20 (migraciones 020 y 021, verificado e2e con Playwright incluyendo caso "no elegible") |
| QT-039 | P2 | Frontend | Rediseno visual calido: landing, login, registro, dashboard y Configuracion migrados de gris/negro plano a la paleta de marca (terracota); fix de bug preexistente `display:flex` inline que duplicaba tabs en escritorio. | La app dejo de sentirse "fria"/generica — queja explicita del dueño de producto. | Hecho 2026-07-20 |
| QT-040 | P2 | Producto | Evaluar "centro comercial virtual": vitrina de descubrimiento de tiendas como protagonista de la home, en vez de solo captacion de vendedores. Idea del dueño de producto, capturada 2026-07-20, no implementada. | Nuevo canal de crecimiento cuando haya masa critica de tiendas. | Backlog — revisar cuando haya 20-30+ tiendas activas reales; corto plazo, pulir `/tiendas` como version embrionaria sin tocar el hero del landing. |
| QT-041 | P2 | Catalogo | Publicar producto deja de ser automatico: `ProductCreate.status` nace `"inactive"`, toggle "Publicar en la tienda" explicito en crear/editar (web y movil). | El vendedor controla cuando el producto se ve en la tienda, en vez de publicarse solo por tener stock. | Hecho 2026-07-21 |
| QT-042 | P1 | Admin | Pulido visual completo del panel Admin (4 screens) a la paleta calida + reemplazo de `window.confirm/prompt` nativos por `ConfirmModal` propio. | El admin deja de sentirse una app distinta/generica pegada al resto de qtienda. | Hecho 2026-07-21 |
| QT-043 | P1 | Admin | Suspender/activar usuario (`PATCH /admin/users/{id}`) y visor de auditoria (`/admin/auditoria`, tabla `audit_logs` que ya existia sin UI). | Cierra dos huecos P1 del backlog original de Admin. | Hecho 2026-07-21 |
| QT-044 | P1 | Admin | Tablas densas de escritorio para `/admin/tiendas` y `/admin/usuarios` (antes tarjetas moviles estiradas); `/admin/pedidos` nuevo con vista global de pedidos de todas las tiendas, filtro por estado y busqueda. | El admin es usable en laptop y ya cubre pedidos globales, no solo por tienda. | Hecho 2026-07-21 (pendiente: ver detalle de pedido y exportar CSV) |
| QT-045 | P1 | Analytics | Trafico a nivel dominio: migracion `022_site_events.sql`, tracking de landing/`tiendas` (antes sin instrumentar), y `GET /admin/site-traffic` que agrega esto mas los `store_events` existentes vistos por primera vez de forma global (no por tienda). Dashboard admin muestra vistas/visitantes unicos, paginas mas vistas y embudo de conversion agregado. | Primera vez con visibilidad real de trafico del sitio completo, no solo de una tienda a la vez. | Hecho 2026-07-21 |

## Backlog Especifico Admin

| Pantalla | Campos minimos | Acciones minimas | Prioridad | Estado |
|---|---|---|---:|---|
| Admin Inicio | tiendas totales, activas, prueba, usuarios, pedidos, ventas, nuevos hoy | Ver tiendas, ver usuarios, exportar | P0 | Hecho salvo exportar (ver tambien trafico del sitio, altas 14d, tecnicos) |
| Admin Tiendas | slug, nombre, duenio, email, telefono, estado, productos, pedidos, fecha, ultima actividad | Ver, abrir publica, suspender, reactivar, marcar prueba, soft delete | P0 | Hecho (tarjetas + tabla escritorio 2026-07-21) |
| Admin Detalle Tienda | datos tienda, settings pagos, productos, pedidos recientes, imagenes, plan | Cambiar estado, editar nota admin, limpiar prueba | P0 | Hecho salvo "nota admin" |
| Admin Usuarios | nombre, email, rol, telefono, verificado, activo, tienda, fecha | Suspender usuario, ver tienda, reset soporte | P1 | Suspender hecho 2026-07-21 (tarjetas + tabla); falta "ver tienda del vendedor" y "reset soporte" |
| Admin Productos | tienda, producto, precio, stock, estado, imagen | Revisar contenido, ocultar producto | P1 | Backlog — sin construir |
| Admin Pedidos | tienda, cliente, estado, monto, fecha, metodo pago | Ver detalle, filtrar, exportar | P1 | Lista + filtrar hecho 2026-07-21 (`/admin/pedidos`); falta ver detalle y exportar |
| Admin Auditoria | admin, accion, entidad, fecha, old/new | Filtrar por tienda/usuario | P1 | Hecho 2026-07-21 (`/admin/auditoria`, filtro por entidad; falta filtro por tienda especifica) |

## Recomendaciones De Arquitecto Senior

1. No borrar fisicamente datos reales durante marcha blanca. Usar soft delete, estados y auditoria.
2. Separar datos de prueba de datos reales con una marca explicita. Si no se agrega columna todavia, usar tabla auxiliar o metadata admin.
3. Convertir el admin en herramienta principal de soporte, no solo en panel de metricas.
4. Agregar smoke tests antes de cada deploy: login admin, listar tiendas, crear tienda, crear producto, checkout, ver pedido.
5. Tener backup diario de Postgres y backup manual antes de migraciones.
6. Definir un dominio canonico para API y usarlo igual en web, mobile y documentacion.
7. Mantener el endpoint destructivo de reset solo en entorno test/dev.
8. Medir uso por dispositivo y origen desde ya. En marcha blanca, esa informacion vale mas que features nuevas.
9. Registrar acciones admin en `audit_logs` para poder explicar cualquier cambio.
10. Crear un checklist operativo diario mientras dure la marcha blanca.

## Checklist Operativo Diario

| Item | Frecuencia | Responsable | Estado |
|---|---|---|---|
| Revisar nuevas tiendas creadas | Diario | Admin | Pendiente |
| Revisar tiendas sin productos | Diario | Admin | Pendiente |
| Revisar pedidos generados y fallidos | Diario | Admin | Pendiente |
| Revisar errores API/web | Diario | Tecnico | Pendiente |
| Confirmar backup Postgres | Diario | Tecnico | Pendiente |
| Revisar uploads/imagenes rotas | 2-3 veces por semana | Admin/Tecnico | Pendiente |
| Limpiar tiendas marcadas como prueba | Semanal | Admin | Pendiente |
| Revisar conversion landing -> registro -> tienda creada | Semanal | Producto | Pendiente |

## Roadmap Sugerido

### Semana 1 - Control De Marcha Blanca

| Prioridad | Entregable |
|---|---|
| P0 | Admin tiendas completo: listar, filtrar, ver detalle, abrir publica. |
| P0 | Suspender/reactivar/marcar prueba/soft delete tienda. |
| P0 | Proteger reset masivo. |
| P0 | Validar tienda activa en checkout. |
| P1 | Backup documentado y smoke test API basico. |

### Semana 2 - Observabilidad Y Soporte

| Prioridad | Entregable |
|---|---|
| P1 | Auditoria admin visible. |
| P1 | Actividad reciente por tienda y usuario. |
| P1 | Analytics por dispositivo/origen. |
| P1 | Export CSV de tiendas/usuarios/pedidos. |

### Semana 3 - Estabilidad Producto

| Prioridad | Entregable |
|---|---|
| P1 | Tests web responsive basicos. |
| P1 | Migraciones formalizadas. |
| P1 | Limpieza logs mobile. |
| P2 | Onboarding vendedor y checklist de tienda lista. |

## Definicion De Listo Para Salir De Marcha Blanca

| Criterio | Estado requerido |
|---|---|
| Admin puede ver y gestionar tiendas reales/de prueba | Obligatorio — CUMPLIDO |
| Hay backups automaticos verificados | Obligatorio — PARCIAL (script listo, falta cron en VPS) |
| Hay smoke tests antes de deploy | Obligatorio — CUMPLIDO (integrado en deploy.sh) |
| No hay endpoint destructivo disponible en produccion | Obligatorio — CUMPLIDO |
| Checkout bloquea tiendas no activas | Obligatorio — CUMPLIDO |
| Se mide uso por dispositivo y conversion basica | Recomendado — PENDIENTE |
| Se puede exportar informacion operativa | Recomendado — PENDIENTE |
| Pagos de planes tienen webhook/conciliacion | Requerido antes de cobro masivo — mitigado con Yape directo manual |

## Archivos Clave Del Repositorio

| Area | Archivos |
|---|---|
| Backend entrada | `backend/app/main.py`, `backend/app/api/v1/router.py` |
| Backend seguridad | `backend/app/core/security.py`, `backend/app/core/config.py` |
| Modelos | `backend/app/models/models.py` |
| Public/checkout | `backend/app/api/v1/endpoints/public.py` |
| Admin | `backend/app/api/v1/endpoints/admin.py`, `frontend/src/app/admin/*` |
| Tiendas/productos | `stores.py`, `products.py`, `categories.py`, `uploads.py` |
| Pedidos/delivery | `orders.py`, `delivery.py` |
| Pagos/planes | `plans.py`, `backend/app/services/culqi.py` |
| Web app | `frontend/src/app/*`, `frontend/src/components/*`, `frontend/src/store/*` |
| Mobile app | `qtienda-mobile/app/*`, `qtienda-mobile/lib/api.ts`, `qtienda-mobile/store/*` |
| Deploy | `docker-compose.yml`, `deploy.sh`, `infra/nginx/qtienda.conf` |
| DB | `Bdatos/init.sql`, `Bdatos/migrations/*.sql` |

## Nota Final

La prioridad del proyecto en esta etapa debe cambiar de "construir mas features" a "operar con control". Ya hay usuarios reales creando tiendas, por lo que el admin, la auditoria, los backups, los filtros de datos de prueba y la visibilidad de actividad son ahora parte central del producto.
