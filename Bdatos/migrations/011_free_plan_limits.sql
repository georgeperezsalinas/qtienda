-- Plan free: 10 productos y hasta 50 pedidos al mes (QT-025: limite definitivo = 50)
UPDATE plans
SET max_products  = 10,
    max_orders_mo = 50,
    features      = '["Tienda básica","WhatsApp","5 fotos/producto","10 productos","50 pedidos/mes"]'
WHERE slug = 'free';

-- Normalizar pro/elite: 0 significaba "sin limite" pero el check lo trata como
-- limite alcanzado y bloquea la tienda. NULL = ilimitado.
ALTER TABLE plans ALTER COLUMN max_products DROP NOT NULL;
UPDATE plans SET max_orders_mo = NULL WHERE slug = 'pro'   AND max_orders_mo = 0;
UPDATE plans SET max_products  = 100  WHERE slug = 'pro'   AND max_products  = 0;
UPDATE plans SET max_products  = NULL WHERE slug = 'elite' AND max_products  = 0;
UPDATE plans SET max_orders_mo = NULL WHERE slug = 'elite' AND max_orders_mo = 0;
