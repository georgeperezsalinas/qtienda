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

// /public/stores está paginado (no devuelve todas las tiendas en una sola
// llamada) — se recorren las páginas hasta agotarlas para que el sitemap
// incluya TODAS las tiendas activas, no solo las primeras 24/60.
// Tope de 50 páginas (=3000 tiendas con limit=60) como salvaguarda razonable.
async function getActiveSlugs(): Promise<string[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
  const slugs: string[] = [];
  try {
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(`${apiUrl}/public/stores?page=${page}&limit=60`, {
        next: { revalidate: 3600 }, // Regenera el sitemap cada 1h
      });
      if (!res.ok) break;
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      items.forEach((s: { slug: string }) => s.slug && slugs.push(s.slug));
      if (items.length < 60 || page >= (data?.pages ?? 1)) break;
    }
    return slugs;
  } catch {
    return slugs;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getActiveSlugs();

  // Rutas estáticas
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/auth/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/auth/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/tiendas`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Rutas dinámicas: una por tienda
  const storeRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE_URL}/tienda/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,           // Alta prioridad — son las páginas más valiosas
  }));

  return [...staticRoutes, ...storeRoutes];
}
