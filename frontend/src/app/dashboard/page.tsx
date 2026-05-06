"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag, Clock, CheckCircle2,
  Store, ExternalLink, Plus, Bell,
  Eye, Share2, ChevronRight, AlertCircle, Package,
  Mail, RefreshCw, CreditCard, Rocket,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Logo from "@/components/ui/Logo";
import toast from "react-hot-toast";

/* ── Types ── */
interface Stats {
  total_orders:  number;
  pending:       number;
  delivered:     number;
  cancelled:     number;
  revenue_cents: number;
}

interface StoreData {
  id:            string;
  slug:          string;
  name:          string;
  status:        string;
  primary_color: string;
  logo_url?:     string;
  plan_slug?:    string;
}

interface RecentOrder {
  id:           string;
  order_number: string;
  status:       string;
  buyer_name:   string;
  items_count:  number;
  created_at:   string;
}

/* ── Helpers ── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

/* ── Status config ── */
const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: "Pendiente",  bg: "#FEF3C7", color: "#D97706" },
  confirmed:  { label: "Confirmado", bg: "#DBEAFE", color: "#1D4ED8" },
  preparing:  { label: "Preparando", bg: "#EDE9FE", color: "#7C3AED" },
  on_the_way: { label: "En camino",  bg: "#E0F2FE", color: "#0369A1" },
  delivered:  { label: "Entregado",  bg: "#D1FAE5", color: "#059669" },
  cancelled:  { label: "Cancelado",  bg: "#FEE2E2", color: "#DC2626" },
};

/* ── Skeleton ── */
function Skel({ h = 24, className = "" }: { h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h, borderRadius: 16 }} />;
}

/* ── Stat tile ── */
function StatTile({ value, label, icon, color, bg }: {
  value: number; label: string;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div
      className="flex-1 rounded-2xl p-3.5 flex flex-col gap-2.5"
      style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: bg }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p
          className="font-display font-extrabold text-2xl leading-none"
          style={{ color: "var(--ink)" }}
        >
          {value}
        </p>
        <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--ink-3)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

