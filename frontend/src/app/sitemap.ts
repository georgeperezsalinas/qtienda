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

async function getActiveSlugs(): Promise<string[]> {
  try {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
    const res = await fetch(`${apiUrl}/public/stores`, {
      next: { revalidate: 3600 }, // Regenera el sitemap cada 1h
    });
    if (!res.ok) return [];
    const stores = await res.json();
    return Array.isArray(stores)
      ? stores.map((s: { slug: string }) => s.slug).filter(Boolean)
      : [];
  } catch {
    return [];
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
