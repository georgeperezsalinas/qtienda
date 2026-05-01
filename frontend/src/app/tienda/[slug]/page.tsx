import { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiServer } from "@/lib/api-server";
import StorePage from "@/components/store/StorePage";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const store = await apiServer(`/public/store/${params.slug}`);
    return {
      title:       store.meta_title || store.name,
      description: store.meta_desc  || `Compra en ${store.name} · qtienda.shop`,
      openGraph: {
        title:       store.name,
        description: store.meta_desc || `Tienda de ${store.name}`,
        images:      store.banner_url ? [{ url: store.banner_url }] : [],
        type:        "website",
        locale:      "es_PE",
      },
      twitter: {
        card:  "summary_large_image",
        title: store.name,
      },
    };
  } catch {
    return { title: "Tienda · qtienda.shop" };
  }
}

export default async function TiendaPage({ params }: Props) {
  try {
    const [store, products] = await Promise.all([
      apiServer(`/public/store/${params.slug}`),
      apiServer(`/public/store/${params.slug}/products`),
    ]);
    return <StorePage store={store} initialProducts={products} />;
  } catch {
    notFound();
  }
}
