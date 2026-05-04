-- Migration: Add delivery role and delivery_store_id to users
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delivery';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS delivery_store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Insert delivery role record
INSERT INTO roles (name, description)
VALUES ('delivery', 'Repartidor — acceso limitado a pedidos de su tienda')
ON CONFLICT DO NOTHING;