/* ── Action button (grid 2×2) ── */
function ActionBtn({
  href, onClick, icon, label, badge, color, bg,
}: {
  href?: string; onClick?: () => void;
  icon: React.ReactNode; label: string;
  badge?: number; color: string; bg: string;
}) {
  const cls = "flex flex-col items-start gap-3 p-4 rounded-2xl transition-all active:scale-[.97] relative";
  const sty = { background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" };

  const inner = (
    <>
      {(badge ?? 0) > 0 && (
        <span
          className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full
                     flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: "var(--danger)" }}
        >
          {badge! > 99 ? "99+" : badge}
        </span>
      )}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: bg }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
        {label}
      </span>
    </>
  );

  if (onClick) {
    return <button onClick={onClick} className={cls} style={sty}>{inner}</button>;
  }
  return <Link href={href!} className={cls} style={sty}>{inner}</Link>;
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuthStore();

  const [store,        setStore]        = useState<StoreData | null>(null);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [recent,       setRecent]       = useState<RecentOrder[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [resending,    setResending]    = useState(false);
  const [resent,       setResent]       = useState(false);

  const firstName = user?.full_name?.split(" ")[0] ?? "vendedor";
  const initials  = (user?.full_name ?? "U")
    .split(" ").slice(0, 2)
    .map((w: string) => w[0]).join("").toUpperCase();

  useEffect(() => {
    apiClient
      .get("/stores/me")
      .then(({ data }) => setStore(data))
      .catch(() => setStore(null))
      .finally(() => setLoadingStore(false));
  }, []);

  useEffect(() => {
    if (!store) return;
    setLoadingStats(true);
    const today = toISO(new Date());
    Promise.all([
      apiClient.get("/orders/stats/summary", { params: { from_date: today, to_date: today } }),
      apiClient.get("/orders/", { params: { limit: 4, page: 1 } }),
      apiClient.get("/products/", { params: { limit: 1, page: 1 } }),
    ])
      .then(([statsRes, ordersRes, prodsRes]) => {
        setStats(statsRes.data.this_month);
        setRecent(ordersRes.data.items ?? []);
        setProductCount(prodsRes.data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [store]);

  async function resendVerification() {
    setResending(true);
    try {
      await apiClient.post("/auth/resend-verification");
      setResent(true);
      toast.success("Correo reenviado. Revisa tu bandeja de entrada.");
    } catch {
      toast.error("No se pudo reenviar. Intenta más tarde.");
    } finally {
      setResending(false);
    }
  }

  /* ── Derived ── */
  const pending    = stats?.pending    ?? 0;
  const delivered  = stats?.delivered  ?? 0;
  const cancelled  = stats?.cancelled  ?? 0;
  const total      = stats?.total_orders ?? 0;
  const inProgress = Math.max(0, total - pending - delivered - cancelled);

  /* ── Skeleton ── */
  if (loadingStore) {
    return (
      <div className="p-5 max-w-lg mx-auto space-y-4 animate-fade-in">
        <Skel h={28} className="w-48" />
        <Skel h={80} />
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => <Skel key={i} h={96} className="flex-1" />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skel key={i} h={104} />)}
        </div>
        <Skel h={160} />
      </div>
    );
  }

  /* ── No-store empty state ── */
  if (!store) {
    const isVerified = user?.is_verified ?? false;
    return (
      <div className="p-5 max-w-lg mx-auto animate-fade-up">
        <div className="mb-6">
          <p className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
            {getGreeting()} 👋
          </p>
          <h1 className="font-display font-extrabold text-xl mt-0.5" style={{ color: "var(--ink)" }}>
            Hola, {firstName}
          </h1>
        </div>

        {!isVerified ? (
          /* ── Email not verified ── */
          <div
            className="rounded-2xl p-8 text-center space-y-5"
            style={{ background: "#EFF6FF", border: "2px solid #BFDBFE" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "#DBEAFE" }}
            >
              <Mail size={30} style={{ color: "#2563EB" }} />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>
                Verifica tu correo
              </h2>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
                Te enviamos un enlace a{" "}
                <strong style={{ color: "var(--ink)" }}>{user?.email}</strong>.
                <br />
                Haz clic en ese enlace para activar tu cuenta y crear tu tienda.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={resendVerification}
                disabled={resending || resent}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                style={{ background: "#2563EB", color: "#fff" }}
              >
                {resending ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : resent ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Mail size={15} />
                )}
                {resent ? "Correo enviado" : "Reenviar correo de verificación"}
              </button>
              <p className="text-xs" style={{ color: "var(--ink-4)" }}>
                Revisa tu bandeja de entrada y la carpeta de spam.
              </p>
            </div>
          </div>
        ) : (
          /* ── Verified, no store yet ── */
          <div
            className="rounded-2xl p-8 text-center space-y-5"
            style={{ background: "var(--brand-50)", border: "2px dashed var(--brand-200)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "var(--brand-100)" }}
            >
              <Store size={30} style={{ color: "var(--brand-600)" }} />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>
                Crea tu tienda
              </h2>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
                Configura tu tienda online y empieza a recibir pedidos en minutos.
              </p>
            </div>
            <Link href="/dashboard/configuracion" className="btn-primary">
              <Plus size={16} /> Crear tienda ahora
            </Link>
          </div>
        )}
      </div>
    );
  }

  /* ── Main dashboard ── */
  return (
    <div
      className="max-w-lg mx-auto pb-8"
      style={{ background: "var(--surface-2)", minHeight: "100%" }}
    >

      {/* ── Mobile sticky header ── */}
      <div
        className="md:hidden sticky top-0 z-10 px-5 pt-safe pt-4 pb-4"
        style={{ background: "var(--surface-0)", borderBottom: "1px solid #F1F5F9" }}
      >
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-2.5">
            <Link
              href={pending > 0 ? "/dashboard/pedidos?status=pending" : "/dashboard/pedidos"}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--surface-1)", border: "1.5px solid #E2E8F0" }}
              aria-label="Pedidos pendientes"
            >
              <Bell size={18} style={{ color: "var(--ink-2)" }} />
              {pending > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center"
                  style={{ background: "var(--danger)", borderColor: "var(--surface-0)" }}
                />
              )}
            </Link>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center
                         font-display font-bold text-sm text-white"
              style={{ background: "linear-gradient(135deg, var(--brand-600), #7C3AED)" }}
            >
              {initials}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-4">

        {/* ── Greeting ── */}
        <div className="animate-fade-up">
          <p className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
            {getGreeting()} 👋
          </p>
          <h1
            className="font-display font-extrabold text-xl mt-0.5"
            style={{ color: "var(--ink)" }}
          >
            Hola, {firstName}
          </h1>
        </div>

        {/* ── Store card (compact) ── */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 animate-fade-up"
          style={{
            background: store.primary_color || "var(--brand-600)",
            boxShadow: `0 6px 24px ${store.primary_color || "#2563EB"}44`,
          }}
        >
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border-2 border-white/30"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center
                         text-white font-display font-bold text-xl flex-shrink-0 border-2 border-white/30"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {store.name[0]}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-base text-white leading-tight truncate">
              {store.name}
            </h2>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5"
              style={
                store.status === "active"
                  ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                  : { background: "#FEF3C7", color: "#92400E" }
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: store.status === "active" ? "#6EE7B7" : "#F59E0B" }}
              />
              {store.status === "active" ? "Activa" : "Inactiva"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() =>
                navigator.share?.({
                  title: store.name,
                  text: `Visita mi tienda: ${store.name}`,
                  url: `${window.location.origin}/tienda/${store.slug}`,
                })
              }
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.2)" }}
              aria-label="Compartir tienda"
            >
              <Share2 size={16} color="white" />
            </button>
            <a
              href={`/tienda/${store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.2)" }}
              aria-label="Ver tienda"
            >
              <ExternalLink size={16} color="white" />
            </a>
          </div>
        </div>

        {/* ── Onboarding checklist ── */}
        {!loadingStats && productCount !== null && productCount === 0 && (
          <div
            className="rounded-2xl p-4 space-y-3 animate-fade-up"
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
          >
            <div className="flex items-center gap-2">
              <Rocket size={16} style={{ color: "var(--brand-600)" }} />
              <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                Primeros pasos
              </p>
            </div>
            {([
              {
                done: true,
                label: "Tienda creada",
                sub: store.name,
                icon: <Store size={14} />,
                color: "#059669", bg: "#D1FAE5",
              },
              {
                done: false,
                label: "Agrega tu primer producto",
                sub: "Fotos, precio y stock",
                href: "/dashboard/productos",
                icon: <Package size={14} />,
                color: "#2563EB", bg: "#DBEAFE",
              },
              {
                done: false,
                label: "Configura métodos de pago",
                sub: "Yape, Plin, efectivo...",
                href: "/dashboard/configuracion",
                icon: <CreditCard size={14} />,
                color: "#D97706", bg: "#FEF3C7",
              },
              {
                done: false,
                label: "Comparte tu tienda",
                sub: `qtienda.shop/tienda/${store.slug}`,
                icon: <Share2 size={14} />,
                color: "#7C3AED", bg: "#EDE9FE",
                onClick: () => navigator.share?.({
                  title: store.name,
                  text: `Visita mi tienda: ${store.name}`,
                  url: `${window.location.origin}/tienda/${store.slug}`,
                }),
              },
            ] as const).map((step, i) => {
              const inner = (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: step.done ? "#D1FAE5" : step.bg }}
                  >
                    {step.done
                      ? <CheckCircle2 size={16} style={{ color: "#059669" }} />
                      : <span style={{ color: step.color }}>{step.icon}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate"
                       style={{ color: step.done ? "var(--ink-3)" : "var(--ink)",
                                textDecoration: step.done ? "line-through" : "none" }}>
                      {step.label}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--ink-4)" }}>
                      {step.sub}
                    </p>
                  </div>
                  {!step.done && (
                    <ChevronRight size={16} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
                  )}
                </div>
              );
              if ("href" in step && step.href) {
                return <Link key={i} href={step.href} className="block">{inner}</Link>;
              }
              if ("onClick" in step && step.onClick) {
                return <button key={i} className="w-full text-left" onClick={step.onClick}>{inner}</button>;
              }
              return <div key={i}>{inner}</div>;
            })}
          </div>
        )}

        {/* ── Pending alert ── */}
        {!loadingStats && pending > 0 && (
          <Link
            href="/dashboard/pedidos?status=pending"
            className="flex items-center gap-3 p-4 rounded-2xl animate-fade-up transition-all active:scale-[.98]"
            style={{ background: "#FFFBEB", border: "2px solid #FCD34D" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#FEF3C7" }}
            >
              <AlertCircle size={20} style={{ color: "#D97706" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "#92400E" }}>
                {pending} pedido{pending !== 1 ? "s" : ""} esperan tu respuesta
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
                Confirma para avisar al cliente por WhatsApp
              </p>
            </div>
            <ChevronRight size={18} style={{ color: "#D97706", flexShrink: 0 }} />
          </Link>
        )}

        {/* ── Pulso de hoy ── */}
        {loadingStats ? (
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => <Skel key={i} h={100} className="flex-1" />)}
          </div>
        ) : (
          <div className="animate-fade-up">
            <p className="text-xs font-semibold mb-2 px-0.5" style={{ color: "var(--ink-3)" }}>
              Hoy
            </p>
            <div className="flex gap-3">
              <StatTile
                value={total}
                label="Pedidos"
                icon={<ShoppingBag size={16} />}
                color="#2563EB"
                bg="#DBEAFE"
              />
              <StatTile
                value={inProgress}
                label="En proceso"
                icon={<Clock size={16} />}
                color="#D97706"
                bg="#FEF3C7"
              />
              <StatTile
                value={delivered}
                label="Completados"
                icon={<CheckCircle2 size={16} />}
                color="#059669"
                bg="#D1FAE5"
              />
            </div>
          </div>
        )}

        {/* ── Acciones rápidas ── */}
        <div className="animate-fade-up">
          <p className="text-xs font-semibold mb-2 px-0.5" style={{ color: "var(--ink-3)" }}>
            Acciones rápidas
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ActionBtn
              href="/dashboard/productos"
              icon={<Plus size={20} />}
              label="Nuevo producto"
              color="var(--brand-600)"
              bg="var(--brand-50)"
            />
            <ActionBtn
              href="/dashboard/pedidos"
              icon={<Package size={20} />}
              label="Ver pedidos"
              badge={pending}
              color="#7C3AED"
              bg="#EDE9FE"
            />
            <ActionBtn
              href={`/tienda/${store.slug}`}
              icon={<Eye size={20} />}
              label="Ver mi tienda"
              color="#059669"
              bg="#D1FAE5"
            />
            <ActionBtn
              onClick={() =>
                navigator.share?.({
                  title: store.name,
                  text: `Visita mi tienda: ${store.name}`,
                  url: `${window.location.origin}/tienda/${store.slug}`,
                })
              }
              icon={<Share2 size={20} />}
              label="Compartir tienda"
              color="#0369A1"
              bg="#E0F2FE"
            />
          </div>
        </div>

        {/* ── Últimos pedidos ── */}
        {recent.length > 0 && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between px-0.5 mb-2">
              <p className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
                Últimos pedidos
              </p>
              <Link
                href="/dashboard/pedidos"
                className="text-xs font-bold"
                style={{ color: "var(--brand-600)" }}
              >
                Ver todos
              </Link>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
            >
              {recent.map((order, idx) => {
                const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
                return (
                  <Link
                    href="/dashboard/pedidos"
                    key={order.id}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 active:bg-slate-100"
                    style={{ borderTop: idx > 0 ? "1px solid #F1F5F9" : "none" }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.bg }}
                    >
                      <ShoppingBag size={15} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                        {order.buyer_name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                        #{order.order_number} · {order.items_count} ítem{order.items_count !== 1 ? "s" : ""} · {timeAgo(order.created_at)}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Upgrade banner ── */}
        {(!store.plan_slug || store.plan_slug === "free") && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between animate-fade-up"
            style={{ background: "linear-gradient(135deg, var(--brand-800), #4C1D95)" }}
          >
            <div>
              <p className="font-display font-bold text-sm text-white">Sube a Pro 🚀</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.65)" }}>
                Analytics, dominio propio y más
              </p>
            </div>
            <Link
              href="/dashboard/planes"
              className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}
            >
              Ver planes
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
