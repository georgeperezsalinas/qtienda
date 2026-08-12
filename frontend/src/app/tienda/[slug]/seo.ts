// src/app/tienda/[slug]/seo.ts — helper de metadata compartido entre la
// puerta (/tienda/[slug]) y el catálogo (/tienda/[slug]/catalogo). Evita
// duplicar el lookup de producto y los mapas de moneda/locale entre ambas.

import { apiServer } from "@/lib/api-server";
import { formatPrice, stripHtml } from "@/lib/utils";

export const LOCALE_BY_COUNTRY: Record<string, string> = {
  PE: "es_PE", CL: "es_CL", CO: "es_CO", MX: "es_MX", AR: "es_AR",
};

export const CURRENCY_BY_COUNTRY: Record<string, { code: string; symbol: string }> = {
  PE: { code: "PEN", symbol: "S/" },
  CL: { code: "CLP", symbol: "$" },
  CO: { code: "COP", symbol: "$" },
  MX: { code: "MXN", symbol: "$" },
  AR: { code: "ARS", symbol: "$" },
};

export async function fetchStoreAndProductMeta(slug: string, productId?: string) {
  const store = await apiServer(`/public/store/${slug}`);

  // Link a un producto puntual (?p=id) — se ve su propia foto/nombre/precio
  // en la vista previa al compartir, no la de la tienda entera.
  let product: any = null;
  if (productId) {
    try {
      const products = await apiServer(`/public/store/${slug}/products`, { revalidate: 20 });
      product = (products as any[]).find((p) => p.id === productId) ?? null;
    } catch {
      product = null;
    }
  }

  const currency = CURRENCY_BY_COUNTRY[store.country] || CURRENCY_BY_COUNTRY.PE;
  const ogLocale = LOCALE_BY_COUNTRY[store.country] || "es_PE";

  const title = product
    ? `${product.name} · ${store.name}`
    : store.meta_title || store.name;
  const description = product
    ? stripHtml(product.description).slice(0, 155) ||
      `${formatPrice(product.price_cents, currency.code, ogLocale.replace("_", "-"))} · Cómpralo en ${store.name}`
    : store.meta_desc || `Compra en ${store.name} · qtienda.shop`;
  const productImage = product
    ? product.images?.find((im: any) => im.is_primary)?.url ?? product.images?.[0]?.url
    : null;

  return { store, product, currency, ogLocale, title, description, productImage };
}
