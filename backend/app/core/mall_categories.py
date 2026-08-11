"""Departamentos fijos del Mall Qtienda — taxonomía curada, distinta de las
categorías internas de productos que cada vendedor arma dentro de su propia
tienda (esas siguen siendo libres). El vendedor elige UN departamento para
su tienda; sirve para navegar el Mall por rubro con algo consistente en vez
de nombres de categoría escritos libremente por cada vendedor.
"""

MALL_CATEGORIES = [
    {"slug": "moda", "label": "Moda", "icon": "🛍️"},
    {"slug": "belleza", "label": "Belleza", "icon": "💄"},
    {"slug": "hogar", "label": "Hogar", "icon": "🏠"},
    {"slug": "tecnologia", "label": "Tecnología", "icon": "📱"},
    {"slug": "mascotas", "label": "Mascotas", "icon": "🐶"},
    {"slug": "videojuegos", "label": "Videojuegos", "icon": "🎮"},
    {"slug": "deportes", "label": "Deportes", "icon": "⚽"},
]

MALL_CATEGORY_SLUGS = {c["slug"] for c in MALL_CATEGORIES}
