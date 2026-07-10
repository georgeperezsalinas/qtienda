-- Pago manual de planes via Yape directo: el vendedor yapea al celular del
-- admin, registra el numero de operacion y el admin aprueba/rechaza.
CREATE TABLE IF NOT EXISTS plan_payment_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES plans(id),
  method            VARCHAR(20) NOT NULL DEFAULT 'yape',
  amount_cents      INT NOT NULL,
  operation_number  VARCHAR(40),
  payer_phone       VARCHAR(20),
  note              TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  reject_reason     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_payment_requests_status ON plan_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_plan_payment_requests_store  ON plan_payment_requests(store_id);
