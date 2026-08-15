-- 050_appointment_dni.sql
-- DNI del paciente/comprador en las citas — se pide junto a nombre y
-- teléfono al reservar, y se usa (junto al teléfono ya verificado) para
-- que el comprador pueda consultar "mis citas" sin exponer la agenda
-- completa de la tienda.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_dni VARCHAR(15);

CREATE INDEX IF NOT EXISTS idx_appointments_lookup
  ON appointments (store_id, patient_phone, patient_dni);
