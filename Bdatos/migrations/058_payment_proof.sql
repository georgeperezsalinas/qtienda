-- Comprobante de pago (Yape/Plin/transferencia/PayPal) subido por el comprador
-- directo en la página de seguimiento — alternativa a mandarlo por WhatsApp,
-- que en laptop/desktop no siempre abre solo.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at TIMESTAMPTZ;
