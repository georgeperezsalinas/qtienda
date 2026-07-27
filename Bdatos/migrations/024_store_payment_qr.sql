-- 024: QR de pago (Yape/Plin) que el vendedor puede subir, opcional
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS yape_qr_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS plin_qr_url TEXT;
