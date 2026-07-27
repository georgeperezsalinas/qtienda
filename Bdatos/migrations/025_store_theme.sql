-- 025: tema de vitrina (clasico/elegante/vibrante) — solo afecta neutros, el acento sigue siendo primary_color
ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'clasico';
