-- Migration: Ensure plans table exists and has seed data
-- Safe to run on any DB — uses IF NOT EXISTS and ON CONFLICT DO NOTHING

CREATE TABLE IF NOT EXISTS plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(80) NOT NULL,
  slug            VARCHAR(40) UNIQUE NOT NULL,
  description     TEXT,
  price_cents     INT NOT NULL DEFAULT 0,
  currency        VARCHAR(3) NOT NULL DEFAULT 'PEN',
  interval        plan_interval DEFAULT 'monthly',
  max_products    INT,
  max_orders_mo   INT,
  features        JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_store  ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Seed plans (idempotent)
INSERT INTO plans (name, slug, price_cents, max_products, max_orders_mo, features) VALUES
  ('Gratis', 'free',  0,     10,   50,   '["Tienda básica","WhatsApp","5 fotos/producto"]'),
  ('Pro',    'pro',   2900,  100,  NULL, '["Todo Free","Sin límite pedidos","Analytics","Banner personalizado"]'),
  ('Elite',  'elite', 5900,  NULL, NULL, '["Todo Pro","Dominio propio","Soporte prioritario","Multi-categoría"]')
ON CONFLICT (slug) DO UPDATE
  SET name          = EXCLUDED.name,
      price_cents   = EXCLUDED.price_cents,
      max_products  = EXCLUDED.max_products,
      max_orders_mo = EXCLUDED.max_orders_mo,
      features      = EXCLUDED.features;

-- Ensure stores that have no subscription get one (free plan)
INSERT INTO subscriptions (store_id, plan_id, status, starts_at)
SELECT s.id, p.id, 'active', NOW()
FROM stores s
CROSS JOIN plans p
WHERE p.slug = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions sub WHERE sub.store_id = s.id
  );
