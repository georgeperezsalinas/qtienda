// src/middleware.ts — qtienda v2
//
// Cada tienda vive en su propio subdominio: slug.qtienda.shop
// Internamente el sitio sigue siendo una sola app Next.js con la ruta
// /tienda/[slug] — este middleware traduce entre ambos mundos:
//
//   slug.qtienda.shop/          → rewrite interno → /tienda/slug
//   slug.qtienda.shop/pedido/x  → rewrite interno → /tienda/slug/pedido/x
//   qtienda.shop/tienda/slug    → redirect 301    → slug.qtienda.shop/
//
// La segunda regla consolida las URLs viejas (ya indexadas en Google) hacia
// el nuevo subdominio, para no dejar dos direcciones sirviendo lo mismo.

import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "qtienda.shop";

// Subdominios que NO son tiendas — si algún día se usan para otra cosa
// (api, cdn, etc.) no deben ser tratados como un slug de tienda.
const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "cdn", "static", "mail", "ftp", "admin", "app", "staging", "dev", "test",
]);

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

// Rutas globales de la plataforma (no son contenido de ninguna tienda) —
// si algo dentro de una tienda linkea a "crear cuenta" o "mis pedidos", debe
// resolver esa página real, no reescribirse a /tienda/slug/registro (404).
// Son los directorios hermanos de "tienda" en frontend/src/app/.
const GLOBAL_ROUTES = new Set([
  "admin", "auth", "dashboard", "delivery-app", "mi-cuenta",
  "mis-pedidos", "offline", "privacidad", "registro", "terminos", "tiendas",
]);

export function middleware(req: NextRequest) {
  const hostname = (req.headers.get("host") || "").split(":")[0].toLowerCase();

  // Fuera de qtienda.shop (localhost en dev, previews, etc.) — sin tocar nada.
  if (hostname !== ROOT_DOMAIN && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return NextResponse.next();
  }

  // Dominio principal (apex o www): el sitio de siempre, salvo que sea una
  // URL vieja de tienda — esa se consolida hacia el subdominio.
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    const match = req.nextUrl.pathname.match(/^\/tienda\/([a-z0-9-]+)(\/.*)?$/);
    if (match) {
      const [, slug, rest] = match;
      const url = req.nextUrl.clone();
      // nextUrl hereda protocolo/puerto de cómo Next.js ve la request
      // internamente (detrás de nginx, eso es http://<container>:3000) — sin
      // esto el Location quedaba en "https://slug.qtienda.shop:3000/", un
      // puerto inalcanzable desde afuera que dejaba el navegador colgado.
      url.protocol = "https:";
      url.port = "";
      url.hostname = `${slug}.${ROOT_DOMAIN}`;
      url.pathname = rest || "/";
      return NextResponse.redirect(url, 301);
    }
    return NextResponse.next();
  }

  // Subdominio de tienda: slug.qtienda.shop → /tienda/slug internamente —
  // salvo que sea una ruta global de la plataforma (ej. slug.qtienda.shop/registro
  // debe servir /registro tal cual, no /tienda/slug/registro) o un archivo
  // estático de public/ (ej. /brand/qtienda-wordmark.svg, /assets/..., /logo.png)
  // — ningún contenido real de tienda vive en una ruta que termina en punto+
  // extensión, así que se detecta por forma en vez de tener que listar cada
  // carpeta de public/ una por una.
  const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!RESERVED_SUBDOMAINS.has(sub) && SLUG_RE.test(sub)) {
    const firstSegment = req.nextUrl.pathname.split("/")[1] || "";
    const looksLikeStaticFile = /\.[a-zA-Z0-9]+$/.test(req.nextUrl.pathname);
    if (GLOBAL_ROUTES.has(firstSegment) || looksLikeStaticFile) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = `/tienda/${sub}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon|icon|apple-touch-icon|manifest|robots.txt|sitemap.xml|sw.js).*)",
  ],
};
