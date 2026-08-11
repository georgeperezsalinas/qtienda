-- 040: alerta de stock bajo — dedupe por producto (se resetea cuando el
-- vendedor vuelve a editar el stock, para que pueda avisar de nuevo si
-- vuelve a bajar del umbral más adelante).
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_notified_at TIMESTAMPTZ;
