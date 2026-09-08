-- Gratis por tiempo limitado — solo para productos digitales. Mientras
-- now() < free_until, el producto se cobra a S/0 y el pedido se
-- autoconfirma (sin pago que verificar), así el comprador descarga al
-- toque desde la home. price_cents no cambia: es el precio normal al que
-- vuelve el producto cuando pase la fecha.
ALTER TABLE products ADD COLUMN IF NOT EXISTS free_until TIMESTAMPTZ;
