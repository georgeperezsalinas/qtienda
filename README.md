# qtienda.shop 🛍️
**Shopify para vendedores de TikTok en Latinoamérica**

## Arquitectura

```
qtienda.shop
├── backend/          FastAPI + SQLAlchemy (async)
├── frontend/         Next.js 14 App Router (mobile-first)
├── infra/
│   ├── postgres/     init.sql (schema completo)
│   └── nginx/        configs opcionales
└── docker-compose.yml  Traefik + TLS automático
```

### Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React, TailwindCSS, Framer Motion, Zustand |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Storage | Cloudflare R2 (S3-compatible) |
| Proxy | Traefik v3 + Let's Encrypt automático |
| Deploy | Docker Compose en VPS Linux |

---

## Flujo Multi-tenant

```
qtienda.shop/tienda/{slug}
         │
         ▼
   [GET /public/store/{slug}]   ← sin auth
         │
         ▼
   StorePage (Next.js SSR/ISR)
   - Carga tienda + productos
   - Comprador agrega al carrito
   - Checkout en 3 pasos
         │
         ▼
   [POST /public/store/{slug}/orders]  ← sin auth
   - Valida productos del store
   - Genera número QT-00001
   - Crea order + items en DB
   - Devuelve link WhatsApp vendedor
         │
         ▼
   Panel Vendedor  [JWT requerido]
   [GET /orders/]  → solo ve SUS pedidos
   [PATCH /orders/{id}/status]
```

---

## Seguridad JWT + Roles

```
POST /api/v1/auth/register  → access_token + refresh_token
POST /api/v1/auth/login
POST /api/v1/auth/refresh

Roles: admin | vendor | buyer

require_vendor = Depends(require_role("admin", "vendor"))
require_admin  = Depends(require_role("admin"))
```

**Multi-tenant enforcement:** Cada endpoint de vendor filtra por `store.user_id == current_user.id`. Imposible ver datos de otro vendedor.

---

## API Endpoints

### Public (sin auth)
```
GET  /api/v1/public/store/{slug}
GET  /api/v1/public/store/{slug}/products?category=
POST /api/v1/public/store/{slug}/orders
GET  /api/v1/public/store/{slug}/orders/{number}/track
```

### Auth
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

### Vendor (JWT)
```
POST   /api/v1/stores/
GET    /api/v1/stores/me
PATCH  /api/v1/stores/me
PATCH  /api/v1/stores/me/settings

GET    /api/v1/products/
POST   /api/v1/products/
PATCH  /api/v1/products/{id}
DELETE /api/v1/products/{id}

GET    /api/v1/categories/
POST   /api/v1/categories/
PATCH  /api/v1/categories/{id}

GET    /api/v1/orders/
GET    /api/v1/orders/{id}
PATCH  /api/v1/orders/{id}/status
GET    /api/v1/orders/stats/summary

POST   /api/v1/uploads/image
```

### Admin (JWT + admin role)
```
GET  /api/v1/admin/stores
GET  /api/v1/admin/stores/{id}
POST /api/v1/admin/stores/{id}/approve
POST /api/v1/admin/stores/{id}/suspend
GET  /api/v1/admin/metrics
GET  /api/v1/admin/users
```

---

## Base de Datos

```sql
users           → Todos los tipos de usuario
roles           → admin | vendor | buyer
stores          → Una tienda por vendedor (slug único)
store_settings  → Pagos, delivery, horarios
categories      → Scoped por store
products        → Scoped por store, soft delete
product_images  → Múltiples fotos por producto
orders          → Scoped por store, sin login de comprador
order_items     → Snapshot de precio al momento del pedido
payments        → Yape, Plin, efectivo, transferencia
deliveries      → Courier, tracking
plans           → Gratis, Pro, Elite
subscriptions   → Estado de suscripción por tienda
audit_logs      → Trazabilidad de cambios
```

---

## Deploy en VPS

