-- 047: notificaciones globales del admin (reactivacion solicitada, reclamos
-- nuevos, pagos Yape pendientes de aprobar). Sin store_id: es un inbox
-- compartido por todos los admins, no pertenece a una tienda.
CREATE TABLE IF NOT EXISTS admin_notifications (
  id         BIGSERIAL PRIMARY KEY,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(150) NOT NULL,
  body       VARCHAR(300) NOT NULL,
  icon       VARCHAR(10),
  action_url VARCHAR(200),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications (id) WHERE read_at IS NULL;
