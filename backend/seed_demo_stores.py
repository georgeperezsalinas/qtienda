"""
Crea 20 tiendas de ejemplo en la BD local — mezcla de negocios de servicios
con cita (Dental, Óptica, Plomería, Carpintería, etc.) y tiendas de
productos (repuestos, tecnología, moda, restaurante, etc.), para poder
probar el Mall y el flujo de citas con datos reales sin depender de carga
manual desde el dashboard.

Idempotente: si una tienda con ese slug ya existe, se salta (no duplica).
Todas se crean con is_test=True para que no ensucien analíticas de admin.

Uso:  cd backend && source .venv/bin/activate && python seed_demo_stores.py
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.models.models import Role, User, Store, StoreSettings, Category, Product, ProductImage, Service

DEMO_PASSWORD = "Demo1234!"

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"]


def appointment_hours(sat=False):
    hours = {d: [{"start": "09:00", "end": "13:00"}, {"start": "14:00", "end": "18:00"}] for d in WEEKDAYS}
    if sat:
        hours["sat"] = [{"start": "09:00", "end": "13:00"}]
    return hours


def store_hours(sat=True):
    hours = {d: {"open": "09:00", "close": "19:00"} for d in WEEKDAYS}
    if sat:
        hours["sat"] = {"open": "09:00", "close": "14:00"}
    return hours


CITIES = ["Lima", "Arequipa", "Trujillo", "Cusco", "Piura", "Chiclayo"]

# ── Negocios de servicios con cita ──────────────────────────────
SERVICE_STORES = [
    {
        "slug": "clinica-dental-sonrisas", "name": "Clínica Dental Sonrisas",
        "description": "Odontología general y estética — atención de lunes a sábado.",
        "color": "#2563EB", "auto_confirm": True,
        "services": [
            ("Limpieza dental", 45, 8000),
            ("Consulta general", 30, 5000),
            ("Extracción simple", 40, 12000),
            ("Blanqueamiento dental", 60, 25000),
        ],
    },
    {
        "slug": "optica-vision-clara", "name": "Óptica Visión Clara",
        "description": "Exámenes de la vista, lentes de contacto y monturas.",
        "color": "#0EA5E9", "auto_confirm": True,
        "services": [
            ("Examen de la vista", 30, 4000),
            ("Adaptación de lentes de contacto", 30, 6000),
            ("Consulta oftalmológica", 45, 9000),
        ],
    },
    {
        "slug": "plomeria-express", "name": "Plomería Express",
        "description": "Reparaciones e instalaciones a domicilio, atención rápida.",
        "color": "#F59E0B", "auto_confirm": False,
        "services": [
            ("Visita de diagnóstico", 30, 3000),
            ("Reparación de fuga", 60, 8000),
            ("Instalación de grifería", 60, 7000),
            ("Destape de tuberías", 45, 6000),
        ],
    },
    {
        "slug": "carpinteria-el-roble", "name": "Carpintería El Roble",
        "description": "Muebles a medida y reparaciones en madera.",
        "color": "#92400E", "auto_confirm": False,
        "services": [
            ("Cotización a domicilio", 30, None),
            ("Reparación de mueble", 60, 9000),
            ("Fabricación a medida (consulta)", 45, None),
        ],
    },
    {
        "slug": "salon-bella-imagen", "name": "Salón Bella Imagen",
        "description": "Corte, color y belleza integral.",
        "color": "#DB2777", "auto_confirm": True,
        "services": [
            ("Corte de cabello", 30, 3500),
            ("Tinte y color", 90, 12000),
            ("Manicure y pedicure", 60, 5000),
            ("Peinado para evento", 60, 8000),
        ],
    },
    {
        "slug": "taller-rapidcar", "name": "Taller Mecánico RapidCar",
        "description": "Mantenimiento y diagnóstico automotriz.",
        "color": "#1F2937", "auto_confirm": False,
        "services": [
            ("Cambio de aceite", 30, 6000),
            ("Diagnóstico computarizado", 45, 5000),
            ("Alineamiento y balanceo", 60, 8000),
            ("Revisión pre-viaje", 40, 4500),
        ],
    },
    {
        "slug": "veterinaria-patitas-sanas", "name": "Veterinaria Patitas Sanas",
        "description": "Consultas, vacunación y estética animal.",
        "color": "#16A34A", "auto_confirm": True,
        "services": [
            ("Consulta veterinaria", 30, 5000),
            ("Vacunación", 20, 4000),
            ("Baño y corte", 45, 4500),
            ("Desparasitación", 20, 3000),
        ],
    },
    {
        "slug": "estudio-juridico-rivas", "name": "Estudio Jurídico Rivas & Asoc.",
        "description": "Asesoría legal civil, laboral y contratos.",
        "color": "#4338CA", "auto_confirm": False,
        "services": [
            ("Consulta legal (30 min)", 30, 8000),
            ("Redacción de contrato", 60, None),
            ("Asesoría laboral", 45, 10000),
        ],
    },
]

# ── Tiendas de productos ─────────────────────────────────────────
PRODUCT_STORES = [
    {
        "slug": "techstore-lima", "name": "TechStore Lima", "mall_category": "tecnologia",
        "description": "Accesorios y gadgets para tu celular y laptop.", "color": "#0EA5E9",
        "category": "Tecnología",
        "products": [
            ("Audífonos Bluetooth TWS", 8900, 12900),
            ("Cargador rápido 20W", 4500, None),
            ("Cable USB-C 1m", 1500, None),
            ("Power bank 10000mAh", 9900, 13900),
            ("Funda para celular", 2500, None),
        ],
    },
    {
        "slug": "autoparts-pe", "name": "Repuestos AutoParts PE", "mall_category": None,
        "description": "Repuestos y lubricantes para todo tipo de vehículo.", "color": "#374151",
        "category": "Repuestos",
        "products": [
            ("Filtro de aceite universal", 3500, None),
            ("Pastillas de freno delanteras", 12000, 15000),
            ("Batería 12V 45Ah", 32000, None),
            ("Foco LED H4", 4500, None),
            ("Aceite de motor 4L", 8900, None),
        ],
    },
    {
        "slug": "moda-urbana", "name": "Moda Urbana", "mall_category": "moda",
        "description": "Ropa urbana para chicos y chicas.", "color": "#DC2626",
        "category": "Ropa",
        "products": [
            ("Polo oversize algodón", 4500, 6000),
            ("Jean slim fit", 8900, None),
            ("Casaca urbana", 12900, 16900),
            ("Zapatillas urbanas", 15900, None),
            ("Gorra bordada", 3500, None),
        ],
    },
    {
        "slug": "el-buen-sazon", "name": "Restaurante El Buen Sazón", "mall_category": None,
        "description": "Comida criolla casera, delivery y recojo en tienda.", "color": "#EA580C",
        "category": "Menú",
        "products": [
            ("Lomo saltado", 2200, None),
            ("Ají de gallina", 1800, None),
            ("Arroz con pollo", 1600, None),
            ("Ceviche mixto", 2800, None),
            ("Chicha morada 1L", 900, None),
        ],
    },
    {
        "slug": "belleza-total", "name": "Belleza Total", "mall_category": "belleza",
        "description": "Maquillaje y cuidado facial.", "color": "#DB2777",
        "category": "Cosméticos",
        "products": [
            ("Base líquida matte", 5500, 7000),
            ("Paleta de sombras", 6900, None),
            ("Labial líquido", 3200, None),
            ("Set de brochas", 8900, 11900),
            ("Serum facial vitamina C", 6500, None),
        ],
    },
    {
        "slug": "hogar-decoracion", "name": "Hogar & Decoración", "mall_category": "hogar",
        "description": "Todo para decorar y equipar tu casa.", "color": "#059669",
        "category": "Decoración",
        "products": [
            ("Set de sábanas queen", 8900, 11900),
            ("Cojín decorativo", 3500, None),
            ("Lámpara de mesa", 6900, None),
            ("Organizador de closet", 4500, None),
            ("Cortina blackout", 7900, None),
        ],
    },
    {
        "slug": "mundo-mascotas", "name": "Mundo Mascotas", "mall_category": "mascotas",
        "description": "Alimento y accesorios para tu mascota.", "color": "#16A34A",
        "category": "Alimento y accesorios",
        "products": [
            ("Alimento para perro 15kg", 12900, None),
            ("Arena para gato 10kg", 4500, None),
            ("Correa reflectiva", 3200, None),
            ("Juguete mordedor", 1800, None),
            ("Cama para mascota", 6900, 8900),
        ],
    },
    {
        "slug": "gamerzone-pe", "name": "GamerZone", "mall_category": "videojuegos",
        "description": "Periféricos y accesorios gamer.", "color": "#7C3AED",
        "category": "Videojuegos",
        "products": [
            ("Control inalámbrico", 15900, None),
            ("Mouse gamer RGB", 8900, 11900),
            ("Audífonos gamer", 12900, None),
            ("Silla gamer", 45900, 55900),
            ("Mousepad XL", 3900, None),
        ],
    },
    {
        "slug": "deportodo", "name": "DeporTodo", "mall_category": "deportes",
        "description": "Equipamiento deportivo y fitness.", "color": "#EA580C",
        "category": "Fitness",
        "products": [
            ("Bicicleta urbana", 89900, None),
            ("Balón de fútbol", 4900, None),
            ("Guantes de boxeo", 6900, 8900),
            ("Colchoneta de yoga", 3500, None),
            ("Mancuernas 5kg (par)", 5900, None),
        ],
    },
    {
        "slug": "libreria-el-saber", "name": "Librería El Saber", "mall_category": None,
        "description": "Libros, útiles escolares y de oficina.", "color": "#1D4ED8",
        "category": "Libros y útiles",
        "products": [
            ("Cuaderno universitario", 1200, None),
            ("Set de lapiceros", 900, None),
            ("Mochila escolar", 8900, 11900),
            ("Libro best seller", 3900, None),
            ("Calculadora científica", 4500, None),
        ],
    },
    {
        "slug": "accesorios-brillantes", "name": "Accesorios Brillantes", "mall_category": "moda",
        "description": "Bisutería y accesorios de moda.", "color": "#F59E0B",
        "category": "Bisutería",
        "products": [
            ("Collar de plata 925", 5900, 7900),
            ("Aretes de perlas", 3900, None),
            ("Pulsera ajustable", 2500, None),
            ("Anillo minimalista", 3200, None),
            ("Reloj de moda", 8900, None),
        ],
    },
    {
        "slug": "ferreteria-central", "name": "Ferretería Central", "mall_category": None,
        "description": "Herramientas y materiales de construcción.", "color": "#78350F",
        "category": "Herramientas",
        "products": [
            ("Taladro inalámbrico", 24900, None),
            ("Set de destornilladores", 4500, None),
            ("Cinta métrica 5m", 1500, None),
            ("Martillo de uña", 2500, None),
            ("Caja de tornillos surtidos", 1800, None),
        ],
    },
]


async def get_or_create_owner(db, slug: str, name: str, vendor_role_id: int) -> User:
    email = f"{slug}@demo.qtienda.local"
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        return existing
    user = User(
        email=email,
        full_name=name,
        password_hash=hash_password(DEMO_PASSWORD),
        role_id=vendor_role_id,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def run():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        vendor_role = (await db.execute(select(Role).where(Role.name == "vendor"))).scalar_one_or_none()
        if not vendor_role:
            print("ERROR: rol 'vendor' no existe. Aplica las migraciones primero.")
            await engine.dispose()
            sys.exit(1)

        created, skipped = [], []

        # ── Servicios con cita ──
        for i, spec in enumerate(SERVICE_STORES):
            existing = (await db.execute(select(Store).where(Store.slug == spec["slug"]))).scalar_one_or_none()
            if existing:
                skipped.append(spec["slug"])
                continue

            owner = await get_or_create_owner(db, spec["slug"], spec["name"], vendor_role.id)
            city = CITIES[i % len(CITIES)]
            store = Store(
                user_id=owner.id,
                slug=spec["slug"],
                name=spec["name"],
                description=spec["description"],
                mall_category="servicios",
                status="active",
                primary_color=spec["color"],
                city=city,
                country="PE",
                is_test=True,
            )
            db.add(store)
            await db.flush()

            db.add(StoreSettings(
                store_id=store.id,
                accept_cash=True,
                accept_yape=True,
                store_hours=store_hours(),
                appointment_hours=appointment_hours(sat=True),
                appointments_auto_confirm=spec["auto_confirm"],
            ))

            for order, (name, duration, price) in enumerate(spec["services"]):
                db.add(Service(
                    store_id=store.id,
                    name=name,
                    duration_minutes=duration,
                    price_cents=price,
                    is_active=True,
                    sort_order=order,
                ))

            created.append(f"{spec['name']} (servicios) — https://{spec['slug']}.qtienda.shop/")

        # ── Tiendas de productos ──
        for i, spec in enumerate(PRODUCT_STORES):
            existing = (await db.execute(select(Store).where(Store.slug == spec["slug"]))).scalar_one_or_none()
            if existing:
                skipped.append(spec["slug"])
                continue

            owner = await get_or_create_owner(db, spec["slug"], spec["name"], vendor_role.id)
            city = CITIES[i % len(CITIES)]
            store = Store(
                user_id=owner.id,
                slug=spec["slug"],
                name=spec["name"],
                description=spec["description"],
                mall_category=spec["mall_category"],
                status="active",
                primary_color=spec["color"],
                city=city,
                country="PE",
                is_test=True,
            )
            db.add(store)
            await db.flush()

            db.add(StoreSettings(
                store_id=store.id,
                accept_cash=True,
                accept_yape=True,
                accept_pickup=True,
                store_hours=store_hours(),
            ))

            category = Category(store_id=store.id, name=spec["category"], slug=spec["category"].lower().replace(" ", "-"))
            db.add(category)
            await db.flush()

            for order, (name, price, compare) in enumerate(spec["products"]):
                product = Product(
                    store_id=store.id,
                    category_id=category.id,
                    name=name,
                    slug=f"{name.lower().replace(' ', '-').replace('ñ', 'n')}-{order}",
                    price_cents=price,
                    compare_price=compare,
                    stock=20,
                    status="active",
                    sort_order=order,
                )
                db.add(product)

            created.append(f"{spec['name']} (productos) — https://{spec['slug']}.qtienda.shop/")

        await db.commit()

    await engine.dispose()

    print(f"\n✅ {len(created)} tiendas creadas, {len(skipped)} ya existían (saltadas).\n")
    for line in created:
        print(f"  · {line}")
    if skipped:
        print(f"\nYa existían: {', '.join(skipped)}")
    print(f"\nLogin de cada tienda: {{slug}}@demo.qtienda.local / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(run())
