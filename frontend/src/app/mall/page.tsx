// src/app/mall/page.tsx — puerta del Mall Qtienda
//
// Antes de llegar al directorio real (/tiendas, con buscador/categorías/
// productos), esta es la pantalla de bienvenida al Mall — mismo patrón que
// la puerta de cada tienda individual (StoreDoor → catálogo). Fondo real
// (frontend/public/mall/Mallqtiendafondo.png) con overlay oscuro fijo: es
// una sola atmósfera de marca, no reacciona al tema claro/oscuro del resto
// del sitio (como el CTA final de la landing o la franja de stats).

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Search, ShoppingBag, Store, MessageCircle, Percent,
  Wallet, Globe2,
} from "lucide-react";
import Logo from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Mall Qtienda — Descubre. Compra. Emprende.",
  description:
    "El directorio de tiendas de qtienda. Encuentra negocios reales de emprendedores, compra directo por WhatsApp y sin comisiones ocultas.",
  alternates: { canonical: "/mall" },
};

interface MallCategory {
  slug: string;
  label: string;
  icon: string | null;
  store_count: number;
}

async function getMallStats() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
  try {
    const [storesRes, citiesRes, categoriesRes] = await Promise.all([
      fetch(`${apiUrl}/public/stores?limit=1`, { next: { revalidate: 120 } }),
      fetch(`${apiUrl}/public/store-cities`, { next: { revalidate: 120 } }),
      fetch(`${apiUrl}/public/mall-categories`, { next: { revalidate: 120 } }),
    ]);
    const stores = storesRes.ok ? await storesRes.json() : { total: 0 };
    const cities = citiesRes.ok ? await citiesRes.json() : [];
    const categories: MallCategory[] = categoriesRes.ok ? await categoriesRes.json() : [];
    return {
      storesTotal: stores?.total ?? 0,
      citiesTotal: Array.isArray(cities) ? cities.length : 0,
      categories: Array.isArray(categories) ? categories.filter((c) => c.store_count > 0) : [],
    };
  } catch {
    return { storesTotal: 0, citiesTotal: 0, categories: [] as MallCategory[] };
  }
}

const FEATURES = [
  [Search, "Descubre", "Tiendas reales y productos únicos, organizados por rubro."],
  [ShoppingBag, "Compra", "Fácil, directo con el vendedor — sin intermediarios."],
  [Store, "Emprende", "Crea tu tienda gratis y aparece acá mismo."],
  [MessageCircle, "Conecta", "Habla por WhatsApp y recibe tu pedido."],
] as const;

const TRUST = [
  [Percent, "0% comisión para vendedores"],
  [Wallet, "Cobra o paga como prefieras — Yape, Plin, efectivo"],
  [MessageCircle, "Directo con el vendedor por WhatsApp"],
  [Globe2, "Hecho en LatAm, para emprendedores LatAm"],
] as const;

