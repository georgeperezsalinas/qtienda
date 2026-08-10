-- 028: campaña de reactivación de onboarding (WhatsApp semi-automático desde admin)
-- Marca cuándo se contactó a una tienda por onboarding incompleto (sin logo,
-- sin banner o sin productos), para no reenviar el mismo mensaje repetidas veces.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS campaign_contacted_at TIMESTAMPTZ;
