import Link from "next/link";
import { ArrowRight, Store, MessageCircle, Zap, Star, ChevronRight } from "lucide-react";

/* ── Types ── */
interface StoreCard {
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  primary_color: string;
}

/* ── Store directory section (server-side fetch) ── */
async function getStores(): Promise<StoreCard[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000/api/v1";
    const res = await fetch(`${apiUrl}/public/stores`, {
      next: { revalidate: 60 },
    });
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
    <div className="mt-10 animate-fade-up delay-500">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="font-display font-bold text-base"
          style={{ color: "var(--ink)" }}
        >
          Descubre tiendas
        </h2>
        <span className="text-xs" style={{ color: "var(--ink-4)" }}>
          {stores.length} tiendas
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
        {stores.map((store) => (
          <Link
            key={store.slug}
            href={`/tienda/${store.slug}`}
            className="flex-shrink-0 card p-3 flex flex-col items-center text-center gap-2 w-28 active:scale-95 transition-transform"
            style={{ minWidth: "7rem" }}
          >
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: store.primary_color }}
              >
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p
                className="font-display font-bold text-xs leading-tight"
                style={{ color: "var(--ink)" }}
              >
                {store.name}
              </p>
              {store.city && (
                <p
                  className="text-[10px] mt-0.5"
                  style={{ color: "var(--ink-4)" }}
                >
                  {store.city}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Static data ── */
const FEATURES = [
  {
    icon: Store,
    title: "Tienda propia",
    desc: "Tu link único listo en segundos",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp directo",
    desc: "Pedidos llegan a tu celular",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Zap,
    title: "Sin comisiones",
    desc: "100% de tus ganancias",
    color: "bg-amber-50 text-amber-600",
  },
];

const SOCIAL_PROOF = [
  { name: "María L.", handle: "@marialooks", avatar: "ML", color: "bg-pink-100 text-pink-700" },
  { name: "Carlos R.", handle: "@cr_shop", avatar: "CR", color: "bg-blue-100 text-blue-700" },
  { name: "Sofía T.", handle: "@sofiatrends", avatar: "ST", color: "bg-violet-100 text-violet-700" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[--surface-2] flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="px-5 py-4 flex items-center justify-between animate-fade-in">
        <span
          className="font-display font-extrabold text-xl tracking-tight"
          style={{ color: "var(--brand-600)" }}
        >
          q<span style={{ color: "var(--ink)" }}>tienda</span>
        </span>
        <Link
          href="/auth/login"
          className="text-sm font-semibold flex items-center gap-1 transition-colors"
          style={{ color: "var(--ink-2)" }}
        >
          Ingresar <ChevronRight size={14} />
        </Link>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col px-5 pt-6 pb-10 max-w-lg mx-auto w-full">

        {/* Badge */}
        <div className="animate-fade-up">
          <span className="badge badge-brand mb-5 inline-flex">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: "var(--brand-500)" }}
            />
            Gratis para siempre · Sin tarjeta
          </span>
        </div>

        {/* Title */}
        <h1
          className="font-display font-extrabold leading-[1.1] mb-4 animate-fade-up delay-100"
          style={{ fontSize: "clamp(32px, 8vw, 44px)", color: "var(--ink)" }}
        >
          Tu tienda en TikTok{" "}
          <span className="text-gradient">en 2 minutos</span>
        </h1>

        <p
          className="text-base leading-relaxed mb-8 animate-fade-up delay-150"
          style={{ color: "var(--ink-2)", maxWidth: "34ch" }}
        >
          Crea tu link personalizado, publícalo en TikTok y recibe pedidos
          directo a tu WhatsApp. Sin complicaciones.
        </p>

        {/* CTA buttons — vendedor */}
        <div className="flex flex-col gap-3 mb-5 animate-fade-up delay-200">
          <Link href="/auth/register" className="btn-primary text-base">
            Crear tienda gratis
            <ArrowRight size={18} />
          </Link>
          <Link href="/auth/login" className="btn-secondary text-base">
            Ya tengo cuenta (vendedor)
          </Link>
        </div>

        {/* Divider comprador */}
        <div className="flex items-center gap-3 mb-5 animate-fade-up delay-250">
          <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
          <span className="text-xs font-medium" style={{ color: "var(--ink-4)" }}>
            ¿Quieres comprar?
          </span>
          <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
        </div>

        {/* CTA buttons — comprador */}
        <div className="flex flex-col gap-3 mb-10 animate-fade-up delay-300">
          <Link
            href="/registro"
            className="btn-secondary text-base flex items-center justify-center gap-2"
          >
            Crear cuenta de comprador
          </Link>
          <Link
            href="/mis-pedidos"
            className="text-sm font-semibold text-center transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            Ver mis pedidos →
          </Link>
        </div>

        {/* Social proof avatars */}
        <div className="flex items-center gap-3 mb-10 animate-fade-up delay-400">
          <div className="flex -space-x-2">
            {SOCIAL_PROOF.map((u) => (
              <div
                key={u.handle}
                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${u.color}`}
                title={u.name}
              >
                {u.avatar}
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              +2,400 vendedores activos
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-3 animate-fade-up delay-300">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="card p-3 flex flex-col items-center text-center gap-2"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="font-display font-bold text-xs" style={{ color: "var(--ink)" }}>
                  {title}
                </p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--ink-3)" }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Demo store strip */}
        <div
          className="mt-8 rounded-2xl p-4 border animate-fade-up delay-400"
          style={{
            background: "linear-gradient(135deg, var(--brand-800), #4C1D95)",
            borderColor: "transparent",
          }}
        >
          <p className="text-xs font-semibold text-white/70 mb-1">Ejemplo de tienda</p>
          <p className="font-display font-bold text-white text-sm">
            qtienda.shop/<span className="text-blue-300">juanamoda</span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-1.5">
              {["👗", "👜", "👟"].map((e) => (
                <div
                  key={e}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: "rgba(255,255,255,.15)" }}
                >
                  {e}
                </div>
              ))}
            </div>
            <span className="text-white/60 text-xs ml-1">+25 productos</span>
          </div>
        </div>

        {/* Live store directory */}
        <StoresSection />
      </main>

      <footer className="px-5 py-4 text-center text-xs pb-safe" style={{ color: "var(--ink-4)" }}>
        © 2025 qtienda.shop · Hecho con ❤️ en Perú
      </footer>
    </div>
  );
}
