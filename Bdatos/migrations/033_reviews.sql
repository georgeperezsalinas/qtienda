-- 033: reseñas de compradores sobre pedidos entregados.
-- Una reseña por pedido (UNIQUE order_id), solo pedidos con status='delivered'
-- pueden calificarse (se valida en la app, no aquí). store_id denormalizado
-- para agregar rating promedio por tienda sin join extra.
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reviews_store ON reviews (store_id, created_at DESC);
