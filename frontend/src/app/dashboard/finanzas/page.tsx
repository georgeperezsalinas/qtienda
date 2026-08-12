"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  TrendingUp, ShoppingBag, CheckCircle2,
  XCircle, CreditCard, ChevronDown, Banknote,
  Smartphone, Building2, BarChart2, Download, Package, Trophy,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useStoreCurrency } from "@/hooks/useStoreCurrency";

/* ── Types ── */
interface PaymentEntry {
  method: string;
  count: number;
  revenue_cents: number;
}

interface TopProduct {
  product_id: string | null;
  product_name: string;
  image_url: string | null;
  units_sold: number;
  revenue_cents: number;
}

interface Stats {
  total_orders:  number;
  pending:       number;
  delivered:     number;
  cancelled:     number;
  revenue_cents: number;
  by_payment:    PaymentEntry[];
}

interface DailyPoint {
  date: string;
  orders: number;
  revenue_cents: number;
}

interface Subscription {
  plan_name: string | null;
  max_orders_mo: number | null;
  max_products: number | null;
  ends_at: string | null;
  status: string;
}

interface Order {
  id:           string;
  order_number: string;
  status:       string;
  buyer_name:   string;
  buyer_phone:  string;
  total_cents:  number;
  items_count:  number;
  created_at:   string;
}

/* ── Periods ── */
type PeriodKey = "today" | "week" | "this_month" | "last_month" | "3m" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today",      label: "Hoy"       },
  { key: "week",       label: "Semana"    },
  { key: "this_month", label: "Este mes"  },
  { key: "last_month", label: "Mes ant."  },
  { key: "3m",         label: "3 meses"   },
  { key: "all",        label: "Todo"      },
];

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function periodDates(key: PeriodKey): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (key) {
    case "today":      return { from: toISO(new Date(y, m, d)),   to: toISO(now) };
    case "week":       return { from: toISO(new Date(y, m, d-6)), to: toISO(now) };
    case "this_month": return { from: toISO(new Date(y, m, 1)),   to: toISO(now) };
    case "last_month": return { from: toISO(new Date(y, m-1, 1)), to: toISO(new Date(y, m, 0)) };
    case "3m":         return { from: toISO(new Date(y, m-2, 1)), to: toISO(now) };
    case "all":        return null;
  }
}

/* Mismo rango de tamaño/posición pero un tramo atrás — para "+12% vs período
   anterior". "this_month" compara contra los mismos N días del mes pasado
   (no el mes completo), para no comparar un mes a medias contra uno cerrado. */
function previousPeriodDates(key: PeriodKey): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (key) {
    case "today":      return { from: toISO(new Date(y, m, d-1)),  to: toISO(new Date(y, m, d-1)) };
    case "week":       return { from: toISO(new Date(y, m, d-13)), to: toISO(new Date(y, m, d-7)) };
    case "this_month": return { from: toISO(new Date(y, m-1, 1)),  to: toISO(new Date(y, m-1, d)) };
    case "last_month": return { from: toISO(new Date(y, m-2, 1)),  to: toISO(new Date(y, m-1, 0)) };
    case "3m":         return { from: toISO(new Date(y, m-5, 1)),  to: toISO(new Date(y, m-2, 0)) };
    case "all":        return null;
  }
}

/* "+12%" / "-8%" / "Nuevo" (de 0 a algo, no es un % real) / null (sin dato
   comparable — ej. período "Todo", o ambos en 0). */
function computeTrend(current: number, previous: number | undefined | null): { pct: number | null; isNew?: boolean } | null {
  if (previous === undefined || previous === null) return null;
  if (previous === 0) return current === 0 ? null : { pct: null, isNew: true };
  return { pct: Math.round(((current - previous) / previous) * 100) };
}

