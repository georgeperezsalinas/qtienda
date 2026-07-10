-- QT-025: limite definitivo del plan free = 50 pedidos/mes.
-- Converge cualquier entorno (BD local tenia 500) al valor acordado.
UPDATE plans
SET max_orders_mo = 50,
    features      = '["Tienda básica","WhatsApp","5 fotos/producto","10 productos","50 pedidos/mes"]'
WHERE slug = 'free';
