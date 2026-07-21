-- Prueba social honesta "X personas viendo esto": el conteo por producto+ventana
-- reciente no estaba cubierto por los indices existentes (solo store_id/store_id+event).
CREATE INDEX IF NOT EXISTS idx_store_events_product_recent
  ON store_events (product_id, event, created_at);
