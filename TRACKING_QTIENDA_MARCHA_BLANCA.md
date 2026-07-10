# QTIENDA - Tracking Marcha Blanca

Fecha de analisis: 2026-07-09  
Ultima actualizacion: 2026-07-10  
Estado del producto: marcha blanca desplegada en VPS con Docker  
Contexto operativo: ya existen usuarios reales creando tiendas desde web responsive, principalmente celular y posiblemente laptop.

## Resumen Ejecutivo

Qtienda es una plataforma ecommerce multi-tenant para vendedores que quieren crear una tienda publica, cargar productos y recibir pedidos. El repositorio contiene tres superficies principales:

| Superficie | Tecnologia | Estado | Notas |
|---|---|---:|---|
| Backend API | FastAPI, SQLAlchemy async, PostgreSQL | 78% | Funcional, pero con deuda de hardening, tests, migraciones y observabilidad. |
| Web app | Next.js 14, App Router, Tailwind, Zustand | 75% | Cubre landing, tienda publica, dashboard vendedor, comprador y admin basico. |
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
| Checkout publico | Critico funcional | 78% | `public.py` | Crea pedidos sin login, valida productos, stock, metodo de pago y limites de plan. | Validar tienda activa al crear pedido; mas proteccion antifraude/spam. |
| Pedidos vendedor | Funcional | 80% | `orders.py` | Estados, stats, detalle, asignacion delivery, WhatsApp link. | Mejorar filtros admin, historial y busqueda global. |
| Delivery | Avanzado | 75% | `delivery.py` | Repartidores, asignacion, foto, GPS, pago cobrado. | Panel admin/tienda con evidencia, trazabilidad de entregas. |
| Planes y pagos | Funcional | 80% | `plans.py`, `services/culqi.py`, `services/plan_expiry.py` | Culqi (tarjeta/Yape), Yape directo con aprobacion admin, expiracion automatica, renovacion que suma dias, aviso previo por email/push. | Webhook Culqi para tarjeta, facturacion. |
| Referidos | Funcional | 85% | `referrals.py`, `services/referrals.py` | Codigo por usuario, registro con `?ref=`, bonus de limites en plan free (+5 prod/+50 pedidos por referido con tienda, tope 10). | Panel admin de referidos, antifraude (mismo IP/dispositivo). |
| Push | Parcial | 65% | `push.py`, `devices.py` | WebPush y Expo Push. | Manejo de errores, limpieza tokens, metricas de entrega. |
| Admin | Insuficiente para marcha blanca | 45% | `admin.py` | Lista tiendas/usuarios/metricas basicas, approve/suspend, reset test data. | Admin operativo completo, eliminacion controlada, auditoria visible. |
| Auditoria | Base creada | 35% | `models.py`, `orders.py` | Tabla `audit_logs` usada en cambios de estado. | Extender a acciones admin, tienda, producto, usuario y eliminaciones. |

### Frontend Web

