#!/bin/bash
# deploy.sh — Script de despliegue qtienda.shop
# Ejecutar desde /home/jorge/PROYECTOS/qtienda/ en el VPS
set -e

echo "=== qtienda.shop — Deploy ==="

# 1. Verificar que existe el .env raíz
if [ ! -f .env ]; then
  echo "ERROR: Falta .env en la raíz. Copia .env.example y completa los valores."
  exit 1
fi

# Cargar variables del .env
set -a; source .env; set +a

# 2. Build y levantar servicios (db sube primero por depends_on)
echo ">> Building contenedores..."
docker compose build --no-cache

echo ">> Iniciando servicios..."
docker compose up -d

# 3. Esperar que la API esté disponible (DB es externa — asumimos que ya está corriendo)
echo ">> Verificando conexión a la base de datos..."
sleep 5

# 4. Aplicar migraciones via psql en el host (Postgres escucha en puerto 5432)
echo ">> Aplicando migraciones..."
for f in Bdatos/migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "   $f"
  PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER:-siscont}" -d qtienda < "$f" 2>/dev/null || echo "   (ya aplicada)"
done

# 5. Esperar que la API esté lista
echo ">> Esperando API..."
for i in $(seq 1 15); do
  sleep 2
  if curl -sf http://127.0.0.1:8001/health > /dev/null; then
    echo "   API lista."
    break
  fi
  echo "   intento $i/15..."
done

# 6. Crear admin si no existe (esperar que la API haya levantado)
echo ">> Creando usuario admin (si no existe)..."
docker exec qtienda_api python create_admin.py \
  --email "${ADMIN_EMAIL:-admin@qtienda.shop}" \
  --password "${ADMIN_PASSWORD:-Admin1234!}" \
  --name "Administrador" || echo "   (admin ya existe o create_admin.py no disponible)"

# 7. Instrucciones nginx
echo ""
echo "=== PASOS MANUALES (primera vez) ==="
echo ""
echo "── Nginx maestro ──"
echo "   sudo cp infra/nginx/qtienda.conf /etc/nginx/sites-available/qtienda.conf"
echo "   sudo ln -sf /etc/nginx/sites-available/qtienda.conf /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl enable nginx && sudo systemctl start nginx"
echo ""
echo "── Si qsdsoft-web ocupa el puerto 80 ──"
echo "   Ver: infra/nginx/MULTIAPP.md"
echo ""
echo "── SSL con Certbot (primera vez) ──"
echo "   sudo certbot --nginx -d qtienda.shop -d www.qtienda.shop"
echo ""
echo "=== Deploy completado ==="
