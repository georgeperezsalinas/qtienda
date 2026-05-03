import Link from "next/link";
import { ArrowRight, Store, MessageCircle, Zap, Star, ShoppingBag, Package } from "lucide-react";

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
    <section className="mt-10 animate-fade-up delay-400">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>
          Descubre tiendas
        </h2>
        <span className="text-xs" style={{ color: "var(--ink-4)" }}>{stores.length} tiendas</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
        {stores.map((store) => (
          <Link key={store.slug} href={`/tienda/${store.slug}`}
            className="flex-shrink-0 card p-3 flex flex-col items-center text-center gap-2 w-28 active:scale-95 transition-transform"
            style={{ minWidth: "7rem" }}
          >
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ background: store.primary_color }}>
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
  { icon: Store,         title: "Tienda propia",    desc: "Link único listo en segundos",  bg: "#EFF6FF", color: "#2563EB" },
  { icon: MessageCircle, title: "WhatsApp directo",  desc: "Pedidos llegan a tu celular",   bg: "#ECFDF5", color: "#059669" },
  { icon: Zap,           title: "Sin comisiones",    desc: "100% de tus ganancias",         bg: "#FFFBEB", color: "#D97706" },
];

const AVATARS = [
  { initials: "ML", bg: "#FCE7F3", color: "#9D174D" },
  { initials: "CR", bg: "#DBEAFE", color: "#1E40AF" },
  { initials: "ST", bg: "#EDE9FE", color: "#5B21B6" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col overflow-hidden" style={{ background: "var(--surface-2)" }}>

      {/* ── Header ── */}
      <header className="px-5 py-4 flex items-center justify-between animate-fade-in">
        <Link href="/" className="font-display font-extrabold text-xl tracking-tight"
          style={{ color: "var(--brand-600)" }}>
          q<span style={{ color: "var(--ink)" }}>tienda</span>
        </Link>
        <Link href="/auth/login"
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          style={{ background: "var(--surface-0)", color: "var(--ink-2)", border: "1.5px solid #E2E8F0" }}>
          Ingresar
        </Link>
      </header>

      <main className="flex-1 px-5 pt-4 pb-12 max-w-lg mx-auto w-full">

        {/* ══ SECCIÓN VENDEDOR ══════════════════════════ */}
        <section className="animate-fade-up">

          {/* Badge */}
          <span className="badge badge-brand mb-5 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--brand-500)" }} />
            Gratis para siempre · Sin tarjeta
          </span>

          {/* Headline */}
          <h1 className="font-display font-extrabold leading-[1.1] mb-4"
            style={{ fontSize: "clamp(30px, 8vw, 42px)", color: "var(--ink)" }}>
            Tu tienda en TikTok{" "}
            <span className="text-gradient">en 2 minutos</span>
          </h1>

          <p className="text-base leading-relaxed mb-7" style={{ color: "var(--ink-2)", maxWidth: "34ch" }}>
            Crea tu link personalizado, publícalo en TikTok y recibe pedidos directo a tu WhatsApp.
          </p>

          {/* Social proof */}
          <div className="flex items-center gap-3 mb-7">
            <div className="flex -space-x-2">
              {AVATARS.map((a) => (
                <div key={a.initials}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold"
                  style={{ background: a.bg, color: a.color }}>
                  {a.initials}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>+2,400 vendedores activos</p>
            </div>
          </div>

          {/* CTAs vendedor */}
          <div className="flex flex-col gap-3">
            <Link href="/auth/register" className="btn-primary text-base">
              <Store size={18} />
              Crear tienda gratis
              <ArrowRight size={18} />
            </Link>
            <Link href="/auth/login"
              className="text-sm font-semibold text-center py-3 rounded-2xl transition-all"
              style={{ color: "var(--ink-3)", background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
              Ya tengo cuenta de vendedor
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-3 mt-8 animate-fade-up delay-200">
          {FEATURES.map(({ icon: Icon, title, desc, bg, color }) => (
            <div key={title} className="card p-3 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: bg }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <p className="font-display font-bold text-xs" style={{ color: "var(--ink)" }}>{title}</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--ink-3)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ══ SEPARADOR ══════════════════════════════════ */}
        <div className="flex items-center gap-4 my-8 animate-fade-up delay-250">
          <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-4)" }}>
            ¿vienes a comprar?
          </span>
          <div className="flex-1 h-px" style={{ background: "#E2E8F0" }} />
        </div>

        {/* ══ SECCIÓN COMPRADOR ════════════════════════ */}
        <section
          className="rounded-3xl p-6 animate-fade-up delay-300"
          style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#EDE9FE" }}>
              <ShoppingBag size={20} style={{ color: "#7C3AED" }} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>
                Para compradores
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                Sigue tus pedidos de todas las tiendas
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Link href="/mis-pedidos"
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[.98]"
              style={{ background: "#7C3AED", color: "#fff", boxShadow: "0 4px 14px rgba(124,58,237,.3)" }}>
              <Package size={16} />
              Ver mis pedidos
            </Link>
            <Link href="/registro"
              className="text-sm font-semibold text-center py-3 rounded-2xl transition-all"
              style={{ color: "#7C3AED", background: "#F5F3FF", border: "1.5px solid #DDD6FE" }}>
              Crear cuenta de comprador
            </Link>
          </div>
        </section>

        {/* Demo strip */}
        <div
          className="mt-8 rounded-2xl p-4 animate-fade-up delay-350"
          style={{ background: "linear-gradient(135deg, var(--brand-800), #4C1D95)" }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,.6)" }}>Ejemplo de tienda</p>
          <p className="font-display font-bold text-white text-sm">
            qtienda.shop/<span style={{ color: "#93C5FD" }}>juanamoda</span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-1.5">
              {["👗", "👜", "👟"].map((e) => (
                <div key={e} className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: "rgba(255,255,255,.15)" }}>
                  {e}
                </div>
              ))}
            </div>
            <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,.5)" }}>+25 productos</span>
          </div>
        </div>

        <StoresSection />
      </main>

      <footer className="px-5 py-4 text-center text-xs pb-safe" style={{ color: "var(--ink-4)" }}>
        © 2025 qtienda.shop · Hecho con ❤️ en Perú
      </footer>
    </div>
  );
}
