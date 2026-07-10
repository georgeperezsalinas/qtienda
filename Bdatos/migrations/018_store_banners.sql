-- QT-030: multiples banners por tienda (feature Pro: hasta 3 rotando; free: 1)
CREATE TABLE IF NOT EXISTS store_banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_banners_store ON store_banners (store_id, sort_order);

-- Migrar el banner existente (columnas stores.banner_url/banner_link) como primer banner
INSERT INTO store_banners (store_id, image_url, link_url, sort_order)
SELECT s.id, s.banner_url, s.banner_link, 0
FROM stores s
WHERE s.banner_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM store_banners b WHERE b.store_id = s.id);
