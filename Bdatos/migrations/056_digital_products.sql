-- Productos digitales (ebooks, PDFs, etc.) — sin envío, se entregan por
-- descarga cuando el vendedor confirma el pedido.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_digital BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_file_key TEXT;       -- ruta/objeto privado en storage, nunca la URL pública de CDN
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_file_name TEXT;     -- nombre original, para mostrarlo al comprador
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_file_size INTEGER; -- bytes

-- Snapshot al momento de compra, mismo patrón que product_name/sku/variant_*
-- en order_items: el producto puede borrarse o cambiar de archivo después,
-- el pedido conserva lo que el comprador realmente pagó.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS download_token VARCHAR(64) UNIQUE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS digital_file_key TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

CREATE INDEX IF NOT EXISTS idx_order_items_download_token ON order_items(download_token) WHERE download_token IS NOT NULL;
