// src/app/tienda/[slug]/producto/[productId]/page.tsx — página completa de
// producto (slug.qtienda.shop/producto/{id}). Complementa el sheet rápido
// que sigue viviendo en /catalogo: acá hay espacio real para descripciones
// largas, más fotos, y es la URL que Google/WhatsApp indexan y muestran
// para un producto puntual (antes esto vivía solo como ?p= sobre el
// catálogo, que nunca abría nada al cargar — ver seo.ts).

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import ProductPage from "@/components/store/ProductPage";
import { apiServer } from "@/lib/api-server";
import { fetchStoreAndProductMeta, CURRENCY_BY_COUNTRY } from "../../seo";

interface Props {
  params: { slug: string; productId: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { product, ogLocale, title, description, productImage } =
      await fetchStoreAndProductMeta(params.slug, params.productId);

    if (!product) return { title: "Producto · qtienda.shop" };

    const canonicalUrl = `https://${params.slug}.qtienda.shop/producto/${params.productId}`;

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
    return { title: "Producto · qtienda.shop" };
  }
}

export default async function ProductoPage({ params }: Props) {
  try {
    const [store, products] = await Promise.all([
      apiServer(`/public/store/${params.slug}`, { revalidate: 20 }),
      apiServer(`/public/store/${params.slug}/products`, { revalidate: 20 }),
    ]);

    const product = (products as any[]).find((p) => p.id === params.productId);
    if (!product) notFound();

    // JSON-LD: Product — más específico que el ItemList del catálogo, es lo
    // que Google prefiere para la página canónica de un producto puntual.
    const currency = CURRENCY_BY_COUNTRY[store.country] || CURRENCY_BY_COUNTRY.PE;
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description || "",
      ...(product.images?.length && { image: product.images.map((im: any) => im.url) }),
      offers: {
        "@type": "Offer",
        priceCurrency: currency.code,
        price: (product.price_cents / 100).toFixed(2),
        availability:
          product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        url: `https://${store.slug}.qtienda.shop/producto/${product.id}`,
        seller: { "@type": "Store", name: store.name },
      },
    };

    return (
      <>
        <Script
          id="schema-product"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
        <ProductPage store={store} product={product} allProducts={products as any[]} />
      </>
    );
  } catch {
    notFound();
  }
}