export default async function MallDoorPage() {
  const { storesTotal, citiesTotal, categories } = await getMallStats();

  const STATS = [
    [storesTotal, storesTotal === 1 ? "tienda activa" : "tiendas activas"],
    [citiesTotal, citiesTotal === 1 ? "ciudad" : "ciudades"],
    [categories.length, categories.length === 1 ? "categoría" : "categorías"],
    ["0%", "comisión"],
  ] as const;

  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden" style={{ background: "#0E0904" }}>
      <Image
        src="/mall/Mallqtiendafondo.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: "center 30%" }}
      />
      {/* Overlay fijo — el fondo es una foto de atmósfera, el texto necesita
          contraste garantizado sin importar qué tan clara sea la imagen */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,6,3,.45) 0%, rgba(10,6,3,.72) 45%, rgba(10,6,3,.94) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 15%, rgba(224,112,63,.28) 0%, transparent 60%)",
        }}
      />

      {/* ── Nav mínima ── */}
      <header className="relative z-10 flex items-center justify-between px-5 md:px-10" style={{ paddingTop: "max(18px, env(safe-area-inset-top))" }}>
        <Logo size="md" variant="white" />
        <Link
          href="/auth/login"
          className="text-sm font-semibold transition-colors"
          style={{ color: "#FBEDE2" }}
        >
          Ingresar
        </Link>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 py-14 md:py-20">
        <p
          className="eyebrow animate-fade-up"
          style={{ color: "#E0703F", letterSpacing: "0.16em", fontWeight: 700 }}
        >
          MALL QTIENDA
        </p>
        <h1
          className="font-display-marketing animate-fade-up delay-50"
          style={{
            fontSize: "clamp(48px, 13vw, 108px)",
            lineHeight: 0.94,
            letterSpacing: "-0.02em",
            color: "#FBEDE2",
            textShadow: "0 4px 40px rgba(0,0,0,.5)",
            marginTop: 8,
          }}
        >
          Descubre.
          <br />
          <span style={{ color: "#E0703F" }}>Compra.</span>
          <br />
          Emprende.
        </h1>
        <p
          className="animate-fade-up delay-100"
          style={{ color: "#D9BBA6", fontSize: 16, lineHeight: 1.6, maxWidth: 460, marginTop: 22 }}
        >
          Tiendas reales de emprendedores, en un solo lugar. Busca, compara y
          compra directo con el vendedor — sin intermediarios.
        </p>

        <Link
          href="/tiendas"
          className="animate-fade-up delay-150 inline-flex items-center gap-2.5 rounded-full font-bold transition-all active:scale-[.97]"
          style={{
            marginTop: 30,
            padding: "16px 34px",
            fontSize: 16,
            color: "#fff",
            background: "linear-gradient(120deg, #C5613B, #E0703F)",
            boxShadow: "0 10px 32px rgba(224,112,63,.45)",
          }}
        >
          <ShoppingBag size={18} />
          Entra al Mall
          <ArrowRight size={17} />
        </Link>

        {/* ── Features ── */}
        <div className="animate-fade-up delay-200 grid grid-cols-2 md:grid-cols-4 gap-3 mt-14 w-full max-w-2xl">
          {FEATURES.map(([Icon, title, desc]) => (
            <div
              key={title}
              className="rounded-2xl p-4 text-left"
              style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              <div
                className="flex items-center justify-center rounded-full mb-2.5"
                style={{ width: 34, height: 34, background: "rgba(224,112,63,.18)" }}
              >
                <Icon size={16} style={{ color: "#E0703F" }} />
              </div>
              <p className="font-display-marketing text-sm" style={{ color: "#FBEDE2" }}>{title}</p>
              <p className="text-xs mt-1" style={{ color: "#A6907C", lineHeight: 1.45 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── Stats reales — nunca inventados ── */}
        <div
          className="animate-fade-up delay-200 grid grid-cols-4 gap-2 mt-6 w-full max-w-2xl rounded-2xl"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", padding: "18px 8px" }}
        >
          {STATS.map(([n, label]) => (
            <div key={label}>
              <p className="mono font-extrabold" style={{ fontSize: "clamp(18px,4vw,26px)", color: "#FBEDE2" }}>{n}</p>
              <p className="text-[10px] md:text-xs mt-0.5" style={{ color: "#A6907C", lineHeight: 1.3 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Categorías reales ── */}
        {categories.length > 0 && (
          <div className="animate-fade-up delay-300 w-full max-w-3xl mt-10">
            <p className="text-xs font-semibold mb-3" style={{ color: "#A6907C" }}>
              Todas las categorías que buscas
            </p>
            <div className="flex items-center justify-center flex-wrap gap-2.5">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/tiendas?mall_category=${c.slug}`}
                  className="flex items-center gap-1.5 rounded-full transition-all active:scale-95"
                  style={{
                    padding: "8px 14px",
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.1)",
                    color: "#FBEDE2",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: 15 }}>{c.icon || "🛍️"}</span>
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Confianza ── */}
        <div className="animate-fade-up delay-300 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 mt-12 max-w-2xl">
          {TRUST.map(([Icon, label]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#C7AC96" }}>
              <Icon size={13} style={{ color: "#E0703F" }} />
              {label}
            </span>
          ))}
        </div>
      </main>

      <footer className="relative z-10 text-center pb-8 px-5">
        <a
          href="https://qtienda.shop"
          className="text-[11px]"
          style={{ color: "#7A6656" }}
        >
          Un producto de qtienda
        </a>
      </footer>
    </div>
  );
}
