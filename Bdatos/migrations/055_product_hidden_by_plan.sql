-- Cuando una tienda baja de plan (vencimiento sin renovar) y tiene más
-- productos activos que el límite del nuevo plan, se ocultan los de menos
-- ventas (no se borran) y se marca acá cuándo/por qué. Si sube de plan de
-- nuevo, se reactivan automáticamente solo los que quedaron ocultos por este
-- motivo (nunca los que el vendedor desactivó a mano).
ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_by_plan_at TIMESTAMPTZ;
