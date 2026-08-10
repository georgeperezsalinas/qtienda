-- 027: avisos escalonados de "sin productos" (7/14/30 dias) — solo advertencias,
-- nunca suspenden la tienda automaticamente (decision manual del equipo/admin).
-- Amplia el indice unico parcial de dedupe de 026 con los 3 tipos nuevos.
DROP INDEX IF EXISTS uq_notifications_store_once;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_store_once
  ON notifications (store_id, type)
  WHERE type IN (
    'store_created', 'first_product', 'products_5',
    'first_visit', 'first_favorite', 'first_order',
    'no_products_warn', 'no_products_final', 'no_products_urgent'
  );
