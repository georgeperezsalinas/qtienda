-- Método de pago elegido por el comprador al crear el pedido
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) NOT NULL DEFAULT 'cash';

-- Control de pago anticipado y tarjeta por tienda
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS require_prepayment BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS accept_card       BOOLEAN NOT NULL DEFAULT FALSE;