/* ── Status config ── */
const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: "Pendiente",  bg: "#FEF3C7", color: "#D97706" },
  confirmed:  { label: "Confirmado", bg: "#DBEAFE", color: "#1D4ED8" },
  preparing:  { label: "Preparando", bg: "#EDE9FE", color: "#7C3AED" },
  on_the_way: { label: "En camino",  bg: "#E0F2FE", color: "#0369A1" },
  delivered:  { label: "Entregado",  bg: "#D1FAE5", color: "#059669" },
  cancelled:  { label: "Cancelado",  bg: "#FEE2E2", color: "#DC2626" },
};

const STATUS_FILTERS = [
  { value: "",          label: "Todos"      },
  { value: "delivered", label: "Entregados" },
  { value: "pending",   label: "Pendientes" },
  { value: "cancelled", label: "Cancelados" },
];

const PM_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  cash:     { label: "Efectivo",      icon: <Banknote size={14} />,    color: "#059669", bg: "#D1FAE5" },
  yape:     { label: "Yape",          icon: <Smartphone size={14} />,  color: "#7C3AED", bg: "#EDE9FE" },
  plin:     { label: "Plin",          icon: <Smartphone size={14} />,  color: "#0891B2", bg: "#E0F2FE" },
  transfer: { label: "Transferencia", icon: <Building2 size={14} />,   color: "#D97706", bg: "#FEF3C7" },
  card:     { label: "Tarjeta",       icon: <CreditCard size={14} />,  color: "#2563EB", bg: "#DBEAFE" },
};

/* ── Helpers ── */
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)  return "ahora";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/* ── Skeleton ── */
function Skel({ h = 24, className = "" }: { h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h, borderRadius: 14 }} />;
}

/* ── KPI tile ── */
function TrendBadge({ trend }: { trend?: { pct: number | null; isNew?: boolean } | null }) {
  if (!trend) return null;
  const positive = trend.isNew || (trend.pct ?? 0) >= 0;
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{
        background: positive ? "var(--success-soft)" : "var(--danger-soft)",
        color: positive ? "var(--success)" : "var(--danger)",
      }}
    >
      {trend.isNew ? "Nuevo" : `${(trend.pct ?? 0) >= 0 ? "+" : ""}${trend.pct}%`}
    </span>
  );
}

