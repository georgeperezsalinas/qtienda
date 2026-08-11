-- 037: redes sociales de la tienda (Instagram/TikTok/Facebook) — señal de
-- confianza adicional: el comprador puede verificar por su cuenta que es
-- una cuenta real con historial, no es una garantía de qtienda.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tiktok VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook VARCHAR(50);
