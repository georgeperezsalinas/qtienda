-- 019: DNI y ubigeo (departamento/provincia/distrito) del comprador en pedidos
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_dni VARCHAR(15);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_department VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_province VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_district VARCHAR(80);
