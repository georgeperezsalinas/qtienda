#!/bin/bash
# deploy.sh — Script de despliegue qtienda.shop
# Ejecutar desde /opt/qtienda/ en el VPS
set -e

echo "=== qtienda.shop — Deploy ==="

# 1. Verificar que existe el .env raíz
if [ ! -f .env ]; then
  echo "ERROR: Falta .env en la raíz. Copia .env.example y completa los valores."
  exit 1
fi

# Cargar variables del .env
set -a; source .env; set +a

# 2. Garantizar que la red compartida existe de forma permanente.
#    Al crearla aquí (no desde un compose), Docker no la elimina
#    cuando siscont-erp hace "docker compose down".
echo ">> Asegurando red siscont-erp_default..."
docker network create siscont-erp_default 2>/dev/null || echo "   (red ya existe)"

# 3. Conectar siscont_db a la red si todavía no está
echo ">> Conectando siscont_db a la red..."
docker network connect siscont-erp_default siscont_db 2>/dev/null || echo "   (siscont_db ya conectado)"

# 4. Aplicar migraciones (directo en siscont_db)
echo ">> Aplicando migraciones..."
for f in Bdatos/migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "   $f"
  docker exec -i siscont_db psql -U siscont -d qtienda < "$f" 2>/dev/null || echo "   (ya aplicada)"
done

# 5. Build y levantar servicios
echo ">> Building contenedores..."
docker compose build --no-cache

echo ">> Iniciando servicios..."
docker compose up -d

# 6. Esperar que la API esté lista
echo ">> Esperando API..."
for i in $(seq 1 15); do
  sleep 2
  if curl -sf http://127.0.0.1:8001/health > /dev/null; then
    echo "   API lista."
    break
  fi
  echo "   intento $i/15..."
done

# 7. Crear admin si no existe
echo ">> Creando usuario admin (si no existe)..."
docker exec qtienda_api python create_admin.py \
  --email "${ADMIN_EMAIL:-admin@qtienda.shop}" \
  --password "${ADMIN_PASSWORD:-Admin1234!}" \
  --name "Administrador" || echo "   (admin ya existe o create_admin.py no disponible)"

echo ""
echo "=== Deploy completado ==="