| Modulo | Estado | % | Archivos clave | Notas | Pendientes |
|---|---|---:|---|---|---|
| Landing | Funcional | 80% | `frontend/src/app/page.tsx` | Muestra tiendas activas y CTA. | Medir conversion real y origen de trafico. |
| Tienda publica | Funcional | 80% | `frontend/src/app/tienda/[slug]/page.tsx`, `components/store/StorePage.tsx` | SEO, JSON-LD, busqueda, categorias, carrito, PWA. | Analytics por tienda, eventos de carrito/checkout. |
| Carrito/checkout | Funcional | 75% | `CartDrawer.tsx`, `cartStore.ts` | Compra sin login. | Mejorar seguimiento post compra y recuperacion de carrito. |
| Auth web | Funcional | 75% | `auth/*`, `authStore.ts`, `api.ts` | Zustand persist, refresh automatico. | Redireccion por rol mas robusta, expiracion visible. |
| Dashboard vendedor | Funcional | 75% | `dashboard/page.tsx`, `layout.tsx` | Stats, pedidos recientes, tienda. | Onboarding guiado, checklist de tienda lista. |
| Productos | Funcional | 70% | `dashboard/productos/page.tsx` | CRUD, imagenes, TipTap. | Edicion de imagenes mas segura; validaciones de plan visibles. |
| Pedidos | Funcional | 75% | `dashboard/pedidos/page.tsx` | Lista, detalle, cambio estado, WhatsApp. | Mejor UX desktop/tablet, filtros por fecha/metodo/repartidor. |
| Configuracion | Funcional | 70% | `dashboard/configuracion/page.tsx` | Tienda, pagos, categorias, delivery staff. | Validaciones, preview tienda, gestion de zonas. |
| Finanzas | Parcial | 60% | `dashboard/finanzas/page.tsx` | Estadisticas basicas. | Reportes descargables, ventas por metodo, conciliacion. |
| Planes | Funcional | 85% | `dashboard/planes/page.tsx`, `admin/pagos/page.tsx` | Modal Yape directo/tarjeta, estado de pago en verificacion, renovacion visible al vencer, admin aprueba/rechaza Yapes. | Historial de pagos del vendedor. |
| Admin web | Basico | 45% | `admin/*` | Vistas iniciales. | Herramientas de inspeccion, limpieza y soporte. |
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
| Tiendas creadas | Hay tiendas reales y tiendas de prueba | Se mezclan datos reales con prueba | Agregar clasificacion, suspension y eliminacion controlada. |
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
| R-005 | P1 | DB | Migraciones SQL manuales. | Formalizar Alembic o procedimiento versionado estricto. |
| R-006 | P1 | Pagos | Culqi no tiene webhook/conciliacion. | Mitigado parcialmente: Yape directo con aprobacion manual admin es la via principal. Webhook sigue pendiente para tarjeta. |
| R-009 | P0 | Planes | Plans pro/elite tenian limites en 0 y el check los trataba como "limite alcanzado": bloqueaba pedidos/productos a clientes de pago. | Resuelto 2026-07-10: migracion 011 normaliza a NULL y el codigo trata 0/NULL como ilimitado. Verificar que 011 corra en VPS. |
| R-010 | P1 | Planes | Migracion 011 dice free = 50 pedidos/mes, BD local tiene 500 y el texto de features dice "500 pedidos/mes". | Definir el limite real y alinear archivo, BD y features. |
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
| QT-008 | P1 | Analytics | Registrar eventos basicos: tienda vista, producto visto, add cart, checkout. | Saber uso real por celular/laptop y conversion. | Pendiente |
| QT-009 | P1 | QA | Smoke tests backend. | Validacion rapida antes de deploy. | Hecho 2026-07-10 (`smoke_test.py` solo lecturas, integrado al final de `deploy.sh`, probado contra produccion 5/5) |
| QT-010 | P1 | QA | Smoke tests web responsive. | Validar landing, tienda, login, dashboard y checkout. | Pendiente |
| QT-011 | P1 | DB | Definir estrategia backup diaria. | Recuperacion ante error operativo. | Parcial (script `infra/backup_postgres.sh` con rotacion 14 dias listo; falta programar cron en VPS y verificar primer backup) |
| QT-012 | P1 | DB | Formalizar migraciones. | Despliegues reproducibles. | Pendiente |
| QT-013 | P1 | Observabilidad | Logs estructurados y errores visibles. | Diagnostico rapido en VPS. | Pendiente |
| QT-014 | P1 | Pagos | Webhook Culqi. | Suscripciones confiables. | Pendiente (mitigado: Yape directo manual es la via principal) |
| QT-015 | P1 | Mobile | Limpiar logs debug. | Build listo para usuarios reales. | Hecho 2026-07-10 (`lib/logger.ts` condicionado a `__DEV__`, 21 console.* migrados en 7 archivos) |
| QT-016 | P1 | Frontend | Mejorar panel pedidos desktop/tablet. | Soporte a vendedores en laptop. | Pendiente |
| QT-017 | P2 | Producto | Onboarding/checklist vendedor. | Mejor activacion de nuevos usuarios. | Backlog |
| QT-018 | P2 | Producto | Reportes exportables. | Analisis comercial y soporte. | Backlog |
| QT-019 | P2 | Producto | Cupones, variantes, dominios propios. | Roadmap comercial. | Backlog |
| QT-020 | P0 | Pagos | Yape directo para suscripciones (pago manual al celular admin + aprobacion en `admin/pagos`). | Vendedores sin tarjeta pueden pagar plan. | Hecho 2026-07-10 (migracion 013, probado e2e) |
| QT-021 | P1 | Producto | Sistema de referidos con bonus de limites en plan free y banner en dashboard. | Crecimiento organico de usuarios. | Hecho 2026-07-10 (migracion 012, probado e2e) |
| QT-022 | P1 | Planes | Expiracion automatica de suscripcion, renovacion que suma dias y aviso previo (email + push web + Expo) 3 dias antes. | Ciclo de suscripcion completo. | Hecho 2026-07-10 (migracion 014, watcher en lifespan) |
| QT-023 | P1 | PWA | Banner "nueva version disponible" con versionado automatico del SW en build Docker. | Usuarios con cache vieja se enteran de mejoras. | Hecho 2026-07-10 |
| QT-024 | P0 | Deploy | Ejecutar y verificar migraciones 010-015 en Postgres del VPS. | Backend nuevo funciona en produccion. | Pendiente verificar |
| QT-025 | P1 | Planes | Alinear limite de pedidos free: migracion 011 dice 50, BD local 500, features dice "500 pedidos/mes". | Un solo valor consistente en archivo, BD y UI. | Pendiente decision |
| QT-026 | P2 | Pagos | Activar Yape en panel de Culqi (opcional, ya existe Yape directo). | Yape tambien via pasarela. | Backlog |
| QT-027 | P2 | Admin | Notificar al admin (push/email) cuando llega una solicitud de pago Yape. | Aprobacion mas rapida sin revisar panel. | Backlog |
| QT-028 | P1 | Frontend | Mostrar banner del vendedor en tienda publica (estilo TEMU: se desliza y desvanece al hacer scroll) y hacerlo clickeable con enlace opcional configurable en ajustes. | Banner subido en configuracion se usa en la tienda y puede dirigir a una promo/producto. | Hecho 2026-07-10 (migracion 015, validacion de esquema http/ruta contra XSS) |

## Backlog Especifico Admin

| Pantalla | Campos minimos | Acciones minimas | Prioridad |
|---|---|---|---:|
| Admin Inicio | tiendas totales, activas, prueba, usuarios, pedidos, ventas, nuevos hoy | Ver tiendas, ver usuarios, exportar | P0 |
| Admin Tiendas | slug, nombre, duenio, email, telefono, estado, productos, pedidos, fecha, ultima actividad | Ver, abrir publica, suspender, reactivar, marcar prueba, soft delete | P0 |
| Admin Detalle Tienda | datos tienda, settings pagos, productos, pedidos recientes, imagenes, plan | Cambiar estado, editar nota admin, limpiar prueba | P0 |
| Admin Usuarios | nombre, email, rol, telefono, verificado, activo, tienda, fecha | Suspender usuario, ver tienda, reset soporte | P1 |
| Admin Productos | tienda, producto, precio, stock, estado, imagen | Revisar contenido, ocultar producto | P1 |
| Admin Pedidos | tienda, cliente, estado, monto, fecha, metodo pago | Ver detalle, filtrar, exportar | P1 |
| Admin Auditoria | admin, accion, entidad, fecha, old/new | Filtrar por tienda/usuario | P1 |

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
