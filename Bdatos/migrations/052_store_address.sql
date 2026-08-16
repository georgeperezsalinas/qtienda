-- 052_store_address.sql
-- Dirección física de la tienda — hasta ahora solo existía `city`. Necesaria
-- para negocios que reciben gente en persona (citas, recojo en tienda);
-- distinta de `pickup_instructions` (settings), que es específica del
-- checkout de productos y no aplica al flujo de reserva de citas.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT;