```bash
# 1. Clonar repo
git clone https://github.com/tu-user/qtienda .
cd qtienda

# 2. Variables de entorno
cp .env.example .env
nano .env  # Rellenar todos los valores

# 3. DNS
# Apuntar qtienda.shop → IP del VPS (A record)

# 4. Levantar
docker compose up -d

# Traefik obtiene TLS automáticamente con Let's Encrypt
# La app queda en https://qtienda.shop
```

---

## Roadmap MVP

### Fase 1 — Core (Semanas 1-3) ✅
- [x] Arquitectura base
- [x] Schema PostgreSQL
- [x] Auth JWT + roles
- [x] CRUD tiendas
- [x] CRUD productos + imágenes
- [x] Flujo checkout público (sin login)
- [x] Panel básico vendedor
- [x] Docker Compose producción

### Fase 2 — Panel Vendedor (Semanas 4-5)
- [ ] Dashboard con métricas (pedidos, revenue)
- [ ] Gestión estados de pedido con notificaciones
- [ ] Onboarding guiado para nuevos vendedores
- [ ] Upload de imágenes a R2/Cloudflare
- [ ] Personalización de colores y tipografía

### Fase 3 — Monetización (Semana 6-7)
- [ ] Sistema de planes (Gratis → Pro → Elite)
- [ ] Integración pago suscripción (Culqi para Perú)
- [ ] Restricciones por plan (límite productos, pedidos)
- [ ] Panel admin: aprobar vendedores, ver métricas globales

### Fase 4 — Growth (Semanas 8-10)
- [ ] Analytics por tienda (fuentes de tráfico, conversión)
- [ ] QR code por tienda para TikTok Live
- [ ] Notificaciones WhatsApp automáticas (vendor + buyer)
- [ ] SEO dinámico por tienda
- [ ] Dominio propio (plan Elite)
- [ ] PWA instalable para compradores frecuentes

### Fase 5 — Scale
- [ ] Multi-imagen con crop in-app
- [ ] Variantes de producto (talla, color)
- [ ] Cupones y descuentos
- [ ] Integraciones delivery (Rappi, PedidosYa API)
- [ ] App móvil nativa (React Native)

---

## Estructura de carpetas

```
frontend/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  ← Landing qtienda.shop
│   ├── tienda/[slug]/page.tsx    ← Tienda pública
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── dashboard/                ← Panel vendedor
│       ├── layout.tsx
│       ├── page.tsx              ← Overview
│       ├── pedidos/page.tsx
│       ├── productos/page.tsx
│       └── configuracion/page.tsx
├── components/
│   ├── store/                    ← Buyer-facing
│   │   ├── StorePage.tsx
│   │   ├── ProductCard.tsx
│   │   └── CartDrawer.tsx
│   ├── vendor/                   ← Vendor dashboard
│   │   ├── OrderCard.tsx
│   │   ├── OrderStatusBadge.tsx
│   │   └── StatsCards.tsx
│   └── ui/                      ← Design system
│       ├── Button.tsx
│       ├── Input.tsx
│       └── QueryProvider.tsx
├── store/
│   └── cartStore.ts              ← Zustand
├── lib/
│   ├── api.ts                    ← Axios client
│   ├── api-server.ts             ← Server fetcher
│   └── utils.ts
└── types/
    └── index.ts

backend/app/
├── main.py
├── core/
│   ├── config.py                 ← Settings (pydantic-settings)
│   └── security.py              ← JWT, roles, dependencies
├── api/v1/
│   ├── router.py
│   └── endpoints/
│       ├── auth.py
│       ├── public.py            ← Sin auth (buyers)
│       ├── stores.py
│       ├── products.py
│       ├── categories.py
│       ├── orders.py
│       ├── uploads.py
│       └── admin.py
├── models/models.py              ← SQLAlchemy ORM
├── schemas/auth.py               ← Pydantic schemas
├── services/user_service.py
├── db/session.py
└── middleware/logging.py
```
