-- 030: banners rotatorios del Mall (administrables desde /admin, no por tienda)
CREATE TABLE IF NOT EXISTS mall_banners (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
