// src/lib/api-server.ts — qtienda v2 (revalidación optimizada)
//
// CAMBIOS vs versión anterior:
//   - revalidate: 5 → demasiado agresivo. Reconstruía HTML cada 5s
//     para páginas que cambian pocas veces al día.
//   - Ahora acepta un `revalidate` por llamada con defaults sensatos:
//       Tienda pública:  60s  (catálogo cambia poco)
//       Listado tiendas: 120s (homepage de qtienda)
//       Productos:       60s
//   - Agrega manejo de errores con mensaje descriptivo para debug.
//   - Mantiene compatibilidad total con el código existente
//     (los sitios que llaman apiServer sin opciones usan 60s por defecto).

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";

interface ApiServerOptions extends RequestInit {
  // Segundos de ISR. Default 60. Pasar 0 para no cachear (SSR puro).
  revalidate?: number;
}

export async function apiServer(
  path: string,
  options: ApiServerOptions = {}
) {
  const { revalidate = 60, ...init } = options;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    next: { revalidate },
  });

  if (!res.ok) {
    // Mensaje descriptivo para debug en logs del servidor
    throw new Error(
      `[apiServer] ${res.status} ${res.statusText} — ${path}`
    );
  }

  return res.json();
}

// ── Helpers tipados para los casos más comunes ───────────────
// Úsalos en los Server Components para mayor claridad:
//
//   import { apiPublicStore, apiPublicProducts } from "@/lib/api-server";
//   const store = await apiPublicStore(slug);

export const apiPublicStore = (slug: string) =>
  apiServer(`/public/store/${slug}`, { revalidate: 60 });

export const apiPublicProducts = (slug: string) =>
  apiServer(`/public/store/${slug}/products`, { revalidate: 60 });

export const apiPublicStores = () =>
  apiServer("/public/stores", { revalidate: 120 });
