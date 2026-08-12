-- 042_review_photos.sql — fotos adjuntas a reseñas de compradores
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
