// src/app/page.tsx — qtienda v2 (landing pública)

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronRight, Package, Store, Share2, Wallet,
  MessageCircle, Percent, Truck, ShoppingBag,
  Heart, Ticket, Sparkles, Star, RotateCcw, Zap, Link2, Bell,
  Award, FileCheck,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import HomeInstallBanner from "@/components/ui/HomeInstallBanner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

interface StoreCard {
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  primary_color: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  PE: "Perú", CL: "Chile", CO: "Colombia", MX: "México", AR: "Argentina",
};

// Canonical explícito — refuerzo además del redirect www→apex de nginx,
// para que Google nunca tenga ambigüedad sobre cuál es "la" home.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

async function getStores(): Promise<StoreCard[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
    const res = await fetch(`${apiUrl}/public/stores?limit=24`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** Prueba social del hero — solo negocios reales, nunca un conteo inventado.
    Sin números a propósito mientras la plataforma sigue creciendo: mejor
    apoyarse en nombres y caras reales que en una cifra que todavía es chica.
    Tampoco repite el link a Mall qtienda — ya está el botón morado arriba. */
async function HeroSocialProof() {
  const stores = await getStores();
  if (!stores.length) return null;

  // Más logos que antes (8 en vez de 5) porque ahora tienen toda la franja
  // para ellos solos, no medio ancho compitiendo con el texto al lado.
  const preview = stores.slice(0, 8);
  const countries = Array.from(
    new Set(stores.map((s) => s.country).filter((c): c is string => !!c))
  );
  const countryLabel = countries.map((c) => COUNTRY_NAMES[c] ?? c).join(" · ");

  return (
    <div
      className="mt-8 animate-fade-up delay-200 rounded-2xl"
      style={{ padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
    >
      {/* Logos reales, sueltos y del tamaño real de la franja — antes era
          un racimo apretado de 5 avatares chicos al costado del texto. */}
      <div className="flex flex-wrap items-center gap-2.5">
        {preview.map((s) => (
          <div
            key={s.slug}
            className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
            style={{
              width: 38,
              height: 38,
              background: "var(--accent-soft)",
              color: "var(--accent-ink)",
              fontSize: 13,
              fontWeight: 700,
            }}
            title={s.name}
          >
            {s.logo_url ? (
              <img src={s.logo_url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              s.name.charAt(0).toUpperCase()
            )}
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold mt-3" style={{ color: "var(--ink)" }}>Compra directamente a emprendedores.</p>
      {countryLabel && (
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
          {countryLabel}
        </p>
      )}
    </div>
  );
}

const STEPS = [
  [Store, "Crea tu tienda en 2 minutos", "Nombre, logo y color. Sin tarjeta, sin pasos técnicos — 2 minutos."],
  [Share2, "Publica tus productos y comparte", "Foto, precio y descripción. Tu link tu-nombre.qtienda.shop queda listo para difundir — tu propia web."],
  [MessageCircle, "Empieza a vender por WhatsApp", "Cada venta cae a tu chat. Cobras por Yape, Plin, transferencia o efectivo."],
  [Heart, "Aparece en el Mall QTienda", "Gana visibilidad adicional para atraer nuevos clientes."],

] as const;


const FEATURES = [
  [Share2, "Tu propia web", "tu-nombre.qtienda.shop — tu link, tu marca, no una página adentro de otra."],
  [MessageCircle, "WhatsApp directo", "Cada pedido cae a tu chat, sin intermediarios."],
  [Wallet, "Pagos como vendes", "Tarjeta, Yape/Plin, transferencia o efectivo."],
  [Award, "Fidelización con sellos", "Tus clientes acumulan sellos y vuelven por su premio — sin apps ni tarjetas."],
  [FileCheck, "Libro de reclamaciones", "Cumple con Indecopi desde tu propia tienda, sin herramientas sueltas."],
  [Ticket, "Cupones de descuento", "Crea códigos como \"TIKTOK20\" para tus lives y campañas."],
  [Sparkles, "Ruleta de premios", "Sorprende a quien entra por primera vez con un descuento sorpresa."],
  [Truck, "Envío o recojo en tienda", "Vos decides cómo entregas — el comprador elige al pagar."],
  [Star, "Reseñas con fotos", "Tus compradores dejan reseñas verificadas, con foto incluida."],
  [RotateCcw, "Recuperas carritos abandonados", "Si alguien casi compra y se fue, te avisamos para que lo contactes."],
  [Percent, "Sin comisión", "Cobras todo. El plan free dura para siempre."],
] as const;

const PAYMENT_METHODS = ["Yape", "Plin", "Transferencia", "Efectivo", "Tarjeta"];
const CATEGORIES = [
  ["Moda", "var(--danger-soft)", "var(--danger)"],
  ["Belleza", "var(--progress-soft)", "var(--progress)"],
  ["Hogar", "var(--info-soft)", "var(--info)"],
  ["Comida", "var(--warn-soft)", "var(--warn)"],
  ["Accesorios", "var(--success-soft)", "var(--success)"],
] as const;
const FACTS = [
  [Percent, "0%", "de comisión, en todos los planes"],
  [Zap, "2 min", "para tener tu tienda lista"],
  [Link2, "100%", "tuyo — link propio"],
] as const;
const DEMO_PRODUCTS = [
  { name: "Torta de chocolate", emoji: "🎂", bg: "#FBE7D6", price: 35, was: 50, sold: 7 },
  { name: "Brownie x6", emoji: "🍫", bg: "#E7DCEF", price: 16, was: 20, sold: 12 },
  { name: "Cupcake decorado", emoji: "🧁", bg: "#FDE8EE", price: 10, was: 15, sold: 24 },
  { name: "Kit de alfajores", emoji: "🍪", bg: "#EFE6D8", price: 22, was: 28, sold: 9 },
] as const;

const FAQS = [
  ["¿De verdad es gratis para siempre?", "Sí. El plan Free no vence, no pide tarjeta y no cobra comisión por venta, nunca. Incluye hasta 10 productos — si necesitas más, subes a Pro (S/ 29/mes) o Elite (S/ 59/mes) cuando tú decidas."],
  ["¿Cómo recibo el dinero de mis ventas?", "Directo a tu cuenta: aceptas Yape, Plin, transferencia, efectivo o tarjeta. El dinero llega a ti, no pasa por una billetera intermedia."],
  ["¿Puedo pasar mi catálogo desde Instagram u otra plataforma?", "Sí, puedes cargar tus productos con foto, precio y descripción en minutos desde el celular — sin migración técnica."],
  ["¿Qué pasa si mi tienda crece mucho?", "El plan Free cubre hasta 10 productos sin costo ni fecha de vencimiento. Cuando tu catálogo o tus ventas crecen, Pro y Elite suman más productos y funciones — la comisión de 0% se mantiene en todos los planes."],
  ["¿Necesito saber de programación o diseño?", "No. Eliges nombre, logo y color, y tu tienda queda lista — la parte técnica la resolvemos nosotros."],
] as const;

export default function LandingPage() {
  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{
        // Resplandor cálido más vivo: dos focos de luz en vez de uno solo tenue
        background:
          "radial-gradient(ellipse 70% 45% at 15% 0%, var(--accent-soft) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 90% 10%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 65%), var(--bg)",
      }}
    >
      <PageViewTracker path="/" />
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
              background: "linear-gradient(120deg, var(--accent), var(--accent-soft))",
              boxShadow: "0 4px 14px rgba(197,97,59,.4)",
            }}
          >
            Crea tu tienda gratis
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
              fontSize: "clamp(42px, 7.5vw, 72px)",
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 20,
            }}
          >
            Vende hoy mismo,{" "}
            <span style={{ color: "var(--accent)" }}>sin pagar nada</span>.
          </h1>
          <p
            className="animate-fade-up delay-100"
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              maxWidth: 500,
              marginBottom: 30,
            }}
          >
            Crea tu tienda desde el celular en 2 minutos y comparte tu link en TikTok, Instagram o WhatsApp. <strong style={{ color: "var(--ink)" }}>Cada pedido cae directo a tu chat — cobras el 100%, para siempre.</strong>
          </p>

          {/* Mismo morado del botón del footer — el Mall tiene su propia
              identidad de color en toda la página, distinta del naranja de
              "crear tienda", para que se lea como una segunda opción real
              y no como un link secundario perdido en el texto. */}
          <Link
            href="/tiendas"
            className="inline-flex items-center gap-2 mb-7 animate-fade-up delay-100 transition-transform active:scale-95 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(120deg, #7C3AED, #A78BFA)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 18px",
              borderRadius: 999,
              boxShadow: "0 4px 16px rgba(124,58,237,.35)",
            }}
          >
            <ShoppingBag size={15} />
            Ingresa gratis a Mall Qtienda
            <ArrowRight size={14} />
          </Link>

          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up delay-150">
            <Link
              href="/auth/register"
              className="btn-primary"
              style={{
                padding: "14px 22px",
                fontSize: 15,
                background: "linear-gradient(160deg, var(--ink) 0%, var(--accent-ink) 100%)",
                boxShadow: "0 8px 22px rgba(20,19,15,.35)",
              }}
            >
              Crea tu tienda gratis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/auth/login"
              className="btn-secondary"
              style={{ padding: "14px 22px", fontSize: 15, border: "1.5px solid var(--ink)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
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

          {/* Categorías — coloreadas para dar variedad de "marketplace", no un solo tono plano */}
          <div className="flex flex-wrap items-center gap-2 mt-3 animate-fade-up delay-150">
            <span className="eyebrow mr-1">Para vender</span>
            {CATEGORIES.map(([name, bg, fg]) => (
              <span key={name} className="chip" style={{ background: bg, color: fg, fontWeight: 600 }}>{name}</span>
            ))}
          </div>

          {/* Social proof — tiendas reales, no un conteo inventado. En Suspense
              para que dos llamadas a la API no dejen la landing entera en
              blanco mientras cargan — el resto de la página ya se ve. */}
          <Suspense fallback={null}>
            <HeroSocialProof />
          </Suspense>
        </div>

        {/* Vitrina de ejemplo (solo desktop) — dentro de un marco de navegador
            para que se lea como una web real, con nav y carrito, no una tarjeta suelta */}
        <div className="hidden lg:block animate-fade-up delay-200">
          <div className="card overflow-hidden relative" style={{ borderRadius: 24, boxShadow: "var(--shadow-lg)" }}>
            <span aria-hidden className="absolute top-0 left-0 right-0" style={{ height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }} />
            <div className="p-5 pt-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 38, height: 38, borderRadius: 12, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 17 }}
                >
                  🧁
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>Dulces de Mica</p>
                  <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>Lima · <span style={{ color: "var(--success)" }}>● Abierto</span> · hasta 21:00</p>
                </div>
                {[Bell, Share2, Heart].map((Icon, i) => (
                  <span key={i} className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
                    <Icon size={13} />
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 px-3 mb-3" style={{ height: 38, borderRadius: 999, border: "1.5px solid var(--line-2)", color: "var(--ink-4)" }}>
                <span className="text-xs">Buscar en la tienda…</span>
              </div>
              <div className="flex items-center gap-3 mb-4 text-[10px]" style={{ color: "var(--ink-3)" }}>
                <span className="flex items-center gap-1"><Truck size={11} /> Entrega hoy</span>
                <span className="flex items-center gap-1"><Package size={11} /> Recojo en tienda</span>
                <span className="flex items-center gap-1"><Wallet size={11} /> Pago seguro</span>
              </div>

              <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {["Todo", "Tortas", "Postres", "Ofertas"].map((t, i) => (
                  <span key={t} className={"chip flex-shrink-0" + (i === 0 ? "" : " chip-outline")} style={i === 0 ? { background: "var(--ink)", color: "var(--bg)" } : {}}>{t}</span>
                ))}
              </div>

              <div
                className="flex items-center justify-between px-4"
                style={{
                  height: 100, borderRadius: 14, marginBottom: 14,
                  background: "linear-gradient(120deg, var(--accent), #E8A87C)",
                }}
              >
                <div>
                  <p className="text-white font-extrabold text-base leading-tight">🎉 20% OFF hoy</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.85)" }}>En pedidos desde S/ 40</p>
                </div>
                <span style={{ fontSize: 38 }}>🎂</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {DEMO_PRODUCTS.slice(0, 3).map(({ name, emoji, bg, price, was, sold }) => (
                  <div key={name} className="flex items-center gap-3 p-2.5" style={{ border: "1px solid var(--line)", borderRadius: 12 }}>
                    <div className="flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, borderRadius: 10, background: bg, fontSize: 22 }}>{emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-xs font-semibold truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="mono font-bold" style={{ fontSize: 12, color: "var(--ink)" }}>S/ {price}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)", textDecoration: "line-through" }}>S/ {was}</span>
                        <span className="badge badge-danger" style={{ height: 16, fontSize: 9 }}>-{Math.round((1 - price / was) * 100)}%</span>
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: "var(--ink-4)" }}>🔥 {sold} vendidos</p>
                    </div>
                    <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 26, height: 26, background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700 }}>+</span>
                  </div>
                ))}
              </div>
            </div>

            <span
              className="absolute flex items-center justify-center rounded-full"
              style={{ bottom: 16, right: 16, width: 40, height: 40, background: "#25D366", color: "#fff", boxShadow: "0 6px 16px rgba(0,0,0,.2)" }}
            >
              <MessageCircle size={18} fill="#fff" />
            </span>
          </div>
        </div>
      </section>

      {/* ── Franja de hechos — degradado + íconos, más presencia que un bloque plano ── */}
      <section
        className="px-5 md:px-10 py-9"
        style={{ background: "linear-gradient(105deg, var(--ink) 0%, var(--accent-ink) 100%)", color: "var(--bg)" }}
      >
        <div className="max-w-6xl mx-auto w-full grid grid-cols-3 gap-4 md:gap-10">
          {FACTS.map(([Icon, n, d]) => (
            <div key={d} className="flex items-center gap-3">
              <div
                className="hidden sm:flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 40, height: 40, background: "rgba(255,255,255,.12)", color: "var(--accent)" }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="mono num" style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, color: "#fff" }}>{n}</p>
                <p className="text-xs md:text-sm mt-0.5" style={{ color: "rgba(255,255,255,.75)" }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <p className="section-label mb-2">Cómo funciona</p>
        <p className="text-xl font-bold mb-5" style={{ letterSpacing: "-0.02em" }}>De cero a tu primera venta, en 4 pasos</p>
        <div className="grid md:grid-cols-4 gap-4">
          {STEPS.map(([Icon, t, d], i) => (
            <div key={t} className="card p-6 transition-all duration-200 hover:-translate-y-1" style={{ borderRadius: 20 }}>
              <div className="flex items-center justify-between mb-5">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                >
                  <Icon size={19} strokeWidth={1.7} />
                </div>
                <span className="mono text-xs" style={{ color: "var(--ink-4)" }}>0{i + 1}</span>
              </div>
              <p className="text-base font-semibold mb-1.5">{t}</p>
              <p className="text-sm" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── Demo strip — navegador real con productos con forma de producto, no rayas grises ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <p className="section-label mb-2">Así se ve tu tienda</p>
        <p className="text-xl font-bold mb-5" style={{ letterSpacing: "-0.02em" }}>Tu propio link, tu propia web</p>
        <div className="card overflow-hidden animate-fade-up delay-200" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--danger)" }} />
            <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--warn)" }} />
            <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--success)" }} />
            <span className="mono ml-3" style={{ fontSize: 13, color: "var(--ink-2)" }}>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>tu-nombre</span>.qtienda.shop
            </span>
          </div>
          <div className="p-5 md:p-7">
            {/* Barra de búsqueda + categorías, como en cualquier tienda real */}
            <div className="flex items-center gap-2 px-4 mb-4" style={{ height: 42, borderRadius: 999, border: "1.5px solid var(--line-2)", color: "var(--ink-3)" }}>
              <span className="text-sm">Buscar en la tienda…</span>
            </div>
            <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-hide">
              {["Todo", ...CATEGORIES.map((c) => c[0])].map((t, i) => (
                <span key={t} className="chip flex-shrink-0" style={i === 0 ? { background: "var(--ink)", color: "var(--bg)" } : {}}>{t}</span>
              ))}
            </div>
            {/* Lista de productos con precio tachado + descuento + vendidos, como una tienda real */}
            <div className="flex flex-col gap-3">
              {DEMO_PRODUCTS.slice(0, 4).map(({ name, emoji, bg, price, was, sold }) => (
                <div key={name} className="flex items-center gap-3 p-3" style={{ border: "1px solid var(--line)", borderRadius: 14 }}>
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56, borderRadius: 12, background: bg, fontSize: 26 }}>{emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="mono font-bold" style={{ fontSize: 14, color: "var(--ink)" }}>S/ {price}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-4)", textDecoration: "line-through" }}>S/ {was}</span>
                      <span className="badge badge-danger">-{Math.round((1 - price / was) * 100)}%</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>🔥 {sold} vendidos</p>
                  </div>
                  <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, background: "var(--accent)", color: "#fff", fontSize: 18, fontWeight: 700 }}>+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <p className="section-label mb-2">Lo que incluye</p>
        <p className="text-xl font-bold mb-5" style={{ letterSpacing: "-0.02em" }}>Todo lo que necesitas para vender, ya integrado</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(([Icon, t, d]) => (
            <div
              key={t}
              className="flex flex-col gap-3 p-5 transition-all duration-200 hover:shadow-md"
              style={{ border: "1px solid var(--line)", borderRadius: 16, background: "var(--surface)" }}
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

      {/* ── Ahorro cuantificado — sin nombrar competencia, con números concretos ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <div className="card flex flex-col sm:flex-row items-start sm:items-center gap-6" style={{ padding: 28, borderRadius: 20 }}>
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>Ahorra hasta S/ 900 al año</p>
            <p className="text-sm mt-1.5" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
              Otras plataformas cobran desde S/ 30 hasta S/ 80 al mes por tener tu tienda online. Con qtienda, ese dinero se queda en tu bolsillo — para siempre, sin letra chica.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-5 md:px-10 max-w-6xl mx-auto w-full pb-14">
        <p className="section-label mb-2">Preguntas frecuentes</p>
        <p className="text-xl font-bold mb-5" style={{ letterSpacing: "-0.02em" }}>¿Algo no te queda claro?</p>
        <div className="flex flex-col gap-3">
          {FAQS.map(([q, a]) => (
            <details key={q} className="card group" style={{ borderRadius: 14, padding: 0 }}>
              <summary className="flex items-center justify-between gap-4 p-4 cursor-pointer list-none" style={{ fontSize: 15, fontWeight: 600 }}>
                {q}
                <ChevronRight size={16} className="transition-transform group-open:rotate-90" style={{ color: "var(--ink-3)", flexShrink: 0 }} />
              </summary>
              <p className="px-4 pb-4 text-sm" style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>{a}</p>
            </details>
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
            Crea tu tienda gratis
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
          <div className="flex items-center gap-4">
            <Logo size="sm" variant="brand" />
            {/* Único acceso vistoso al Mall en todo el footer — el resto
                son links de texto planos a propósito, este es el que
                queremos que se note. */}
            <Link
              href="/tiendas"
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full text-white transition-transform active:scale-95 animate-glow-pulse"
              style={{ background: "linear-gradient(120deg, #7C3AED, #A78BFA)" }}
            >
              <ShoppingBag size={13} />
              Mall Qtienda
            </Link>
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: "var(--ink-3)" }}>
            <Link href="/auth/login" className="hover:underline">Ingresar</Link>
            <Link href="/auth/register" className="hover:underline">Crear tienda</Link>
            <Link href="/mis-pedidos" className="hover:underline">Mis pedidos</Link>
            <Link href="/terminos" className="hover:underline">Términos</Link>
            <Link href="/privacidad" className="hover:underline">Privacidad</Link>
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
