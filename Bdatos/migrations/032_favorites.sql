-- 032: favoritos sincronizados con la cuenta del comprador.
-- El localStorage sigue siendo la fuente de verdad inmediata (favoritos
-- funcionan sin sesión); esta tabla es la copia de respaldo/multi-dispositivo
-- que se fusiona al iniciar sesión.
CREATE TABLE IF NOT EXISTS favorites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);
