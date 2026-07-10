#!/bin/bash
# backup_postgres.sh — Backup diario de la BD qtienda (QT-011)
# Ejecutar en el VPS. Programar en cron, por ejemplo a las 3:30 am:
#   crontab -e
#   30 3 * * * /opt/qtienda/infra/backup_postgres.sh >> /var/log/qtienda_backup.log 2>&1
#
# Restaurar un backup:
#   gunzip -c /opt/qtienda/backups/qtienda_YYYYMMDD_HHMMSS.sql.gz | \
#     docker exec -i siscont_db psql -U siscont -d qtienda
set -e

BACKUP_DIR="${BACKUP_DIR:-/opt/qtienda/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-siscont_db}"
DB_USER="${DB_USER:-siscont}"
DB_NAME="${DB_NAME:-qtienda}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/qtienda_${STAMP}.sql.gz"

echo "[$(date '+%F %T')] Iniciando backup de $DB_NAME..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip > "$FILE"

# Verificar que el dump existe, no esta vacio y el gzip es valido
[ -s "$FILE" ] || { echo "ERROR: backup vacio: $FILE"; rm -f "$FILE"; exit 1; }
gzip -t "$FILE" || { echo "ERROR: gzip corrupto: $FILE"; exit 1; }

# Rotacion: eliminar backups mas viejos que KEEP_DAYS
find "$BACKUP_DIR" -name "qtienda_*.sql.gz" -mtime +"$KEEP_DAYS" -delete

echo "[$(date '+%F %T')] OK: $FILE ($(du -h "$FILE" | cut -f1)) — backups guardados: $(ls "$BACKUP_DIR"/qtienda_*.sql.gz 2>/dev/null | wc -l)"
