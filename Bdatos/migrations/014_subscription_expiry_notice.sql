-- Aviso de vencimiento de plan: marca cuando ya se notifico al vendedor
-- para no enviar el recordatorio dos veces.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expiry_notified_at TIMESTAMPTZ;
