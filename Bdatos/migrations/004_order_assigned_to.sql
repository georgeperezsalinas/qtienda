-- Migration: Add assigned_to_id to orders for delivery staff assignment
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to_id);
