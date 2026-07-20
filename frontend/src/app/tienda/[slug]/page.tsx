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

interface Props {
  params: { slug: string };
}

// ── Metadata para Open Graph y Twitter ──────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const store = await apiServer(`/public/store/${params.slug}`);
    const title = store.meta_title || store.name;
    const description =
      store.meta_desc || `Compra en ${store.name} · qtienda.shop`;

    return {
      title,
      description,
      alternates: {
        // Canonical evita que Google indexe la misma tienda con params duplicados
        canonical: `https://qtienda.shop/tienda/${params.slug}`,
      },
      openGraph: {
        title: store.name,
        description,
        images: store.banner_url ? [{ url: store.banner_url }] : store.logo_url ? [{ url: store.logo_url }] : [],
        type: "website",
        locale: "es_PE",
        url: `https://qtienda.shop/tienda/${params.slug}`,
        siteName: "qtienda",
      },
      twitter: {
        card: "summary_large_image",
        title: store.name,
        description,
        images: store.banner_url ? [store.banner_url] : store.logo_url ? [store.logo_url] : [],
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
          addressCountry: "PE",
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
      priceRange: "S/",
      currenciesAccepted: "PEN",
      paymentAccepted: "Cash, Credit Card, Mobile Payment",
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
                url: `https://qtienda.shop/tienda/${store.slug}?producto=${p.id}`,
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
