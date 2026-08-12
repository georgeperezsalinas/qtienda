-- 044_claims_and_wheel.sql
-- Libro de Reclamaciones Virtual (requisito legal en Perú, Código de
-- Protección y Defensa del Consumidor) + ruleta de premios (gamificación).

CREATE TABLE IF NOT EXISTS store_claims (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  claim_number          VARCHAR(20) NOT NULL,
  type                  VARCHAR(10) NOT NULL,
  consumer_name         VARCHAR(150) NOT NULL,
  consumer_dni          VARCHAR(20) NOT NULL,
  consumer_address      VARCHAR(300) NOT NULL,
  consumer_phone        VARCHAR(20),
  consumer_email        VARCHAR(150),
  order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
  detail                TEXT NOT NULL,
  claimed_amount_cents  INT,
  vendor_response       TEXT,
  status                VARCHAR(15) NOT NULL DEFAULT 'open',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  responded_at          TIMESTAMPTZ,
  CONSTRAINT uq_claims_store_number UNIQUE (store_id, claim_number)
);

CREATE INDEX IF NOT EXISTS idx_store_claims_store ON store_claims(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_wheel_config (
  store_id     UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  segments     JSONB NOT NULL DEFAULT '[]',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wheel_spins (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  session_id   VARCHAR(64) NOT NULL,
  prize_label  VARCHAR(60) NOT NULL,
  coupon_code  VARCHAR(30),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_wheel_spins_store_session UNIQUE (store_id, session_id)
);
