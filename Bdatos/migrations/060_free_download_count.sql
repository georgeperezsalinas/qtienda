-- Contador de descargas del producto digital gratis por tiempo limitado. El
-- flujo de descarga directa (ver descargar-gratis en public.py) no crea
-- Order, así que sold_count (que cuenta OrderItem) nunca ve estas descargas.
ALTER TABLE products ADD COLUMN IF NOT EXISTS free_download_count INT NOT NULL DEFAULT 0;
