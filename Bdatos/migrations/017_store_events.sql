-- QT-008: eventos de analytics por tienda (vista, producto visto, carrito, checkout, pedido)
CREATE TABLE IF NOT EXISTS store_events (
  id         BIGSERIAL PRIMARY KEY,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event      VARCHAR(30) NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  session_id VARCHAR(64),
  device     VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_events_store_date ON store_events (store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_store_events_store_event ON store_events (store_id, event, created_at);
