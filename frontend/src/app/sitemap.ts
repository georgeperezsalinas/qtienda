// src/app/sitemap.ts — qtienda v2
//
// Next.js genera /sitemap.xml automáticamente desde este archivo.
// Incluye:
//   - Rutas estáticas (landing, login, registro)
//   - Rutas dinámicas: una entrada por cada tienda activa en la BD
//
// Google usa el sitemap para indexar las tiendas de los emprendedores.
// Más tiendas indexadas = más tráfico orgánico para tus usuarios.

import { MetadataRoute } from "next";

const BASE_URL = "https://qtienda.shop";

interface StoreSitemapEntry {
  slug: string;
  updated_at?: string;
}

// /public/stores está paginado (no devuelve todas las tiendas en una sola
// llamada) — se recorren las páginas hasta agotarlas para que el sitemap
// incluya TODAS las tiendas activas, no solo las primeras 24/60.
// Tope de 50 páginas (=3000 tiendas con limit=60) como salvaguarda razonable.
async function getActiveStores(): Promise<StoreSitemapEntry[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
  const stores: StoreSitemapEntry[] = [];
  try {
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(`${apiUrl}/public/stores?page=${page}&limit=60`, {
        next: { revalidate: 3600 }, // Regenera el sitemap cada 1h
      });
      if (!res.ok) break;
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      items.forEach((s: StoreSitemapEntry) => s.slug && stores.push(s));
      if (items.length < 60 || page >= (data?.pages ?? 1)) break;
    }
    return stores;
  } catch {
    return stores;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stores = await getActiveStores();

  // Rutas estáticas — sin lastModified: no hay una fecha real de "última
  // edición" para estas páginas, y decir "hoy" en cada regeneración
  // (como antes) le miente a Google sobre qué cambió de verdad.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/auth/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/auth/register`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/tiendas`, changeFrequency: "daily", priority: 0.8 },
  ];

  // Rutas dinámicas: una por tienda, con la fecha real de su último cambio
  // (datos de la tienda o de su catálogo, lo que sea más reciente).
  const storeRoutes: MetadataRoute.Sitemap = stores.map((s) => ({
    // Cada tienda vive en su propio subdominio (slug.qtienda.shop) — el
    // sitemap debe listar la URL final, no la que redirige hacia ella.
    url: `https://${s.slug}.qtienda.shop/`,
    ...(s.updated_at ? { lastModified: new Date(s.updated_at) } : {}),
    changeFrequency: "daily" as const,
    priority: 0.9,           // Alta prioridad — son las páginas más valiosas
  }));

  return [...staticRoutes, ...storeRoutes];
}
