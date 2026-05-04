"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag, TrendingUp, Clock, CheckCircle2,
  Store, ExternalLink, Plus, ArrowRight,
  ArrowUpRight, Bell, Eye, Package, Share2,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import Logo from "@/components/ui/Logo";

/* ── Types ── */
interface Stats {
  total_orders:  number;
  pending:       number;
  delivered:     number;
  cancelled:     number;
  revenue_cents: number;
}

/* ── Period helpers ── */
type PeriodKey = "today" | "7d" | "30d" | "this_month" | "last_month" | "3m" | "all";

interface Period { label: string; key: PeriodKey }

const PERIODS: Period[] = [
  { key: "today",      label: "Hoy"         },
  { key: "7d",         label: "7 días"      },
  { key: "this_month", label: "Este mes"    },
  { key: "last_month", label: "Mes anterior"},
  { key: "3m",         label: "3 meses"     },
  { key: "all",        label: "Todo"        },
];

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function periodDates(key: PeriodKey): { from: string; to: string } | null {
  const now  = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();

  switch (key) {
    case "today":
      return { from: toISO(new Date(y, m, d)), to: toISO(now) };
    case "7d":
      return { from: toISO(new Date(y, m, d - 6)), to: toISO(now) };
    case "30d":
      return { from: toISO(new Date(y, m, d - 29)), to: toISO(now) };
    case "this_month":
      return { from: toISO(new Date(y, m, 1)), to: toISO(now) };
    case "last_month": {
      const first = new Date(y, m - 1, 1);
      const last  = new Date(y, m, 0);
      return { from: toISO(first), to: toISO(last) };
    }
    case "3m":
      return { from: toISO(new Date(y, m - 2, 1)), to: toISO(now) };
    case "all":
      return null; // no date filter
  }
}

interface StoreData {
  id:            string;
  slug:          string;
  name:          string;
  status:        string;
  store_url:     string;
  primary_color: string;
  logo_url?:     string;
}

/* ── Mini SVG Sparkline ── */
const MOCK_WEEK = [38, 52, 44, 68, 55, 72, 90];
const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "H"];

function Sparkline({ data = MOCK_WEEK }: { data?: number[] }) {
  const W = 240, H = 48, pad = 4;
  const max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = pad + ((max - v) / (max || 1)) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = "M " + pts.join(" L ");
  const area = `${line} L ${(W - pad).toFixed(1)},${H} L ${pad},${H} Z`;
  const [lx, ly] = pts[pts.length - 1].split(",");

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="sk-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#2563EB" stopOpacity=".2" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0"  />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sk-g)" />
      <path
        d={line}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r="3.5" fill="#2563EB" />
    </svg>
  );
}

/* ── Stat card ── */
interface StatProps {
  label:     string;
  value:     string;
  change?:   string;
  positive?: boolean;
  accent?:   boolean;
  icon:      React.ReactNode;
  iconBg:    string;
}

