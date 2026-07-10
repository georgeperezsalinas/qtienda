-- Banner clickeable: enlace opcional al que dirige el banner de la tienda
ALTER TABLE stores ADD COLUMN IF NOT EXISTS banner_link TEXT;
