#!/bin/bash
# apply_migrations.sh — Migraciones versionadas qtienda (QT-012)
#
# Registra cada migracion aplicada en la tabla schema_migrations y solo ejecuta
# las pendientes, en orden alfabetico. Si una falla, ABORTA (no sigue a medias)
# y no la registra, para que el proximo intento la reintente.
#
# Uso (desde la raiz del repo, en el VPS o local):
#   ./Bdatos/apply_migrations.sh            # aplica pendientes
#   DRY_RUN=1 ./Bdatos/apply_migrations.sh  # solo muestra que aplicaria
#
# PRIMERA VEZ en una BD que ya tiene migraciones aplicadas con el metodo viejo
# (el loop de deploy.sh que ignoraba errores): registrar las ya aplicadas SIN
# ejecutarlas, indicando hasta cual llego la BD. Ejemplo si ya corrieron 001-015:
#   BASELINE=015 ./Bdatos/apply_migrations.sh
# y despues correr normal para aplicar 016 en adelante.
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-siscont_db}"
DB_USER="${DB_USER:-siscont}"
DB_NAME="${DB_NAME:-qtienda}"
MIGRATIONS_DIR="$(dirname "$0")/migrations"

psql_db() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q "$@"; }

# 1. Tabla de control
psql_db <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# 2. Modo baseline: registrar como aplicadas (sin ejecutar) hasta el prefijo dado
if [ -n "${BASELINE:-}" ]; then
  for f in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    prefix="${name%%_*}"
    if [ "$prefix" \> "$BASELINE" ]; then
      continue
    fi
    psql_db -c "INSERT INTO schema_migrations (filename) VALUES ('$name') ON CONFLICT DO NOTHING"
    echo "BASELINE: $name registrada como aplicada"
  done
  echo "Baseline hasta $BASELINE completado."
  exit 0
fi

# 3. Aplicar pendientes en orden
applied=0
skipped=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  exists=$(psql_db -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'" || true)
  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  if [ "${DRY_RUN:-}" = "1" ]; then
    echo "PENDIENTE: $name"
    continue
  fi
  echo ">> Aplicando $name..."
  if psql_db < "$f"; then
    psql_db -c "INSERT INTO schema_migrations (filename) VALUES ('$name')"
    applied=$((applied + 1))
  else
    echo "ERROR: fallo $name — abortando (no se registro como aplicada)."
    exit 1
  fi
done

echo "Migraciones: $applied aplicadas, $skipped ya registradas."
