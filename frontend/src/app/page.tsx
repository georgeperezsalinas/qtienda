import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Store, MessageCircle, Zap, Star, ShoppingBag, Package, ChevronRight } from "lucide-react";
import Logo from "@/components/ui/Logo";

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
    <section className="py-12 px-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-xl" style={{ color: "var(--ink)" }}>
            Tiendas activas
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-3)" }}>
            {stores.length} tiendas en qtienda
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {stores.map((store) => (
          <Link
            key={store.slug}
            href={`/tienda/${store.slug}`}
            className="group card p-4 flex flex-col items-center text-center gap-3 hover:shadow-md transition-all active:scale-95"
          >
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-14 h-14 rounded-2xl object-cover" />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                style={{ background: store.primary_color }}
              >
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display font-bold text-xs leading-tight" style={{ color: "var(--ink)" }}>
                {store.name}
              </p>
              {store.city && (
                <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>{store.city}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Store,
    title: "Tienda propia",
    desc: "Link único listo en segundos",
    gradient: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
    color: "#2563EB",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp directo",
    desc: "Pedidos llegan a tu celular",
    gradient: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
    color: "#059669",
  },
  {
    icon: Zap,
    title: "Sin comisiones",
    desc: "100% de tus ganancias",
    gradient: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
    color: "#D97706",
  },
];

const AVATARS = [
  { initials: "ML", bg: "linear-gradient(135deg,#FCE7F3,#FBCFE8)", color: "#9D174D" },
  { initials: "CR", bg: "linear-gradient(135deg,#DBEAFE,#BFDBFE)", color: "#1E40AF" },
  { initials: "ST", bg: "linear-gradient(135deg,#EDE9FE,#DDD6FE)", color: "#5B21B6" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 px-5 py-3.5 flex items-center justify-between animate-fade-in"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(226,232,240,0.6)",
        }}
      >
        <Logo size="md" />
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{ color: "var(--ink-2)" }}
          >
            Ingresar
          </Link>
          <Link
            href="/auth/register"
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all text-white"
            style={{
              background: "var(--brand-600)",
              boxShadow: "0 2px 8px rgba(37,99,235,.35)",
            }}
          >
            Crear tienda
          </Link>
        </div>
      </header>

      {/* ══ HERO ══════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0F172A 0%, #1E3A8A 50%, #312E81 100%)",
          minHeight: "min(600px, 80vw)",
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(99,102,241,.25) 0%, transparent 70%)," +
              "radial-gradient(ellipse 40% 40% at 10% 80%, rgba(37,99,235,.2) 0%, transparent 60%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative px-5 pt-16 pb-14 max-w-5xl mx-auto">
          <div className="max-w-xl">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 animate-fade-up"
              style={{
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.15)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#4ADE80" }}
              />
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,.85)" }}>
                Gratis para siempre · Sin tarjeta
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-display font-extrabold leading-[1.08] mb-5 animate-fade-up delay-50"
              style={{
                fontSize: "clamp(34px, 8vw, 56px)",
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              Tu tienda en Redes Sociales{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #93C5FD, #C4B5FD)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                en 2 minutos
              </span>
            </h1>

            <p
              className="text-base leading-relaxed mb-8 animate-fade-up delay-100"
              style={{ color: "rgba(255,255,255,.65)", maxWidth: "38ch" }}
            >
              Crea tu link personalizado, publícalo en TikTok y recibe pedidos
              directo a tu WhatsApp. Sin comisiones.
            </p>

            {/* Social proof */}
            <div className="flex items-center gap-4 mb-8 animate-fade-up delay-150">
              <div className="flex -space-x-2.5">
                {AVATARS.map((a) => (
                  <div
                    key={a.initials}
                    className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: a.bg,
                      color: a.color,
                      borderColor: "rgba(255,255,255,.2)",
                    }}
                  >
                    {a.initials}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>
                  +2,400 vendedores activos
                </p>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 animate-fade-up delay-200">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl
                           text-sm font-bold text-white transition-all active:scale-[.97]"
                style={{
                  background: "var(--brand-600)",
                  boxShadow: "0 4px 20px rgba(37,99,235,.5)",
                }}
              >
                <Store size={17} />
                Crear tienda gratis
                <ArrowRight size={17} />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl
                           text-sm font-semibold transition-all active:scale-[.97]"
                style={{
                  background: "rgba(255,255,255,.08)",
                  color: "rgba(255,255,255,.85)",
                  border: "1.5px solid rgba(255,255,255,.12)",
                }}
              >
                Ya tengo cuenta
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════ */}
      <section className="px-5 py-10 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-3 animate-fade-up delay-250">
          {FEATURES.map(({ icon: Icon, title, desc, gradient, color }) => (
            <div
              key={title}
              className="card p-4 flex flex-col items-center text-center gap-3"
              style={{ borderRadius: "20px" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: gradient }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                  {title}
                </p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--ink-3)" }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ SEPARATOR ════════════════════════════════════ */}
      <div className="flex items-center gap-4 px-5 animate-fade-up delay-300 max-w-5xl mx-auto w-full">
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #E2E8F0)" }} />
        <span
          className="text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full"
          style={{
            color: "var(--ink-4)",
            background: "var(--surface-0)",
            border: "1.5px solid #E2E8F0",
          }}
        >
          ¿vienes a comprar?
        </span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #E2E8F0, transparent)" }} />
      </div>

      {/* ══ BUYER SECTION ════════════════════════════════ */}
      <section className="px-5 pt-8 pb-10 max-w-5xl mx-auto w-full animate-fade-up delay-300">
        <div
          className="rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6"
          style={{
            background: "linear-gradient(135deg, #FAF5FF, #F5F3FF)",
            border: "1.5px solid #DDD6FE",
            boxShadow: "0 4px 24px rgba(124,58,237,.08)",
          }}
        >
          <div className="flex-1">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}
            >
              <ShoppingBag size={22} color="white" />
            </div>
            <h2
              className="font-display font-extrabold text-xl mb-2"
              style={{ color: "#3B0764" }}
            >
              Para compradores
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#6D28D9" }}>
              Sigue todos tus pedidos en un solo lugar,
              sin importar en qué tienda compraste.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full sm:w-auto sm:min-w-[200px]">
            <Link
              href="/mis-pedidos"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl
                         text-sm font-bold text-white transition-all active:scale-[.97]"
              style={{
                background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                boxShadow: "0 4px 16px rgba(124,58,237,.35)",
              }}
            >
              <Package size={16} />
              Ver mis pedidos
            </Link>
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl
                         text-sm font-semibold transition-all active:scale-[.97]"
              style={{
                background: "rgba(124,58,237,.08)",
                color: "#7C3AED",
                border: "1.5px solid rgba(124,58,237,.2)",
              }}
            >
              Crear cuenta de comprador
            </Link>
          </div>
        </div>
      </section>

      {/* ══ DEMO STRIP ════════════════════════════════════ */}
      <section className="px-5 pb-10 max-w-5xl mx-auto w-full">
        <div
          className="rounded-3xl p-6 sm:p-8 animate-fade-up delay-350 overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, var(--brand-800) 0%, #312E81 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 70% 50%, rgba(99,102,241,1) 0%, transparent 60%)",
            }}
          />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <p
                className="text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,.45)" }}
              >
                Ejemplo de tienda
              </p>
              <p className="font-display font-extrabold text-xl text-white mb-1">
                qtienda.shop/<span style={{ color: "#93C5FD" }}>juanamoda</span>
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
                Ropa femenina · Lima, Perú
              </p>
            </div>
            <div className="flex gap-2">
              {["👗", "👜", "👟", "💄"].map((e) => (
                <div
                  key={e}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.08)" }}
                >
                  {e}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <StoresSection />

      <footer className="px-5 py-6 text-center pb-safe" style={{ borderTop: "1px solid #F1F5F9" }}>
        <div className="flex items-center justify-center mb-3 opacity-40">
          <Logo size="sm" href="" />
        </div>
        <p className="text-xs" style={{ color: "var(--ink-4)" }}>
          © 2025 qtienda.shop · Hecho con ❤️ en Perú
        </p>
      </footer>
    </div>
  );
}
