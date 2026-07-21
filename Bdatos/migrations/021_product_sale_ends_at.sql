-- 021: fecha de fin de oferta (countdown real) por producto — opcional, nunca inventada
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ;
