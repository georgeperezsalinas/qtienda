-- 026: notificaciones inteligentes basadas en eventos de negocio + progreso de onboarding
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(150) NOT NULL,
  body       VARCHAR(300) NOT NULL,
  icon       VARCHAR(10),
  action_url VARCHAR(200),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe atomico para hitos de "una sola vez": el INSERT usa
-- ON CONFLICT (store_id, type) DO NOTHING, sin necesidad de SELECT previo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_store_once
  ON notifications (store_id, type)
  WHERE type IN ('store_created', 'first_product', 'products_5', 'first_visit', 'first_favorite', 'first_order');

CREATE INDEX IF NOT EXISTS idx_notifications_store_created ON notifications (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_store_unread ON notifications (store_id) WHERE read_at IS NULL;

-- Watchers periodicos de salud de tienda (patron igual a subscriptions.expiry_notified_at)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS inactive_notified_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS no_sales_notified_at TIMESTAMPTZ;
-- Marca si el vendedor ya compartió el link de su tienda (checklist de onboarding)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;
