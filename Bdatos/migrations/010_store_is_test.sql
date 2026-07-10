-- QT-007: marcar tiendas como prueba para separar metricas reales de marcha blanca
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_stores_is_test ON stores (is_test) WHERE is_test = TRUE;
