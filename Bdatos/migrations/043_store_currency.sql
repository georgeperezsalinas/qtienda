-- 043_store_currency.sql
-- Corrige un bug: el backend ya leía store.currency (moneda por tienda,
-- feature de precios multi-país) pero la columna nunca se creó en stores.
-- Override explícito y opcional — sin valor, el frontend deriva la moneda
-- de stores.country (CURRENCY_BY_COUNTRY en frontend/src/lib/utils.ts).

ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency VARCHAR(3);
