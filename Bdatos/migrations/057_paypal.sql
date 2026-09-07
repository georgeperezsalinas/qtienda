-- PayPal como método de pago — único que sirve para compradores fuera de
-- Perú (Yape/Plin son apps locales). Sin QR, el comprador paga directo al
-- email/PayPal.me y manda el comprobante como ya hace con Yape/Plin.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS accept_paypal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(120);
