-- 051_order_buyer_id.sql
-- Vínculo real (FK) entre un pedido y la cuenta de comprador que lo hizo —
-- antes "Mis pedidos" solo emparejaba por buyer_email (texto), así que un
-- pedido con el email mal escrito o distinto al de la cuenta nunca
-- aparecía. Nullable: los pedidos de invitado (sin cuenta) siguen sin uno,
-- y los pedidos viejos no se completan retroactivo.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders (buyer_id) WHERE buyer_id IS NOT NULL;
