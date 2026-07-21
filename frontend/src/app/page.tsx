// src/app/page.tsx — qtienda v2 (landing pública)
// Reemplaza completo. Mantiene fetch de StoresSection.

import Link from "next/link";
import {
  ArrowRight, ChevronRight, Package, Store, Share2, Wallet,
  MessageCircle, Percent, Truck,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import HomeInstallBanner from "@/components/ui/HomeInstallBanner";

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
    <section className="px-5 md:px-10 py-14 max-w-6xl mx-auto w-full">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="eyebrow">Tiendas activas</p>
          <p className="text-xl font-medium mt-1" style={{ letterSpacing: "-0.014em" }}>
            <span className="mono num">{stores.length.toLocaleString()}</span> tiendas en qtienda
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {stores.map((s) => (
          <Link
            key={s.slug}
            href={`/tienda/${s.slug}`}
            className="card p-4 flex flex-col items-center text-center gap-3 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            {s.logo_url ? (
              <img src={s.logo_url} alt={s.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
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

const STEPS = [
  [Store, "Crea tu tienda", "Nombre, logo y color. Sin tarjeta, sin pasos técnicos — 2 minutos."],
  [Share2, "Sube tus productos y comparte", "Foto, precio y descripción. Tu link qtienda.shop/tu-nombre queda listo para difundir."],
  [MessageCircle, "Recibe pedidos por WhatsApp", "Cada venta cae a tu chat. Cobras por Yape, Plin, transferencia o efectivo."],
] as const;

const FEATURES = [
  [Share2, "Link propio", "qtienda.shop/tu-nombre, listo al crear tu cuenta."],
  [MessageCircle, "WhatsApp directo", "Cada pedido cae a tu chat, sin intermediarios."],
  [Wallet, "Pagos como vendes", "Tarjeta, Yape/Plin, transferencia o efectivo."],
  [Truck, "Envíos sin calculadora", "Costo por zona o gratis sobre cierto monto."],
  [Percent, "Sin comisión", "Cobras todo. El plan free dura para siempre."],
] as const;

const PAYMENT_METHODS = ["Yape", "Plin", "Transferencia", "Efectivo", "Tarjeta"];

export default function LandingPage() {
  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{
        // Resplandor terracota que baja del hero hacia el fondo neutro
        background:
          "radial-gradient(ellipse 90% 38% at 50% 0%, var(--accent-soft) 0%, var(--bg) 55%)",
      }}
    >
      {/* Franja de marca */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }}
      />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between animate-fade-in"
        style={{
          padding: "14px 22px",
          // Superficie propia + sombra: el header no debe fundirse con el fondo
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 14px rgba(20,19,15,.06)",
        }}
      >
        <Logo size="md" variant="brand" />
        <div className="flex items-center gap-2">
          <Link href="/auth/login" className="btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
            Ingresar
          </Link>
          <Link
            href="/auth/register"
            className="btn-primary"
            style={{
              padding: "8px 14px",
              fontSize: 13,
              background: "var(--accent)",
              boxShadow: "0 4px 12px rgba(197,97,59,.3)",
            }}
          >
            Crear tienda
          </Link>
        </div>
      </header>

      <HomeInstallBanner />

      {/* ── Hero ── */}
      <section className="px-5 md:px-10 pt-14 md:pt-20 pb-10 max-w-6xl mx-auto w-full lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:items-center">
        <div className="md:max-w-3xl lg:max-w-none">
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
              style={{
                padding: "14px 22px",
                fontSize: 15,
                background: "var(--accent)",
                boxShadow: "0 6px 18px rgba(197,97,59,.35)",
              }}
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

          {/* Métodos de pago */}
          <div className="flex flex-wrap items-center gap-2 mt-8 animate-fade-up delay-150">
            <span className="eyebrow mr-1">Cobra con</span>
            {PAYMENT_METHODS.map((m) => (
              <span key={m} className="chip chip-outline">{m}</span>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-4 mt-8 animate-fade-up delay-200">
            <div className="flex">
              {["ML", "CR", "ST", "JV", "RH"].map((n, i) => (
                <div
                  key={n}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    marginLeft: i === 0 ? 0 : -8,
                    width: 32,
                    height: 32,
                    background: i % 2 === 0 ? "var(--accent)" : "var(--accent-soft)",
                    color: i % 2 === 0 ? "#fff" : "var(--accent-ink)",
                    fontSize: 11,
                    fontWeight: 600,
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

        {/* Vitrina de ejemplo (solo desktop) */}
        <div className="hidden lg:block animate-fade-up delay-200">
          <div className="card p-5" style={{ borderRadius: 24, boxShadow: "var(--shadow-lg)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14 }}
              >
                M
              </div>
              <div style={{ flex: 1 }}>
                <div className="placeholder" style={{ height: 9, width: "55%", borderRadius: 4, marginBottom: 6 }} />
                <div className="placeholder" style={{ height: 7, width: "35%", borderRadius: 4 }} />
              </div>
              <span className="badge badge-success">Abierto</span>
            </div>
            <div style={{ height: 110, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
              <img src="/placeholders/banner-promo.svg" alt="Banner promocional de ejemplo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {["Torta", "Brownie", "Cupcake", "Alfajor", "Cheesecake", "Galletas"].map((name, i) => (
                <div key={name}>
                  <div style={{ aspectRatio: "1", borderRadius: 10, marginBottom: 6, overflow: "hidden" }}>
                    <img src="/placeholders/product-photo.svg" alt={`Foto de ${name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <p className="text-[9px] font-medium truncate" style={{ color: "var(--ink-2)" }}>{name}</p>
                  <p className="mono" style={{ fontSize: 9, color: "var(--accent-ink)", fontWeight: 600 }}>S/ {12 + i * 3}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <p className="eyebrow mb-5">Cómo funciona</p>
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map(([Icon, t, d], i) => (
            <div key={t} className="card p-6" style={{ borderRadius: 20 }}>
              <div className="flex items-center justify-between mb-5">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                >
                  <Icon size={19} strokeWidth={1.7} />
                </div>
                <span className="mono text-xs" style={{ color: "var(--ink-4)" }}>0{i + 1}</span>
              </div>
              <p className="text-base font-medium mb-1.5">{t}</p>
              <p className="text-sm" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo strip ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <div className="card p-5 md:p-7 animate-fade-up delay-200">
          <p className="eyebrow mb-3">Cómo se ve tu link</p>
          <p className="mono mb-5" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>
            qtienda.shop/<span style={{ color: "var(--accent)" }}>tu-nombre</span>
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
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
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <p className="eyebrow mb-5">Lo que incluye</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(([Icon, t, d]) => (
            <div
              key={t}
              className="flex flex-col gap-3 p-5"
              style={{ border: "1px solid var(--line)", borderRadius: 16 }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 34, height: 34, background: "var(--accent-soft)", color: "var(--accent-ink)" }}
              >
                <Icon size={16} strokeWidth={1.7} />
              </div>
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
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
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

      {/* ── CTA final ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-16">
        <div
          className="flex flex-col items-center text-center gap-4 py-14 px-6 relative overflow-hidden"
          style={{
            // Mismo degradado cálido del panel de login: coherencia de marca
            background: "linear-gradient(160deg, var(--ink) 0%, var(--accent-ink) 100%)",
            color: "var(--bg)",
            borderRadius: 24,
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 80% 15%, rgba(197,97,59,.4) 0%, transparent 70%)",
            }}
          />
          <p className="relative text-2xl md:text-3xl font-medium" style={{ letterSpacing: "-0.018em" }}>
            Tu vitrina profesional, lista hoy.
          </p>
          <p className="relative text-sm max-w-md" style={{ color: "rgba(255,255,255,.65)" }}>
            Sin tarjeta, sin comisiones, sin curva de aprendizaje.
          </p>
          <Link
            href="/auth/register"
            className="relative inline-flex items-center gap-2 rounded-full font-bold mt-2"
            style={{
              padding: "14px 24px",
              fontSize: 15,
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(0,0,0,.3)",
            }}
          >
            Crear tienda gratis
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-5 md:px-10 py-8 mt-auto"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" variant="brand" />
          <div className="flex items-center gap-5 text-xs" style={{ color: "var(--ink-3)" }}>
            <Link href="/auth/login" className="hover:underline">Ingresar</Link>
            <Link href="/auth/register" className="hover:underline">Crear tienda</Link>
            <Link href="/mis-pedidos" className="hover:underline">Mis pedidos</Link>
          </div>
          <div className="flex flex-col sm:items-end items-center gap-1.5">
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              © 2026 qtienda · Hecho en LatAm
            </p>
            <a
              href="https://qsdsoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
            >
              <span className="text-[10px]" style={{ color: "var(--ink-4)" }}>
                Un producto de
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_qsd_soft.png" alt="QSD Soft" style={{ height: 16, width: "auto" }} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
