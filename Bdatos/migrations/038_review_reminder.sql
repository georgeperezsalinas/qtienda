-- 038: recordatorio de reseña — se le pide al comprador calificar su pedido
-- 1-2 días después de la entrega (antes era 100% pasivo: solo si entraba
-- por su cuenta a Mis Pedidos). delivered_at queda fijo la primera vez que
-- el pedido pasa a "delivered" (no se mueve con ediciones posteriores,
-- a diferencia de updated_at). review_reminder_sent_at es el dedupe.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_delivered_review_pending
  ON orders (delivered_at)
  WHERE status = 'delivered' AND review_reminder_sent_at IS NULL;
