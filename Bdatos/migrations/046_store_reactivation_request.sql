-- 046: apelación de suspensión — el vendedor pide revisión con un mensaje,
-- el admin lo ve en admin/tiendas y aprueba o rechaza.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS reactivation_requested_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS reactivation_message TEXT;
