-- Sistema de referidos: cada usuario tiene un codigo; los referidos con tienda
-- creada suben los limites de productos/pedidos del plan free del referidor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id);

-- Backfill de codigos para usuarios existentes
UPDATE users
SET referral_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 8))
WHERE referral_code IS NULL;
