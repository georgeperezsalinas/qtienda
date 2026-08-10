-- 029: avisos escalonados de "sin logo/banner" (7/14/30 dias) — mismo patron
-- que 027 (sin productos): solo advertencias, nunca tocan la tienda.
DROP INDEX IF EXISTS uq_notifications_store_once;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_store_once
  ON notifications (store_id, type)
  WHERE type IN (
    'store_created', 'first_product', 'products_5',
    'first_visit', 'first_favorite', 'first_order',
    'no_products_warn', 'no_products_final', 'no_products_urgent',
    'missing_branding_warn', 'missing_branding_final', 'missing_branding_urgent'
  );
