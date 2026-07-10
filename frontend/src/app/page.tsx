// src/app/page.tsx — qtienda v2 (landing pública)
// Reemplaza completo. Mantiene fetch de StoresSection.

import Link from "next/link";
import { ArrowRight, ChevronRight, Check, Package } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { resolveMediaUrl } from "@/lib/media";

interface StoreCard {
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  primary_color: string;
}

async function getStores(): Promise<StoreCard[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
    const res = await fetch(`${apiUrl}/public/stores`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function StoresSection() {
  const stores = await getStores();
  if (!stores.length) return null;
  return (
    <section className="px-5 md:px-10 py-14 max-w-5xl mx-auto w-full">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow">Tiendas activas</p>
          <p className="text-xl font-medium mt-1" style={{ letterSpacing: "-0.014em" }}>
            <span className="mono num">{stores.length.toLocaleString()}</span> tiendas en qtienda
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {stores.map((s) => (
          <Link
            key={s.slug}
            href={`/tienda/${s.slug}`}
            className="card p-4 flex flex-col items-center text-center gap-3 transition-colors hover:bg-[var(--tint)]"
          >
            {s.logo_url ? (
              <img src={resolveMediaUrl(s.logo_url)} alt={s.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
            ) : (
              <div
                className="placeholder flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--ink-3)",
                }}
              >
                {s.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-medium truncate" style={{ color: "var(--ink)", maxWidth: 100 }}>
                {s.name}
              </p>
              {s.city && (
                <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {s.city}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  ["01", "Link propio", "qtienda.shop/tu-nombre, listo al crear tu cuenta."],
  ["02", "WhatsApp directo", "Cada pedido cae a tu chat, sin intermediarios."],
  ["03", "Pagos como vendes", "Tarjeta, Yape/Plin, transferencia o efectivo."],
  ["04", "Envíos sin calculadora", "Costo por zona o gratis sobre cierto monto."],
  ["05", "Sin comisión", "Cobras todo. El plan free dura para siempre."],
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between animate-fade-in"
        style={{
          padding: "14px 22px",
          background: "rgba(247,245,240,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Logo size="md" />
        <div className="flex items-center gap-2">
          <Link href="/auth/login" className="btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
            Ingresar
          </Link>
          <Link href="/auth/register" className="btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
            Crear tienda
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="px-5 md:px-10 pt-14 md:pt-20 pb-10 max-w-5xl mx-auto w-full">
        <div className="md:max-w-3xl">
          <div className="flex items-center gap-2 mb-6 animate-fade-up">
            <span className="dot dot-success animate-pulse-soft" />
            <span className="eyebrow">Gratis para siempre · sin tarjeta</span>
          </div>
          <h1
            className="animate-fade-up delay-50"
            style={{
              fontSize: "clamp(40px, 7vw, 64px)",
              lineHeight: 1.04,
              fontWeight: 500,
              letterSpacing: "-0.028em",
              marginBottom: 22,
            }}
          >
            Tu tienda en internet, lista en{" "}
            <span style={{ color: "var(--accent)" }}>dos minutos</span>.
          </h1>
          <p
            className="animate-fade-up delay-100"
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: 520,
              marginBottom: 30,
            }}
          >
            Un link tuyo, productos con foto y un WhatsApp donde caen los pedidos. Cobras a tu
            manera — tarjeta, Yape, contra entrega. Sin comisiones.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up delay-150">
            <Link
              href="/auth/register"
              className="btn-primary"
              style={{ padding: "14px 22px", fontSize: 15 }}
            >
              Crear tienda gratis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth/login"
              className="btn-secondary"
              style={{ padding: "14px 22px", fontSize: 15 }}
            >
              Ya tengo cuenta
              <ChevronRight size={16} />
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4 mt-10 animate-fade-up delay-200">
            <div className="flex">
              {["ML", "CR", "ST", "JV", "RH"].map((n, i) => (
                <div
                  key={n}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    marginLeft: i === 0 ? 0 : -8,
                    width: 32,
                    height: 32,
                    background: i % 2 === 0 ? "var(--ink)" : "var(--surface-2)",
                    color: i % 2 === 0 ? "var(--bg)" : "var(--ink)",
                    fontSize: 11,
                    fontWeight: 500,
                    border: "2px solid var(--bg)",
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium">
                <span className="mono num">2,418</span> emprendedores ya venden
              </p>
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                Perú · Colombia · México · Chile · Argentina
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo strip ── */}
      <section className="px-5 md:px-10 max-w-5xl mx-auto w-full pb-14">
        <div className="card p-5 md:p-7 animate-fade-up delay-200">
          <p className="eyebrow mb-3">Cómo se ve tu link</p>
          <p className="mono mb-5" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>
            qtienda.shop/<span style={{ color: "var(--accent)" }}>tu-nombre</span>
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="placeholder"
                style={{ aspectRatio: "1", borderRadius: 8 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-5 md:px-10 max-w-5xl mx-auto w-full pb-14">
        <p className="eyebrow mb-5">Lo que incluye</p>
        <div className="grid md:grid-cols-2 gap-x-12">
          {FEATURES.map(([n, t, d]) => (
            <div
              key={n}
              className="flex gap-5"
              style={{ padding: "16px 0", borderTop: "1px solid var(--line)" }}
            >
              <span
                className="mono text-xs"
                style={{ color: "var(--ink-3)", width: 22, flexShrink: 0, paddingTop: 2 }}
              >
                {n}
              </span>
              <div>
                <p className="text-base font-medium">{t}</p>
                <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
                  {d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Buyer card ── */}
      <section className="px-5 md:px-10 max-w-5xl mx-auto w-full pb-14">
        <div
          className="card flex flex-col sm:flex-row items-start sm:items-center gap-6"
          style={{
            padding: 24,
            background: "var(--tint)",
            borderColor: "var(--line-2)",
          }}
        >
          <div style={{ flex: 1 }}>
            <p className="eyebrow mb-2">¿Vienes a comprar?</p>
            <p className="text-xl font-medium" style={{ letterSpacing: "-0.014em" }}>
              Todos tus pedidos en un solo lugar
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
              Sigue lo que pediste en cualquier tienda qtienda con un solo correo.
            </p>
          </div>
          <Link href="/mis-pedidos" className="btn-secondary" style={{ padding: "12px 18px", fontSize: 14 }}>
            <Package size={15} />
            Ver mis pedidos
          </Link>
        </div>
      </section>

      {/* ── Stores section (server) ── */}
      <StoresSection />

      {/* ── Footer ── */}
      <footer
        className="px-5 md:px-10 py-6 mt-auto"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="sm" />
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            © 2026 qtienda · Hecho en LatAm
          </p>
        </div>
      </footer>
    </div>
  );
}
