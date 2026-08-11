-- 031: FIX URGENTE — libera los slugs de tiendas ya eliminadas (soft-delete).
--
-- Bug: create_store excluye tiendas con deleted_at al chequear si un slug ya
-- esta en uso, pero el UNIQUE constraint de la columna aplica a TODAS las
-- filas sin importar deleted_at. Resultado: crear una tienda con el mismo
-- slug de una tienda eliminada revienta con IntegrityError 500 en vez de un
-- 409 amigable (caso real: slug "jpsystem", agosto 2026).
--
-- Esta migracion libera las tiendas ya eliminadas hasta ahora; el fix de
-- codigo (admin.py::delete_store) hace lo mismo para las eliminaciones
-- futuras, asi que no vuelve a pasar.
UPDATE stores
SET slug = left(slug, 40) || '-del-' || to_char(deleted_at, 'YYYYMMDDHH24MISS')
WHERE deleted_at IS NOT NULL;
