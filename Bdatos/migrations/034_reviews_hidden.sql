-- 034: moderación de reseñas — el admin puede ocultar una reseña abusiva/falsa
-- sin borrarla (queda el registro para disputas), simplemente deja de contar
-- en el promedio y de listarse públicamente.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
