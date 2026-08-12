// src/app/tienda/[slug]/catalogo/page.tsx — catálogo real de la tienda
// (slug.qtienda.shop/catalogo). Todo lo que antes vivía en la raíz —
// filtros, grid de productos, carrito, checkout — vive acá. La raíz
// (../page.tsx) es ahora la "puerta": logo, horario, URL para compartir,
// ruleta, y un botón para entrar hasta acá.

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import StorePage from "@/components/store/StorePage";
import { apiServer } from "@/lib/api-server";
import { fetchStoreAndProductMeta, CURRENCY_BY_COUNTRY } from "../seo";

interface Props {
  params: { slug: string };
  searchParams: { p?: string };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { store, product, ogLocale, title, description, productImage } =
      await fetchStoreAndProductMeta(params.slug, searchParams?.p);

    const canonicalUrl = product
      ? `https://${params.slug}.qtienda.shop/catalogo?p=${searchParams.p}`
      : `https://${params.slug}.qtienda.shop/catalogo`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        ...(productImage ? { images: [{ url: productImage, width: 1200, height: 1200 }] } : {}),
        type: "website",
        locale: ogLocale,
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

export default async function TiendaCatalogoPage({ params }: Props) {
  try {
    // Revalidación corta (20s): precios, envío y demás Ajustes del vendedor
    // afectan el checkout directamente y deben reflejarse casi al instante.
    const [store, products] = await Promise.all([
      apiServer(`/public/store/${params.slug}`, { revalidate: 20 }),
      apiServer(`/public/store/${params.slug}/products`, { revalidate: 20 }),
    ]);

    // JSON-LD: ItemList de productos (primeros 10) — Google puede mostrarlos
    // directo en resultados de búsqueda. El LocalBusiness/Store vive en la
    // puerta (../page.tsx), acá solo el listado de productos.
    const currency = CURRENCY_BY_COUNTRY[store.country] || CURRENCY_BY_COUNTRY.PE;
    const topProducts = (products as any[]).slice(0, 10);
    const productListSchema =
      topProducts.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Productos de ${store.name}`,
            url: `https://${store.slug}.qtienda.shop/catalogo`,
            numberOfItems: topProducts.length,
            itemListElement: topProducts.map((p: any, idx: number) => ({
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "Product",
                name: p.name,
                description: p.description || "",
                url: `https://${store.slug}.qtienda.shop/catalogo?p=${p.id}`,
                ...(p.images?.[0]?.url && { image: p.images[0].url }),
                offers: {
                  "@type": "Offer",
                  priceCurrency: currency.code,
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
