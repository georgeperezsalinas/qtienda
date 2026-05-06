"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, ShoppingBag, CheckCircle2,
  XCircle, CreditCard, ChevronDown, Banknote,
  Smartphone, Building2, BarChart2,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

/* ── Types ── */
interface PaymentEntry {
  method: string;
  count: number;
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
function KpiTile({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 p-3.5 rounded-2xl"
      style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[11px] font-semibold" style={{ color: "var(--ink-4)" }}>{label}</span>
      </div>
      <div>
        <p className="font-display font-extrabold text-xl leading-none" style={{ color: "var(--ink)" }}>
          {value}
        </p>
        {sub && <p className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Daily chart ── */
type ChartMode = "revenue" | "orders";

function DailyChart({ data, loading }: { data: DailyPoint[]; loading: boolean }) {
  const [mode, setMode] = useState<ChartMode>("revenue");

  if (loading) return <Skel h={120} />;
  if (data.length === 0) return null;

  const values = data.map(d => mode === "revenue" ? d.revenue_cents : d.orders);
  const maxVal  = Math.max(...values, 1);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <BarChart2 size={14} style={{ color: "var(--brand-600)" }} />
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
                  ? { background: "var(--brand-600)", color: "#fff" }
                  : { background: "var(--surface-1)", color: "var(--ink-3)" }
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
                title={`${fmtDay(d.date)}: ${mode === "revenue" ? formatPrice(d.revenue_cents) : d.orders + " pedidos"}`}
                style={{
                  height: barH,
                  width: 14,
                  borderRadius: 4,
                  background: isToday
                    ? "var(--brand-600)"
                    : `var(--brand-${pct > 0.6 ? "400" : "200"})`,
                  transition: "height 0.3s ease",
                }}
              />
              {data.length <= 14 && (
                <span
                  className="text-[9px] leading-none"
                  style={{ color: isToday ? "var(--brand-600)" : "var(--ink-4)" }}
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
      style={{ background: full ? "#FEF2F2" : "var(--surface-0)", border: `1.5px solid ${full ? "#FECACA" : "#E2E8F0"}` }}
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
      <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "#E2E8F0" }}>
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            borderRadius: 9999,
            background: full ? "#DC2626" : warn ? "#F59E0B" : "var(--brand-600)",
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
function PaymentBreakdown({ entries, loading }: { entries: PaymentEntry[]; loading: boolean }) {
  if (loading) return <Skel h={80} />;
  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.revenue_cents, 0);

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
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
                  {formatPrice(e.revenue_cents)}
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "#E2E8F0" }}>
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

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function FinanzasPage() {
  const [period,       setPeriod]       = useState<PeriodKey>("this_month");
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [daily,        setDaily]        = useState<DailyPoint[]>([]);
  const [sub,          setSub]          = useState<Subscription | null>(null);
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [totalOrders,  setTotalOrders]  = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingList,  setLoadingList]  = useState(true);

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

    setLoadingStats(true);
    setLoadingDaily(true);

    apiClient.get("/orders/stats/summary", { params })
      .then(({ data }) => setStats(data.this_month))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));

    apiClient.get("/orders/stats/daily", { params })
      .then(({ data }) => setDaily(data))
      .catch(() => setDaily([]))
      .finally(() => setLoadingDaily(false));
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

  /* ── Derived ── */
  const revenue       = stats?.revenue_cents ?? 0;
  const total         = stats?.total_orders  ?? 0;
  const delivered     = stats?.delivered     ?? 0;
  const cancelled     = stats?.cancelled     ?? 0;
  const avgTicket     = delivered > 0 ? Math.round(revenue / delivered) : 0;
  const periodLabel   = PERIODS.find(p => p.key === period)?.label ?? "";
  const byPayment     = stats?.by_payment ?? [];

  // current-month order count (always from "this_month" period for plan usage)
  const ordersThisMonth = period === "this_month" ? (stats?.total_orders ?? 0) : 0;

  return (
    <div className="max-w-lg mx-auto pb-10">

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
                ? { background: "var(--brand-600)", color: "#fff" }
                : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid #E2E8F0" }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* ── Hero revenue card ── */}
        {loadingStats ? (
          <Skel h={128} />
        ) : (
          <div
            className="rounded-2xl p-5 animate-fade-up"
            style={{ background: "linear-gradient(135deg, var(--brand-700), #5B21B6)" }}
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
            <p className="font-display font-extrabold text-3xl text-white leading-none">
              {formatPrice(revenue)}
            </p>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.6)" }}>
              {delivered} pedido{delivered !== 1 ? "s" : ""} completado{delivered !== 1 ? "s" : ""}
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
              value={avgTicket > 0 ? formatPrice(avgTicket) : "—"}
              sub="por pedido entregado"
              icon={<CreditCard size={15} />}
              color="#D97706" bg="#FEF3C7"
            />
          </div>
        )}

        {/* ── Daily chart ── */}
        <DailyChart data={daily} loading={loadingDaily} />

        {/* ── Plan usage ── */}
        {period === "this_month" && !loadingStats && (
          <PlanUsage sub={sub} ordersThisMonth={ordersThisMonth} />
        )}

        {/* ── Payment breakdown ── */}
        <PaymentBreakdown entries={byPayment} loading={loadingStats} />

        {/* ── Detalle de movimientos ── */}
        <div className="animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
              Movimientos
            </h2>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold appearance-none pl-3 pr-7 py-1.5 rounded-xl cursor-pointer"
                style={{
                  background: "var(--surface-0)",
                  border: "1.5px solid #E2E8F0",
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

          {loadingList ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skel key={i} h={64} />)}
            </div>
          ) : orders.length === 0 ? (
            <div
              className="rounded-2xl py-10 text-center"
              style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
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
              <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #E2E8F0" }}>
                {orders.map((order, idx) => {
                  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
                  const isRevenue = order.status !== "cancelled" && order.status !== "pending";
                  return (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                      style={{
                        background: "var(--surface-0)",
                        borderTop: idx > 0 ? "1px solid #F1F5F9" : "none",
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
                          {formatPrice(order.total_cents)}
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
                    style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", color: "var(--ink-2)" }}
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
                    style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", color: "var(--ink-2)" }}
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
