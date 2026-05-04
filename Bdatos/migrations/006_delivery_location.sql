-- Coordenadas GPS al momento de confirmar entrega
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivered_lat  DECIMAL(10, 7);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivered_lng  DECIMAL(10, 7);
