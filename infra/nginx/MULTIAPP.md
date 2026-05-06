# Guía: nginx maestro para múltiples apps en el mismo VPS

## Situación actual

| Puerto host | Qué ocupa        | App           |
|-------------|------------------|---------------|
| 80          | qsdsoft-web      | qsdsoft.com   |
| 443         | libre            | —             |
| 3001        | qtienda_web      | qtienda.shop  |
| 8001        | qtienda_api      | qtienda.shop  |
| 8080        | siscont frontend | siscont-erp.com |

## El problema

- `qsdsoft-web` Docker está en puerto 80 con `server_name _` (catch-all).
- Nginx del host está instalado pero inactivo.
- Activar nginx del host con `qsdsoft-web` en 80 = conflicto de puerto.

## Solución: nginx maestro en el host

### Paso 1 — Mover qsdsoft-web del puerto 80

Editar el `docker-compose.yml` de qsdsoft (normalmente en el repo de qsdsoft):

```yaml
# ANTES
ports:
  - "80:80"

# DESPUÉS
ports:
  - "127.0.0.1:8181:80"
```

Aplicar:
```bash
cd /ruta/al/repo/qsdsoft
docker compose up -d
```

El container qsdsoft-web ya no responderá en puerto 80 del host, solo en 8181 internamente.

### Paso 2 — Verificar que el puerto 80 está libre

```bash
sudo ss -tlnp | grep ':80'
# No debe aparecer nada
```

### Paso 3 — Activar nginx del host

```bash
# Deshabilitar el bloque default de nginx (catch-all interno)
sudo rm -f /etc/nginx/sites-enabled/default

# Activar el config maestro
sudo cp infra/nginx/master.conf /etc/nginx/sites-available/master.conf
sudo ln -sf /etc/nginx/sites-available/master.conf /etc/nginx/sites-enabled/

# Verificar sintaxis
sudo nginx -t

# Iniciar y habilitar en boot
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Paso 4 — Obtener SSL para qtienda.shop

```bash
sudo certbot --nginx -d qtienda.shop -d www.qtienda.shop
```

Si ya tienes SSL para qsdsoft.com y siscont-erp.com, certbot ya tiene esos certificados.
Si no:
```bash
sudo certbot --nginx -d qsdsoft.com -d www.qsdsoft.com
sudo certbot --nginx -d siscont-erp.com -d www.siscont-erp.com
```

### Paso 5 — Verificar que todo funciona

```bash
curl -I https://qtienda.shop/health        # debe devolver 200
curl -I https://qsdsoft.com                # debe devolver 200
# siscont-erp.com devolverá 502 hasta que sus containers suban
```

## Cómo queda el VPS

```
Internet → :80 / :443  →  nginx host (maestro)
                              ├── qtienda.shop     → 127.0.0.1:3001 (web)
                              │                    → 127.0.0.1:8001 (api)
                              ├── qsdsoft.com      → 127.0.0.1:8181 (qsdsoft-web)
                              └── siscont-erp.com  → 127.0.0.1:8080 (siscont)
```

Cada app tiene su propio compose, su propia red Docker y sus propios containers.
Ninguna depende de la red de otra.
