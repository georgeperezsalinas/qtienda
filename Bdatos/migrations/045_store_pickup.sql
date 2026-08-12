-- 045_store_pickup.sql
-- Recojo en tienda: método de entrega alternativo al delivery. El vendedor
-- activa "accept_pickup" y escribe la dirección/instrucciones de recojo en
-- texto libre; el comprador elige el tipo de servicio en el checkout.

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS accept_pickup BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;

-- 'delivery' por defecto para no romper pedidos existentes, que ya asumían delivery.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type VARCHAR(10) NOT NULL DEFAULT 'delivery';