function KpiTile({ label, value, sub, trend, icon, color, bg }: {
  label: string; value: string; sub?: string;
  trend?: { pct: number | null; isNew?: boolean } | null;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 p-3.5 rounded-2xl"
      style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[11px] font-semibold" style={{ color: "var(--ink-4)" }}>{label}</span>
      </div>
      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-display font-extrabold text-xl leading-none" style={{ color: "var(--ink)" }}>
            {value}
          </p>
          <TrendBadge trend={trend} />
        </div>
        {sub && <p className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Daily chart ── */
type ChartMode = "revenue" | "orders";

function DailyChart({ data, loading, currency, locale }: { data: DailyPoint[]; loading: boolean; currency: string; locale: string }) {
  const [mode, setMode] = useState<ChartMode>("revenue");

  if (loading) return <Skel h={120} />;
  if (data.length === 0) return null;

  const values = data.map(d => mode === "revenue" ? d.revenue_cents : d.orders);
  const maxVal  = Math.max(...values, 1);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <BarChart2 size={14} style={{ color: "var(--ink)" }} />
          <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
            Tendencia diaria
          </span>
        </div>
        <div className="flex gap-1">
          {(["revenue", "orders"] as ChartMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
              style={
                mode === m
                  ? { background: "var(--ink)", color: "#fff" }
                  : { background: "var(--surface-2)", color: "var(--ink-3)" }
              }
            >
              {m === "revenue" ? "Ingresos" : "Pedidos"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ minHeight: 72 }}>
        {data.map((d, i) => {
          const val     = mode === "revenue" ? d.revenue_cents : d.orders;
          const pct     = maxVal > 0 ? val / maxVal : 0;
          const barH    = Math.max(4, Math.round(pct * 60));
          const isToday = d.date === toISO(new Date());
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 20 }}>
              <div
                title={`${fmtDay(d.date)}: ${mode === "revenue" ? formatPrice(d.revenue_cents, currency, locale) : d.orders + " pedidos"}`}
                style={{
                  height: barH,
                  width: 14,
                  borderRadius: 4,
                  background: isToday
                    ? "var(--ink)"
                    : `var(--brand-${pct > 0.6 ? "400" : "200"})`,
                  transition: "height 0.3s ease",
                }}
              />
              {data.length <= 14 && (
                <span
                  className="text-[9px] leading-none"
                  style={{ color: isToday ? "var(--ink)" : "var(--ink-4)" }}
                >
                  {new Date(d.date + "T00:00:00").getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Plan usage bar ── */
function PlanUsage({ sub, ordersThisMonth }: { sub: Subscription | null; ordersThisMonth: number }) {
  if (!sub || sub.max_orders_mo == null) return null;

  const pct  = Math.min(1, ordersThisMonth / sub.max_orders_mo);
  const warn = pct >= 0.8;
  const full = pct >= 1;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: full ? "#FEF2F2" : "var(--surface)", border: `1.5px solid ${full ? "#FECACA" : "var(--line-2)"}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
          Pedidos del mes — Plan {sub.plan_name ?? ""}
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: full ? "#DC2626" : warn ? "#D97706" : "var(--ink-3)" }}
        >
          {ordersThisMonth} / {sub.max_orders_mo}
        </span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "var(--line-2)" }}>
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            borderRadius: 9999,
            background: full ? "#DC2626" : warn ? "#F59E0B" : "var(--ink)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
      {full && (
        <p className="text-[11px] mt-2" style={{ color: "#DC2626" }}>
          Límite alcanzado. Los compradores no podrán hacer nuevos pedidos hasta el próximo mes.
        </p>
      )}
      {warn && !full && (
        <p className="text-[11px] mt-2" style={{ color: "#D97706" }}>
          Estás cerca del límite. Considera actualizar tu plan.
        </p>
      )}
    </div>
  );
}

/* ── Payment breakdown ── */
function PaymentBreakdown({ entries, loading, currency, locale }: { entries: PaymentEntry[]; loading: boolean; currency: string; locale: string }) {
  if (loading) return <Skel h={80} />;
  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.revenue_cents, 0);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)" }}
    >
      <p className="text-xs font-bold mb-3" style={{ color: "var(--ink)" }}>
        Por método de pago
      </p>
      <div className="space-y-2.5">
        {entries.map((e) => {
          const cfg = PM_CFG[e.method] ?? PM_CFG.cash;
          const pct = total > 0 ? e.revenue_cents / total : 0;
          return (
            <div key={e.method}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
                    {cfg.label}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
                    {e.count} pedido{e.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
                  {formatPrice(e.revenue_cents, currency, locale)}
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "var(--line-2)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct * 100}%`,
                    borderRadius: 9999,
                    background: cfg.color,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TopSort = "revenue" | "units";

function TopProducts({ items, loading, currency, locale }: { items: TopProduct[]; loading: boolean; currency: string; locale: string }) {
  const [sort, setSort] = useState<TopSort>("revenue");

  if (loading) return <Skel h={220} />;
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) =>
    sort === "revenue" ? b.revenue_cents - a.revenue_cents : b.units_sold - a.units_sold
  );
  const maxValue = Math.max(...sorted.map((p) => (sort === "revenue" ? p.revenue_cents : p.units_sold)), 1);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Trophy size={14} style={{ color: "var(--accent)" }} />
          <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>
            Productos más vendidos
          </p>
        </div>
        <div className="flex gap-1">
          {(["revenue", "units"] as TopSort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
              style={{
                background: sort === s ? "var(--ink)" : "var(--bg)",
                color: sort === s ? "var(--bg)" : "var(--ink-3)",
              }}
            >
              {s === "revenue" ? "Ingresos" : "Unidades"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((p, i) => {
          const value = sort === "revenue" ? p.revenue_cents : p.units_sold;
          const pct = value / maxValue;
          return (
            <div key={p.product_id ?? p.product_name} className="flex items-center gap-2.5">
              <span
                className="flex-shrink-0 text-[11px] font-bold w-4 text-center"
                style={{ color: i < 3 ? "var(--accent)" : "var(--ink-4)" }}
              >
                {i + 1}
              </span>
              <div
                className="relative flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ width: 32, height: 32, background: "var(--bg)" }}
              >
                {p.image_url ? (
                  <Image src={p.image_url} alt={p.product_name} fill sizes="32px" className="object-cover" />
                ) : (
                  <Package size={14} style={{ color: "var(--ink-4)" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--ink-2)" }}>
                    {p.product_name}
                  </p>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: "var(--ink)" }}>
                    {sort === "revenue" ? formatPrice(p.revenue_cents, currency, locale) : `${p.units_sold} und.`}
                  </span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "var(--line-2)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct * 100}%`,
                      borderRadius: 9999,
                      background: "var(--accent)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function FinanzasPage() {
  const { code: currency, locale } = useStoreCurrency();
  const [period,       setPeriod]       = useState<PeriodKey>("this_month");
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [prevStats,    setPrevStats]    = useState<Stats | null>(null);
  const [daily,        setDaily]        = useState<DailyPoint[]>([]);
  const [sub,          setSub]          = useState<Subscription | null>(null);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [totalOrders,  setTotalOrders]  = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingList,  setLoadingList]  = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [topProducts,  setTopProducts]  = useState<TopProduct[]>([]);
  const [loadingTop,   setLoadingTop]   = useState(true);

  /* ── Sub (once) ── */
  useEffect(() => {
    apiClient.get("/plans/my-subscription")
      .then(({ data }) => setSub(data))
      .catch(() => setSub(null));
  }, []);

  /* ── Stats + daily by period ── */
  useEffect(() => {
    const dates = periodDates(period);
    const params = dates ? { from_date: dates.from, to_date: dates.to } : {};
    const prevDates = previousPeriodDates(period);

    setLoadingStats(true);
    setLoadingDaily(true);

    apiClient.get("/orders/stats/summary", { params })
      .then(({ data }) => setStats(data.this_month))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));

    // Período anterior equivalente, para el badge "+12% vs período anterior"
    // — sin período (period "all") no hay nada contra qué comparar.
    if (prevDates) {
      apiClient
        .get("/orders/stats/summary", { params: { from_date: prevDates.from, to_date: prevDates.to } })
        .then(({ data }) => setPrevStats(data.this_month))
        .catch(() => setPrevStats(null));
    } else {
      setPrevStats(null);
    }

    apiClient.get("/orders/stats/daily", { params })
      .then(({ data }) => setDaily(data))
      .catch(() => setDaily([]))
      .finally(() => setLoadingDaily(false));

    setLoadingTop(true);
    apiClient.get("/orders/stats/top-products", { params: { ...params, limit: 10 } })
      .then(({ data }) => setTopProducts(data))
      .catch(() => setTopProducts([]))
      .finally(() => setLoadingTop(false));
  }, [period]);

  /* ── Orders list ── */
  const fetchOrders = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await apiClient.get("/orders/", { params });
      setOrders(data.items ?? []);
      setTotalOrders(data.total ?? 0);
    } catch {
      setOrders([]);
    } finally {
      setLoadingList(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { setPage(1); }, [statusFilter]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /* ── Exportar CSV ── */
  // Sigue el período elegido arriba (mismo que el gráfico), no la paginación
  // de "Movimientos" — es lo que un vendedor espera al exportar "este mes".
  function csvField(value: string | number): string {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const dates = periodDates(period);
      const baseParams: Record<string, string> = {};
      if (dates) { baseParams.from_date = dates.from; baseParams.to_date = dates.to; }
      if (statusFilter) baseParams.status = statusFilter;

      const all: Order[] = [];
      let p = 1;
      // Tope de seguridad (5000 pedidos) — evita un loop infinito si algo
      // en la respuesta no calza; ninguna tienda real exporta tantos de golpe.
      while (p <= 50) {
        const { data } = await apiClient.get("/orders/", { params: { ...baseParams, page: p, limit: 100 } });
        all.push(...(data.items ?? []));
        if (!data.pages || p >= data.pages) break;
        p++;
      }

      if (all.length === 0) {
        toast.error("No hay pedidos en este período para exportar");
        return;
      }

      const header = ["Número", "Fecha", "Cliente", "Teléfono", "Estado", "Ítems", "Total (S/)"];
      const rows = all.map((o) => [
        o.order_number,
        new Date(o.created_at).toLocaleString("es-PE"),
        o.buyer_name,
        o.buyer_phone,
        STATUS_CFG[o.status]?.label ?? o.status,
        o.items_count,
        (o.total_cents / 100).toFixed(2),
      ]);
      const csv = [header, ...rows].map((r) => r.map(csvField).join(",")).join("\n");

      // BOM UTF-8 — Excel abre tildes/ñ correctamente sin él se ven mal
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;
      a.href = url;
      a.download = `pedidos-${periodLabel.toLowerCase().replace(/\s+/g, "-")}-${toISO(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo exportar el CSV");
    } finally {
      setExporting(false);
    }
  }

  /* ── Derived ── */
  const revenue       = stats?.revenue_cents ?? 0;
  const total         = stats?.total_orders  ?? 0;
  const delivered     = stats?.delivered     ?? 0;
  const cancelled     = stats?.cancelled     ?? 0;
  const avgTicket     = delivered > 0 ? Math.round(revenue / delivered) : 0;
  const periodLabel   = PERIODS.find(p => p.key === period)?.label ?? "";
  const byPayment     = stats?.by_payment ?? [];
  const revenueTrend  = computeTrend(revenue, prevStats?.revenue_cents);
  const ordersTrend   = computeTrend(total, prevStats?.total_orders);

  // current-month order count (always from "this_month" period for plan usage)
  const ordersThisMonth = period === "this_month" ? (stats?.total_orders ?? 0) : 0;

  return (
    <div className="max-w-lg lg:max-w-5xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
          Finanzas
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--ink-3)" }}>
          Resumen económico de tu tienda
        </p>
      </div>

      {/* ── Period selector ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 px-5 pt-3 scrollbar-hide">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              period === p.key
                ? { background: "var(--ink)", color: "#fff" }
                : { background: "var(--surface)", color: "var(--ink-3)", border: "1.5px solid var(--line-2)" }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-stretch">

        {/* ── Hero revenue card ── */}
        {loadingStats ? (
          <Skel h={128} />
        ) : (
          <div
            className="rounded-2xl p-5 animate-fade-up lg:flex lg:flex-col lg:justify-center"
            style={{ background: "linear-gradient(135deg, var(--ink), var(--accent-ink))" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                <TrendingUp size={16} color="white" />
              </div>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>
                Ingresos · {periodLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display font-extrabold text-3xl text-white leading-none">
                {formatPrice(revenue, currency, locale)}
              </p>
              {revenueTrend && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: revenueTrend.isNew || (revenueTrend.pct ?? 0) >= 0 ? "rgba(52,211,153,.22)" : "rgba(248,113,113,.22)",
                    color: revenueTrend.isNew || (revenueTrend.pct ?? 0) >= 0 ? "#6EE7B7" : "#FCA5A5",
                  }}
                >
                  {revenueTrend.isNew ? "Nuevo" : `${(revenueTrend.pct ?? 0) >= 0 ? "+" : ""}${revenueTrend.pct}%`}
                </span>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.6)" }}>
              {delivered} pedido{delivered !== 1 ? "s" : ""} completado{delivered !== 1 ? "s" : ""}
              {revenueTrend && " · vs. período anterior"}
            </p>
          </div>
        )}

        {/* ── KPI grid ── */}
        {loadingStats ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skel key={i} h={104} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 animate-fade-up">
            <KpiTile
              label="Pedidos"
              value={String(total)}
              sub={periodLabel}
              trend={ordersTrend}
              icon={<ShoppingBag size={15} />}
              color="#2563EB" bg="#DBEAFE"
            />
            <KpiTile
              label="Entregados"
              value={String(delivered)}
              sub={total > 0 ? `${Math.round((delivered / total) * 100)}% del total` : "—"}
              icon={<CheckCircle2 size={15} />}
              color="#059669" bg="#D1FAE5"
            />
            <KpiTile
              label="Cancelados"
              value={String(cancelled)}
              sub={cancelled > 0 ? "revisar" : "Sin pérdidas"}
              icon={<XCircle size={15} />}
              color="#DC2626" bg="#FEE2E2"
            />
            <KpiTile
              label="Ticket promedio"
              value={avgTicket > 0 ? formatPrice(avgTicket, currency, locale) : "—"}
              sub="por pedido entregado"
              icon={<CreditCard size={15} />}
              color="#D97706" bg="#FEF3C7"
            />
          </div>
        )}

        {/* ── Daily chart ── */}
        <div className="lg:col-span-2">
          <DailyChart data={daily} loading={loadingDaily} currency={currency} locale={locale} />
        </div>

        {/* ── Plan usage ── */}
        {period === "this_month" && !loadingStats && (
          <PlanUsage sub={sub} ordersThisMonth={ordersThisMonth} />
        )}

        {/* ── Payment breakdown ── */}
        <PaymentBreakdown entries={byPayment} loading={loadingStats} currency={currency} locale={locale} />

        {/* ── Top productos ── */}
        <div className="lg:col-span-2">
          <TopProducts items={topProducts} loading={loadingTop} currency={currency} locale={locale} />
        </div>

        {/* ── Detalle de movimientos ── */}
        <div className="animate-fade-up lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
              Movimientos
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                disabled={exporting}
                title="Exportar pedidos del período elegido a CSV"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50"
                style={{
                  background: "var(--surface)",
                  border: "1.5px solid var(--line-2)",
                  color: "var(--ink-2)",
                }}
              >
                <Download size={13} />
                {exporting ? "Exportando..." : "CSV"}
              </button>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-semibold appearance-none pl-3 pr-7 py-1.5 rounded-xl cursor-pointer"
                  style={{
                    background: "var(--surface)",
                    border: "1.5px solid var(--line-2)",
                    color: "var(--ink-2)",
                  }}
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--ink-3)" }}
                />
              </div>
            </div>
          </div>

          {loadingList ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skel key={i} h={64} />)}
            </div>
          ) : orders.length === 0 ? (
            <div
              className="rounded-2xl py-10 text-center"
              style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
                Sin movimientos
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--ink-4)" }}>
                Cuando recibas pedidos aparecerán aquí
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid var(--line-2)" }}>
                {orders.map((order, idx) => {
                  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
                  const isRevenue = order.status !== "cancelled" && order.status !== "pending";
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                      style={{
                        background: "var(--surface)",
                        borderTop: idx > 0 ? "1px solid var(--line)" : "none",
                      }}
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
                            #{order.order_number} · {timeAgo(order.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-sm font-bold"
                          style={{
                            color: order.status === "cancelled"
                              ? "var(--ink-4)"
                              : isRevenue ? "#059669" : "var(--ink-2)",
                            textDecoration: order.status === "cancelled" ? "line-through" : "none",
                          }}
                        >
                          {formatPrice(order.total_cents, currency, locale)}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>
                          {order.items_count} ítem{order.items_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalOrders > 20 && (
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-30"
                    style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)", color: "var(--ink-2)" }}
                  >
                    Anterior
                  </button>
                  <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                    {totalOrders} movimientos
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 20 >= totalOrders}
                    className="text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-30"
                    style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)", color: "var(--ink-2)" }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