function StatCard({ label, value, change, positive, accent, icon, iconBg }: StatProps) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: accent ? "var(--brand-600)" : "var(--surface-0)",
        border:     accent ? "none"              : "1.5px solid #E2E8F0",
        boxShadow:  accent ? "var(--shadow-brand)" : "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? "rgba(255,255,255,.2)" : iconBg }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: accent ? "rgba(255,255,255,.75)" : "var(--ink-3)" }}
        >
          {label}
        </span>
      </div>
      <div>
        <p
          className="font-display font-extrabold text-2xl leading-none"
          style={{ color: accent ? "#fff" : "var(--ink)" }}
        >
          {value}
        </p>
        {change && (
          <p
            className="text-xs font-semibold mt-1"
            style={{
              color: accent
                ? "rgba(255,255,255,.7)"
                : positive ? "var(--success)" : "var(--ink-3)",
            }}
          >
            {change}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Quick link row ── */
function QuickLink({
  href, icon, label, sub, iconBg, iconColor, badge,
}: {
  href:       string;
  icon:       React.ReactNode;
  label:      string;
  sub?:       string;
  iconBg:     string;
  iconColor:  string;
  badge?:     number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
      style={{
        background: "var(--surface-0)",
        border:     "1.5px solid #E2E8F0",
        boxShadow:  "var(--shadow-sm)",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
        style={{ background: iconBg }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
        {badge != null && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center
                       justify-center text-[9px] font-bold text-white"
            style={{ background: "var(--danger)" }}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
            {sub}
          </p>
        )}
      </div>
      <ArrowRight size={16} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
    </Link>
  );
}

/* ── Skeleton block ── */
function Skel({ h = 24, className = "" }: { h?: number; className?: string }) {
  return (
    <div className={`skeleton ${className}`} style={{ height: h, borderRadius: 16 }} />
  );
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuthStore();

  const [store,        setStore]        = useState<StoreData | null>(null);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [period,       setPeriod]       = useState<PeriodKey>("this_month");

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
    const dates = periodDates(period);
    const params = dates
      ? { from_date: dates.from, to_date: dates.to }
      : {};
    apiClient
      .get("/orders/stats/summary", { params })
      .then(({ data }) => setStats(data.this_month))
      .finally(() => setLoadingStats(false));
  }, [store, period]);

  const firstName = user?.full_name?.split(" ")[0] ?? "vendedor";
  const initials  = (user?.full_name ?? "U")
    .split(" ").slice(0, 2)
    .map((w: string) => w[0]).join("").toUpperCase();

  /* ── Full-page skeleton ── */
  if (loadingStore) {
    return (
      <div className="p-5 max-w-lg mx-auto space-y-4 animate-fade-in">
        <Skel h={28} className="w-48" />
        <Skel h={80} />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skel key={i} h={108} />)}
        </div>
        <Skel h={96} />
        <Skel h={64} />
        <Skel h={64} />
      </div>
    );
  }

  /* ── No-store empty state ── */
  if (!store) {
    return (
      <div className="p-5 max-w-lg mx-auto animate-fade-up">
        <div className="mb-6">
          <p className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
            Buenos días 👋
          </p>
          <h1
            className="font-display font-extrabold text-xl mt-0.5"
            style={{ color: "var(--ink)" }}
          >
            Hola, {firstName}
          </h1>
        </div>

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
            <h2
              className="font-display font-bold text-lg"
              style={{ color: "var(--ink)" }}
            >
              Crea tu tienda
            </h2>
            <p
              className="text-sm mt-1.5 leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              Configura tu tienda online y empieza a recibir pedidos desde TikTok en minutos.
            </p>
          </div>
          <Link href="/dashboard/configuracion" className="btn-primary">
            <Plus size={16} /> Crear tienda ahora
          </Link>
        </div>
      </div>
    );
  }

  /* ── Main dashboard ── */
  return (
    <div
      className="max-w-lg mx-auto pb-6"
      style={{ background: "var(--surface-2)", minHeight: "100%" }}
    >

      {/* Mobile sticky header */}
      <div
        className="md:hidden sticky top-0 z-10 px-5 pt-safe pt-4 pb-4"
        style={{ background: "var(--surface-0)", borderBottom: "1px solid #F1F5F9" }}
      >
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-2.5">
            <button
              className="relative w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--surface-1)", border: "1.5px solid #E2E8F0" }}
              aria-label="Notificaciones"
            >
              <Bell size={18} style={{ color: "var(--ink-2)" }} />
              {(stats?.pending ?? 0) > 0 && (
                <span
                  className="absolute top-2 right-2 w-2 h-2 rounded-full border-2"
                  style={{
                    background: "var(--danger)",
                    borderColor: "var(--surface-0)",
                  }}
                />
              )}
            </button>
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

      {/* Desktop greeting */}
      <div className="hidden md:block px-6 pt-6 pb-2">
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>Buenos días 👋</p>
        <h1
          className="font-display font-extrabold text-2xl mt-0.5"
          style={{ color: "var(--ink)" }}
        >
          Hola, {firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          Resumen de tu negocio este mes
        </p>
      </div>

      <div className="px-5 pt-5 space-y-4">

        {/* ── Store card ── */}
        <div
          className="rounded-2xl overflow-hidden animate-fade-up"
          style={{
            background: store.primary_color || "var(--brand-600)",
            boxShadow: `0 8px 32px ${store.primary_color || "#2563EB"}44`,
          }}
        >
          {/* Top row: logo + actions */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border-2 border-white/30"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center
                             text-white font-display font-bold text-xl flex-shrink-0
                             border-2 border-white/30"
                  style={{ background: "rgba(255,255,255,0.2)" }}
                >
                  {store.name[0]}
                </div>
              )}
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold
                           px-2.5 py-1 rounded-full"
                style={
                  store.status === "active"
                    ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                    : { background: "#FEF3C7", color: "#92400E" }
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: store.status === "active" ? "#6EE7B7" : "#F59E0B",
                  }}
                />
                {store.status === "active" ? "Activa" : "Inactiva"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  navigator.share?.({
                    title: store.name,
                    text: `Visita mi tienda: ${store.name}`,
                    url: `${window.location.origin}/tienda/${store.slug}`,
                  })
                }
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.2)" }}
                aria-label="Compartir tienda"
              >
                <Share2 size={17} color="white" />
              </button>
              <a
                href={`/tienda/${store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.2)" }}
                aria-label="Ver tienda pública"
              >
                <ExternalLink size={17} color="white" />
              </a>
            </div>
          </div>

          {/* Store name */}
          <div className="px-4 pb-4">
            <h2
              className="font-display font-extrabold text-2xl leading-tight text-white"
            >
              {store.name}
            </h2>
            <p className="text-sm mt-1 font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              qtienda.shop/tienda/{store.slug}
            </p>
          </div>
        </div>

        {/* ── Period selector ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide animate-fade-up delay-75 -mx-1 px-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={
                period === p.key
                  ? { background: "var(--brand-600)", color: "#fff" }
                  : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid #E2E8F0" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── KPI grid ── */}
        {loadingStats ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skel key={i} h={108} />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 gap-3 animate-fade-up delay-100">
            <StatCard
              label="Ingresos"
              value={formatPrice(stats.revenue_cents)}
              change={`↑ ${PERIODS.find(p => p.key === period)?.label.toLowerCase()}`}
              positive
              accent
              icon={<TrendingUp size={16} color="white" />}
              iconBg="transparent"
            />
            <StatCard
              label="Pedidos"
              value={String(stats.total_orders)}
              change={`${stats.pending} pendiente${stats.pending !== 1 ? "s" : ""}`}
              positive={stats.pending === 0}
              icon={<ShoppingBag size={15} color="#2563EB" />}
              iconBg="var(--brand-50)"
            />
            <StatCard
              label="Pendientes"
              value={String(stats.pending)}
              change={stats.pending > 0 ? "Requieren acción" : "¡Al día!"}
              positive={stats.pending === 0}
              icon={<Clock size={15} color="#D97706" />}
              iconBg="#FEF3C7"
            />
            <StatCard
              label="Entregados"
              value={String(stats.delivered)}
              change={
                stats.total_orders > 0
                  ? `${Math.round((stats.delivered / stats.total_orders) * 100)}% del total`
                  : "—"
              }
              positive
              icon={<CheckCircle2 size={15} color="#059669" />}
              iconBg="#D1FAE5"
            />
          </div>
        )}

        {/* ── Sparkline chart ── */}
        <div
          className="rounded-2xl p-4 animate-fade-up delay-150"
          style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} style={{ color: "var(--brand-600)" }} />
              <span
                className="font-display font-bold text-sm"
                style={{ color: "var(--ink)" }}
              >
                Ingresos esta semana
              </span>
            </div>
            <Link
              href="/dashboard/pedidos"
              className="flex items-center gap-1 text-xs font-bold"
              style={{ color: "var(--brand-600)" }}
            >
              Ver todo <ArrowUpRight size={12} />
            </Link>
          </div>

          <Sparkline />

          <div className="flex justify-between mt-2">
            {WEEK_DAYS.map((d, i) => (
              <span
                key={i}
                className="text-[10px] font-medium"
                style={{
                  color: i === WEEK_DAYS.length - 1 ? "var(--ink)" : "var(--ink-3)",
                }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="space-y-2.5 animate-fade-up delay-200">
          <h2
            className="font-display font-bold text-sm px-0.5"
            style={{ color: "var(--ink)" }}
          >
            Acciones rápidas
          </h2>

          {(stats?.pending ?? 0) > 0 && (
            <QuickLink
              href="/dashboard/pedidos?status=pending"
              icon={<Clock size={18} />}
              label={`${stats!.pending} pedido${stats!.pending !== 1 ? "s" : ""} pendiente${stats!.pending !== 1 ? "s" : ""}`}
              sub="Confirma para notificar por WhatsApp"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              badge={stats!.pending}
            />
          )}

          <QuickLink
            href="/dashboard/productos"
            icon={<Plus size={18} />}
            label="Agregar producto"
            sub="Sube fotos, precio y descripción"
            iconBg="var(--brand-50)"
            iconColor="var(--brand-600)"
          />

          <QuickLink
            href="/dashboard/pedidos"
            icon={<Package size={18} />}
            label="Todos los pedidos"
            sub={`${stats?.total_orders ?? 0} pedidos este mes`}
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
          />

          <QuickLink
            href={`/tienda/${store.slug}`}
            icon={<Eye size={18} />}
            label="Vista de mi tienda"
            sub={`qtienda.shop/tienda/${store.slug}`}
            iconBg="#D1FAE5"
            iconColor="#059669"
          />
        </div>

        {/* ── Upgrade banner ── */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between animate-fade-up delay-250"
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

      </div>
    </div>
  );
}
