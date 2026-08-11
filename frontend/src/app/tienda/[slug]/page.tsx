// src/app/tienda/[slug]/page.tsx — qtienda v2 (con JSON-LD SEO)
//
// CAMBIOS vs versión anterior:
//   - Agrega structured data JSON-LD tipo "Store" + "ItemList" de productos
//   - Google puede mostrar rich snippets: nombre, logo, productos con precio
//   - Agrega canonical URL para evitar contenido duplicado
//   - Revalidación explícita cada 60s (más estable que el default de api-server)

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api-server";
import StorePage from "@/components/store/StorePage";
import Script from "next/script";
import { formatPrice, stripHtml } from "@/lib/utils";

interface Props {
  params: { slug: string };
  searchParams: { p?: string };
}

const LOCALE_BY_COUNTRY: Record<string, string> = {
  PE: "es_PE", CL: "es_CL", CO: "es_CO", MX: "es_MX", AR: "es_AR",
};

const CURRENCY_BY_COUNTRY: Record<string, { code: string; symbol: string }> = {
  PE: { code: "PEN", symbol: "S/" },
  CL: { code: "CLP", symbol: "$" },
  CO: { code: "COP", symbol: "$" },
  MX: { code: "MXN", symbol: "$" },
  AR: { code: "ARS", symbol: "$" },
};

// ── Metadata para Open Graph y Twitter ──────────────────────
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const store = await apiServer(`/public/store/${params.slug}`);

    // Link a un producto puntual (?p=id) — antes SIEMPRE mostraba la vista
    // previa genérica de la tienda al compartir, aunque el link apuntara a
    // un producto específico. Con tanto tráfico de gente compartiendo un
    // solo producto (TikTok, WhatsApp), vale la pena que se vea su propia
    // foto/nombre/precio en la vista previa, no la de la tienda entera.
    const productId = searchParams?.p;
    let product: any = null;
    if (productId) {
      try {
        const products = await apiServer(`/public/store/${params.slug}/products`, { revalidate: 20 });
        product = (products as any[]).find((p) => p.id === productId) ?? null;
      } catch {
        product = null;
      }
    }

    const currency = CURRENCY_BY_COUNTRY[store.country] || CURRENCY_BY_COUNTRY.PE;
    const canonicalUrl = product
      ? `https://qtienda.shop/tienda/${params.slug}?p=${productId}`
      : `https://qtienda.shop/tienda/${params.slug}`;

    const title = product
      ? `${product.name} · ${store.name}`
      : store.meta_title || store.name;
    const description = product
      ? stripHtml(product.description).slice(0, 155) ||
        `${formatPrice(product.price_cents, currency.code)} · Cómpralo en ${store.name}`
      : store.meta_desc || `Compra en ${store.name} · qtienda.shop`;
    const productImage = product
      ? product.images?.find((im: any) => im.is_primary)?.url ?? product.images?.[0]?.url
      : null;

    return {
      title,
      description,
      alternates: {
        // Canonical evita que Google indexe la misma tienda/producto con params duplicados
        canonical: canonicalUrl,
      },
      openGraph: {
        // Mismo titulo que la pestaña — si el vendedor configuro un titulo SEO
        // custom, tambien se ve al compartir el link, no solo en el navegador.
        title,
        description,
        // Sin "images" (caso tienda): la genera /tienda/[slug]/opengraph-image.tsx
        // (PNG real, WhatsApp/Facebook no renderizan el SVG de marca de antes).
        // Con producto: su propia foto real, no hace falta generar nada.
        ...(productImage ? { images: [{ url: productImage, width: 1200, height: 1200 }] } : {}),
        type: "website",
        locale: LOCALE_BY_COUNTRY[store.country] || "es_PE",
        url: canonicalUrl,
        siteName: "qtienda",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(productImage ? { images: [productImage] } : {}),
      },
    };
  } catch {
    return { title: "Tienda · qtienda.shop" };
  }
}

// ── Página principal con JSON-LD ─────────────────────────────
export default async function TiendaPage({ params }: Props) {
  try {
    // Revalidación corta (20s): precios, envío y demás Ajustes del vendedor
    // afectan el checkout directamente y deben reflejarse casi al instante.
    const [store, products] = await Promise.all([
      apiServer(`/public/store/${params.slug}`, { revalidate: 20 }),
      apiServer(`/public/store/${params.slug}/products`, { revalidate: 20 }),
    ]);

    // Metodos de pago y moneda reales de esta tienda — nunca un valor
    // generico igual para todas (antes asumia siempre Peru/soles).
    const currency = CURRENCY_BY_COUNTRY[store.country] || CURRENCY_BY_COUNTRY.PE;
    const paymentLabels: [string, string][] = [
      ["accept_cash", "Cash"],
      ["accept_card", "Credit Card"],
      ["accept_yape", "Yape"],
      ["accept_plin", "Plin"],
      ["accept_transfer", "Bank Transfer"],
    ];
    const paymentAccepted =
      paymentLabels
        .filter(([key]) => store.settings?.[key])
        .map(([, label]) => label)
        .join(", ") || "Cash";

    // ── JSON-LD: LocalBusiness / Store ────────────────────
    const storeSchema = {
      "@context": "https://schema.org",
      "@type": "Store",
      name: store.name,
      description: store.description || `Tienda online de ${store.name}`,
      url: `https://qtienda.shop/tienda/${store.slug}`,
      ...(store.logo_url && { logo: store.logo_url }),
      ...(store.banner_url && { image: store.banner_url }),
      ...(store.city && {
        address: {
          "@type": "PostalAddress",
          addressLocality: store.city,
          addressCountry: store.country || "PE",
        },
      }),
      ...(store.whatsapp && {
        telephone: store.whatsapp,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          contactOption: "TollFree",
          availableLanguage: "Spanish",
        },
      }),
      priceRange: currency.symbol,
      currenciesAccepted: currency.code,
      paymentAccepted,
    };

    // ── JSON-LD: ItemList de productos (primeros 10) ───────
    // Google puede mostrar los productos directamente en resultados de búsqueda
    const topProducts = (products as any[]).slice(0, 10);
    const productListSchema =
      topProducts.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Productos de ${store.name}`,
            url: `https://qtienda.shop/tienda/${store.slug}`,
            numberOfItems: topProducts.length,
            itemListElement: topProducts.map((p: any, idx: number) => ({
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "Product",
                name: p.name,
                description: p.description || "",
                url: `https://qtienda.shop/tienda/${store.slug}?p=${p.id}`,
                ...(p.images?.[0]?.url && { image: p.images[0].url }),
                offers: {
                  "@type": "Offer",
                  priceCurrency: "PEN",
                  price: (p.price_cents / 100).toFixed(2),
                  availability:
                    p.stock === 0
                      ? "https://schema.org/OutOfStock"
                      : "https://schema.org/InStock",
                  seller: {
                    "@type": "Store",
                    name: store.name,
                  },
                },
              },
            })),
          }
        : null;

    return (
      <>
        {/* JSON-LD inyectado en el <head> via next/script */}
        <Script
          id="schema-store"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }}
        />
        {productListSchema && (
          <Script
            id="schema-products"
            type="application/ld+json"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(productListSchema),
            }}
          />
        )}
        <StorePage store={store} initialProducts={products} />
      </>
    );
  } catch {
    notFound();
  }
}
