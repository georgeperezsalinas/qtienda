#!/usr/bin/env python3
"""Smoke test qtienda (QT-009): validacion rapida del API antes/despues de deploy.

Solo hace LECTURAS: no crea, modifica ni borra datos. Seguro contra produccion.

Uso:
    python3 smoke_test.py                                        # local docker (127.0.0.1:8001)
    BASE_URL=https://qtienda.shop python3 smoke_test.py          # produccion
    ADMIN_EMAIL=... ADMIN_PASSWORD=... python3 smoke_test.py     # incluye checks admin

Sale con codigo 0 si todo pasa, 1 si algo fallo (util en deploy.sh / CI).
"""

import json
import os
import ssl
import sys
import urllib.error
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8001").rstrip("/")
API = f"{BASE_URL}/api/v1"
TIMEOUT = 15

results: list[tuple[bool, str]] = []


def request(method: str, url: str, body: dict | None = None, token: str | None = None):
    """Devuelve (status, json|None). No lanza excepcion por status HTTP."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "qtienda-smoke-test")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw)
            except (json.JSONDecodeError, UnicodeDecodeError):
                return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return 0, {"error": str(e)}


def check(name: str, ok: bool, detail: str = ""):
    results.append((ok, name))
    mark = "OK " if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))
    return ok


def main() -> int:
    print(f"Smoke test contra: {BASE_URL}\n")

    # 1. Health
    status, body = request("GET", f"{BASE_URL}/health")
    if status == 404:
        # El proxy aun no expone /health (requiere location = /health en nginx)
        print("[SKIP] GET /health: 404 via proxy — actualiza nginx con 'location = /health'")
    else:
        check("GET /health responde 200", status == 200, f"status={status}")

    # 2. Listado publico de tiendas
    status, stores = request("GET", f"{API}/public/stores")
    ok = status == 200 and isinstance(stores, list)
    check("GET /public/stores devuelve lista", ok, f"status={status}, tiendas={len(stores) if isinstance(stores, list) else '?'}")

    # 3. Detalle de tienda + productos (si hay al menos una tienda activa)
    if ok and stores:
        slug = stores[0].get("slug")
        status, store = request("GET", f"{API}/public/store/{slug}")
        check(
            f"GET /public/store/{slug} devuelve datos",
            status == 200 and isinstance(store, dict) and bool(store.get("name")),
            f"status={status}",
        )
        status, products = request("GET", f"{API}/public/store/{slug}/products")
        check(
            f"GET /public/store/{slug}/products devuelve lista",
            status == 200 and isinstance(products, list),
            f"status={status}, productos={len(products) if isinstance(products, list) else '?'}",
        )
    else:
        print("[SKIP] Detalle de tienda: no hay tiendas activas para probar")

    # 4. Endpoints protegidos rechazan sin token (no deben dar 500 ni 200)
    status, _ = request("GET", f"{API}/admin/stores")
    check("GET /admin/stores sin token es rechazado (401/403)", status in (401, 403), f"status={status}")
    status, _ = request("GET", f"{API}/stores/me")
    check("GET /stores/me sin token es rechazado (401/403)", status in (401, 403), f"status={status}")

    # 5. Checks admin (solo si hay credenciales en el entorno)
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if admin_email and admin_password:
        status, tokens = request("POST", f"{API}/auth/login", {"email": admin_email, "password": admin_password})
        token = (tokens or {}).get("access_token") if status == 200 else None
        if check("POST /auth/login admin devuelve token", bool(token), f"status={status}"):
            status, body = request("GET", f"{API}/admin/stores", token=token)
            check("GET /admin/stores con token responde 200", status == 200, f"status={status}")
            status, body = request("GET", f"{API}/admin/metrics", token=token)
            check("GET /admin/metrics con token responde 200", status == 200, f"status={status}")
    else:
        print("[SKIP] Checks admin: define ADMIN_EMAIL y ADMIN_PASSWORD para incluirlos")

    failed = [name for ok, name in results if not ok]
    print(f"\nResultado: {len(results) - len(failed)}/{len(results)} checks OK")
    if failed:
        print("Fallaron:")
        for name in failed:
            print(f"  - {name}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
