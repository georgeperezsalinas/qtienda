// src/app/tienda/[slug]/page.tsx — puerta de la tienda (slug.qtienda.shop/)
//
// Primera pantalla al entrar a una tienda: logo, abierto/cerrado, URL para
// compartir, ruleta si está activa, y botón para pasar al catálogo real
// (/tienda/[slug]/catalogo). El catálogo completo con productos, filtros,
// carrito y checkout vive en esa otra ruta — ver ese archivo.
//
// Un link compartido de un producto puntual (?p=id) redirige directo al
// catálogo con ese mismo query, para no obligar a pasar por la puerta.

import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Script from "next/script";
import StoreDoor from "@/components/store/StoreDoor";
import { fetchStoreAndProductMeta } from "./seo";

interface Props {
  params: { slug: string };
  searchParams: { p?: string };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { store, product, ogLocale, title, description, productImage } =
      await fetchStoreAndProductMeta(params.slug, searchParams?.p);

    // Si hay producto, el canonical apunta directo al catálogo (ahí es donde
    // termina viviendo tras el redirect) — así el link compartido y lo que
    // Google indexa coinciden con la URL final.
    const canonicalUrl = product
      ? `https://${params.slug}.qtienda.shop/catalogo?p=${searchParams.p}`
      : `https://${params.slug}.qtienda.shop/`;

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

export default async function TiendaDoorPage({ params, searchParams }: Props) {
  // Link a un producto puntual: se salta la puerta, va directo a verlo.
  if (searchParams?.p) {
    redirect(`/catalogo?p=${searchParams.p}`);
  }

  try {
    const { store, currency } = await fetchStoreAndProductMeta(params.slug);

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

    // JSON-LD: LocalBusiness / Store — la puerta es la URL canónica de la
    // tienda, así que este es su lugar natural (el ItemList de productos
    // vive en /catalogo, que es donde de verdad están).
    const storeSchema = {
      "@context": "https://schema.org",
      "@type": "Store",
      name: store.name,
      description: store.description || `Tienda online de ${store.name}`,
      url: `https://${store.slug}.qtienda.shop/`,
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
      ...(store.rating_count > 0 && store.rating_avg != null && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: store.rating_avg,
          reviewCount: store.rating_count,
          bestRating: 5,
          worstRating: 1,
        },
      }),
    };

    return (
      <>
        <Script
          id="schema-store"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }}
        />
        <StoreDoor store={store} />
      </>
    );
  } catch {
    notFound();
  }
}
