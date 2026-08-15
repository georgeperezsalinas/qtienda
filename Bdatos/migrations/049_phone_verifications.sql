-- 049: verificación de teléfono por código de WhatsApp (Evolution API) —
-- anti-spam antes de reservar una cita o confirmar un pedido.
CREATE TABLE IF NOT EXISTS phone_verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(20) NOT NULL,
  code_hash   VARCHAR(64) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_created
  ON phone_verifications (phone, created_at DESC);
