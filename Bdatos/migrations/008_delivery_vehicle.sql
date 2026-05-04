-- Tipo de vehículo y placa del repartidor
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type  VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(15);
