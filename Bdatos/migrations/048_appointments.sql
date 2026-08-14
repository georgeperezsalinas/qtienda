-- 048_appointments.sql
-- Servicios con cita (odontólogos, peluquerías, tutorías, etc.) — una
-- tienda puede mezclar productos normales y servicios agendables.

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS appointment_hours JSONB NOT NULL DEFAULT '{}';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS appointments_auto_confirm BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name              VARCHAR(120) NOT NULL,
  description       TEXT,
  duration_minutes  INT NOT NULL DEFAULT 30,
  price_cents       INT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        SMALLINT NOT NULL DEFAULT 0,
  image_url         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_store ON services (store_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  VARCHAR(5),
  end_time    VARCHAR(5),
  reason      VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_store_date ON availability_exceptions (store_id, date);

CREATE TABLE IF NOT EXISTS appointments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  service_id        UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  patient_name      VARCHAR(120) NOT NULL,
  patient_phone     VARCHAR(20) NOT NULL,
  patient_email     VARCHAR(150),
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INT NOT NULL,
  status            VARCHAR(15) NOT NULL DEFAULT 'pending',
  notes             TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     VARCHAR(200),
  reminder_sent_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_store_scheduled ON appointments (store_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON appointments (scheduled_at) WHERE status = 'confirmed' AND reminder_sent_at IS NULL;
