-- 039: departamento fijo del Mall (moda/belleza/hogar/tecnologia/mascotas/
-- videojuegos/deportes) — taxonomía curada para navegar el Mall por rubro,
-- en vez de nombres de categoría escritos libremente por cada vendedor.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mall_category VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_stores_mall_category ON stores (mall_category) WHERE mall_category IS NOT NULL;
