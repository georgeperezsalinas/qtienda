-- 020: Descuento de bienvenida al primer pedido (por tienda)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS welcome_discount_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS welcome_discount_cents INTEGER NOT NULL DEFAULT 0;
