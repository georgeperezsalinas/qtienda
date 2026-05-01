-- ============================================================
-- qtienda.shop — PostgreSQL Schema v1.0
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'vendor', 'buyer');
CREATE TYPE store_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'out_of_stock');
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'
);
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE plan_interval AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trial');

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE roles (
  id          SMALLSERIAL PRIMARY KEY,
  name        user_role UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Platform administrator'),
  ('vendor', 'Store owner'),
  ('buyer', 'End customer');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id         SMALLINT NOT NULL REFERENCES roles(id),
  email           VARCHAR(255) UNIQUE NOT NULL,
  phone           VARCHAR(20),
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(150) NOT NULL,
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  is_verified     BOOLEAN DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,                    -- soft delete
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email      ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role       ON users(role_id);
CREATE INDEX idx_users_active     ON users(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- PLANS
-- ============================================================

CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(80) NOT NULL,
  slug            VARCHAR(40) UNIQUE NOT NULL,
  description     TEXT,
  price_cents     INT NOT NULL DEFAULT 0,          -- 0 = free
  currency        CHAR(3) NOT NULL DEFAULT 'PEN',
  interval        plan_interval NOT NULL DEFAULT 'monthly',
  max_products    INT NOT NULL DEFAULT 10,
  max_orders_mo   INT,                             -- NULL = unlimited
  features        JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (name, slug, price_cents, max_products, max_orders_mo, features) VALUES
  ('Gratis',    'free',    0,     10, 50,   '["Tienda básica","WhatsApp","5 fotos/producto"]'),
  ('Pro',       'pro',     2900,  100, NULL, '["Todo Free","Sin límite pedidos","Analytics","Banner personalizado"]'),
  ('Elite',     'elite',   5900,  NULL,NULL, '["Todo Pro","Dominio propio","Soporte prioritario","Multi-categoría"]');

-- ============================================================
-- STORES
-- ============================================================

CREATE TABLE stores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id         UUID REFERENCES plans(id),
  slug            VARCHAR(60) UNIQUE NOT NULL,     -- /tienda/{slug}
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  whatsapp        VARCHAR(20),
  status          store_status NOT NULL DEFAULT 'pending',
  primary_color   CHAR(7) DEFAULT '#6366f1',
  city            VARCHAR(80),
  country         CHAR(2) DEFAULT 'PE',
  meta_title      VARCHAR(120),
  meta_desc       VARCHAR(300),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_stores_slug       ON stores(slug) WHERE deleted_at IS NULL;
CREATE INDEX        idx_stores_user       ON stores(user_id);
CREATE INDEX        idx_stores_status     ON stores(status);

-- ============================================================
-- STORE SETTINGS (1-to-1 extended config)
-- ============================================================

CREATE TABLE store_settings (
  store_id              UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  accept_cash           BOOLEAN DEFAULT TRUE,
  accept_yape           BOOLEAN DEFAULT FALSE,
  accept_plin           BOOLEAN DEFAULT FALSE,
  accept_transfer       BOOLEAN DEFAULT FALSE,
  yape_phone            VARCHAR(20),
  plin_phone            VARCHAR(20),
  bank_account          TEXT,
  min_order_cents       INT DEFAULT 0,
  delivery_fee_cents    INT DEFAULT 0,
  free_delivery_above   INT,                       -- cents threshold
  delivery_zones        JSONB DEFAULT '[]',
  store_hours           JSONB DEFAULT '{}',
  custom_css            TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(80) NOT NULL,
  icon        VARCHAR(10),                         -- emoji or icon name
  sort_order  SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, slug)
);

CREATE INDEX idx_categories_store ON categories(store_id);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(200) NOT NULL,
  description     TEXT,
  price_cents     INT NOT NULL,
  compare_price   INT,                             -- tachado / original
  sku             VARCHAR(80),
  stock           INT,                             -- NULL = sin control de stock
  status          product_status DEFAULT 'active',
  is_featured     BOOLEAN DEFAULT FALSE,
  sort_order      INT DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, slug)
);

CREATE INDEX idx_products_store    ON products(store_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status   ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_featured ON products(store_id, is_featured) WHERE deleted_at IS NULL;

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    VARCHAR(200),
  sort_order  SMALLINT DEFAULT 0,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  order_number      VARCHAR(20) NOT NULL,          -- QT-00001
  status            order_status NOT NULL DEFAULT 'pending',
  -- buyer info (no login required)
  buyer_name        VARCHAR(150) NOT NULL,
  buyer_phone       VARCHAR(20) NOT NULL,
  buyer_email       VARCHAR(255),
  buyer_address     TEXT,
  buyer_reference   TEXT,
  buyer_lat         DECIMAL(10,7),
  buyer_lng         DECIMAL(10,7),
  -- financials (all in cents)
  subtotal_cents    INT NOT NULL,
  delivery_cents    INT NOT NULL DEFAULT 0,
  discount_cents    INT NOT NULL DEFAULT 0,
  total_cents       INT NOT NULL,
  -- meta
  notes             TEXT,
  source            VARCHAR(40) DEFAULT 'tiktok',  -- tiktok, instagram, direct
  utm_source        VARCHAR(80),
  utm_campaign      VARCHAR(80),
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_orders_number ON orders(store_id, order_number);
CREATE INDEX        idx_orders_store   ON orders(store_id);
CREATE INDEX        idx_orders_status  ON orders(status);
CREATE INDEX        idx_orders_phone   ON orders(buyer_phone);
CREATE INDEX        idx_orders_created ON orders(created_at DESC);

-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    VARCHAR(200) NOT NULL,           -- snapshot
  product_sku     VARCHAR(80),
  unit_price      INT NOT NULL,                    -- snapshot en cents
  quantity        INT NOT NULL DEFAULT 1,
  subtotal        INT NOT NULL,
  image_url       TEXT
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  method          VARCHAR(30) NOT NULL,            -- cash, yape, plin, transfer
  status          payment_status DEFAULT 'pending',
  amount_cents    INT NOT NULL,
  reference       VARCHAR(120),                    -- nro operación
  proof_url       TEXT,                            -- foto voucher
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);

-- ============================================================
-- DELIVERIES
-- ============================================================

CREATE TABLE deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  courier_name    VARCHAR(120),
  courier_phone   VARCHAR(20),
  tracking_code   VARCHAR(80),
  estimated_at    TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deliveries_order ON deliveries(order_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id         UUID NOT NULL REFERENCES plans(id),
  status          subscription_status DEFAULT 'trial',
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  trial_ends_at   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  payment_ref     VARCHAR(120),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_store ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id    UUID REFERENCES stores(id) ON DELETE SET NULL,
  action      VARCHAR(80) NOT NULL,
  entity      VARCHAR(80),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_store  ON audit_logs(store_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','stores','store_settings','products',
    'orders','payments','deliveries','subscriptions','plans'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- ORDER NUMBER SEQUENCE PER STORE
-- ============================================================

CREATE SEQUENCE order_seq START 1000;

CREATE OR REPLACE FUNCTION generate_order_number(p_store_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN 'QT-' || LPAD(nextval('order_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
