-- Trafico del sitio a nivel dominio (landing, /tiendas), separado de store_events
-- que ya cubre analytics por tienda individual (QT-008). Necesario porque
-- store_events.store_id es NOT NULL y no puede representar una visita sin tienda.
CREATE TABLE IF NOT EXISTS site_events (
  id         BIGSERIAL PRIMARY KEY,
  event      VARCHAR(30) NOT NULL,
  path       VARCHAR(200),
  referrer   VARCHAR(300),
  session_id VARCHAR(64),
  device     VARCHAR(10),
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_events_date ON site_events (created_at);
CREATE INDEX IF NOT EXISTS idx_site_events_event_date ON site_events (event, created_at);
