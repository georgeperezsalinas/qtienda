-- 036: pixels de marketing por tienda (TikTok/Meta/Google) — para que cada
-- vendedor mida sus propias campañas de anuncios en su tienda pública.
-- Distinto del analytics interno de qtienda (store_events/site_events).
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tiktok_pixel_id VARCHAR(40);
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS meta_pixel_id VARCHAR(40);
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_analytics_id VARCHAR(40);
