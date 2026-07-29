"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronUp, Search, Package,
  Compass, Store, ArrowRight, ShoppingBag, Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatPrice } from "@/lib/utils";

/* ── Types ── */
interface OrderItem {
  product_name: string;
  quantity:     number;
  unit_price:   number;
  subtotal:     number;
  image_url:    string | null;
}
interface Order {
  order_number:   string;
  status:         string;
  total_cents:    number;
  created_at:     string;
  store_name:     string;
  store_slug:     string;
  store_logo_url: string | null;
  store_color:    string;
  items_count:    number;
}
interface OrderDetail extends Order {
  subtotal_cents: number;
  delivery_cents: number;
  buyer_name:     string;
  buyer_phone:    string;
  buyer_address:  string | null;
  notes:          string | null;
  items:          OrderItem[];
}

/* ── Status data ── */
const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendiente",  cls: "badge-warn" },
  confirmed:  { label: "Confirmado", cls: "badge-mute" },
  preparing:  { label: "Preparando", cls: "badge-mute" },
  on_the_way: { label: "En camino",  cls: "badge-mute" },
  delivered:  { label: "Entregado",  cls: "badge-success" },
  cancelled:  { label: "Cancelado",  cls: "badge-danger" },
};

const STEPS = [
  { key: "pending",    label: "Pendiente" },
  { key: "confirmed",  label: "Confirmado" },
  { key: "preparing",  label: "Preparando" },
  { key: "on_the_way", label: "En camino" },
  { key: "delivered",  label: "Entregado" },
];

const FILTERS = [
  { key: "all",       label: "Todos" },
  { key: "active",    label: "En curso" },
  { key: "delivered", label: "Entregados" },
  { key: "cancelled", label: "Cancelados" },
];
const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "on_the_way"];

/* ── Helpers ── */
function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "Ahora";
  if (mins  < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days  < 30) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", { month: "short", day: "numeric" });
}

function applyFilter(orders: Order[], filter: string): Order[] {
  if (filter === "active")    return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  if (filter === "delivered") return orders.filter((o) => o.status === "delivered");
  if (filter === "cancelled") return orders.filter((o) => o.status === "cancelled");
  return orders;
}

function getUserInitials(user: { full_name: string; email: string }): string {
  return (
    user.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    user.email[0].toUpperCase()
  );
}

function getFirstName(user: { full_name: string; email: string }): string {
  return user.full_name.split(" ")[0] || user.email.split("@")[0];
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_INFO[status] ?? { label: status, cls: "badge-mute" };
  return <span className={`badge ${s.cls} flex-shrink-0`}>{s.label}</span>;
}

/* ── Status stepper ── */
function StatusStepper({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex justify-center py-2">
        <span className="badge badge-danger">
          Este pedido fue cancelado
        </span>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-start py-3">
      {STEPS.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        const isLast = i === STEPS.length - 1;
        return (
          <Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 40 }}>
              <div
                className="w-3.5 h-3.5 rounded-full transition-all"
                style={{
                  background: done ? "var(--success)" : active ? "var(--accent)" : "var(--line-2)",
                  boxShadow: active ? "0 0 0 3px var(--accent-soft)" : "none",
                }}
              />
              <span
                className="text-center font-semibold leading-tight"
                style={{
                  fontSize: 8,
                  color: done || active ? "var(--ink-2)" : "var(--ink-4)",
                  maxWidth: 36,
                  display: "block",
                }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className="flex-1 h-0.5 mt-[7px]"
                style={{ background: done ? "var(--success)" : "var(--line-2)" }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/* ── Order card ── */
function OrderCard({ order }: { order: Order }) {
  const [expanded,      setExpanded]      = useState(false);
  const [detail,        setDetail]        = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const color = order.store_color || "var(--accent)";

  async function handleExpand() {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const { data } = await apiClient.get(`/buyer/orders/${order.order_number}`);
        setDetail(data);
      } catch {
        toast.error("No se pudo cargar el detalle");
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((v) => !v);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm), 0 0 0 1px var(--line)",
      }}
    >
      <button onClick={handleExpand} className="w-full flex items-center gap-3 p-3.5 text-left">
        <div
          className="w-11 h-11 rounded-[13px] flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: color }}
        >
          {order.store_logo_url ? (
            <img src={order.store_logo_url} alt={order.store_name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display font-bold text-base text-white">
              {order.store_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm leading-tight truncate" style={{ color: "var(--ink)" }}>
            {order.store_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
            #{order.order_number} · {order.items_count} producto{order.items_count !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusBadge status={order.status} />
            <span className="text-[11px]" style={{ color: "var(--ink-4)" }}>
              {timeAgo(order.created_at)}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-1">
          <p className="font-extrabold text-sm" style={{ color }}>
            {formatPrice(order.total_cents)}
          </p>
          <div className="flex justify-end mt-1.5">
            {expanded
              ? <ChevronUp   size={14} style={{ color: "var(--ink-4)" }} />
              : <ChevronDown size={14} style={{ color: "var(--ink-4)" }} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3.5 pb-4 border-t" style={{ borderColor: "var(--line)" }}>
              <StatusStepper status={order.status} />

              {loadingDetail ? (
                <div className="py-5 flex justify-center">
                  <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24"
                    fill="none" stroke="var(--accent)" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              ) : detail ? (
                <>
                  <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid var(--line)" }}>
                    {detail.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 px-3 py-2.5"
                        style={{ borderBottom: i < detail.items.length - 1 ? "1px solid var(--line)" : "none" }}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.product_name}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: "var(--surface-2)" }}>
                            <Package size={16} style={{ color: "var(--ink-4)" }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>
                            {item.product_name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                            {item.quantity} × {formatPrice(item.unit_price)}
                          </p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: "var(--ink-2)" }}>
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl p-3 text-xs space-y-1.5 mb-3" style={{ background: "var(--bg)" }}>
                    <div className="flex justify-between" style={{ color: "var(--ink-3)" }}>
                      <span>Subtotal</span><span>{formatPrice(detail.subtotal_cents)}</span>
                    </div>
                    <div className="flex justify-between" style={{ color: "var(--ink-3)" }}>
                      <span>Delivery</span><span>{formatPrice(detail.delivery_cents)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1.5 border-t"
                      style={{ color: "var(--ink)", borderColor: "var(--line-2)" }}>
                      <span>Total</span>
                      <span style={{ color }}>{formatPrice(detail.total_cents)}</span>
                    </div>
                  </div>

                  <Link
                    href={`/tienda/${detail.store_slug}`}
                    className="flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl"
                    style={{ background: `${color}12`, color }}
                  >
                    <Store size={13} />
                    Visitar tienda
                  </Link>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Profile hero ── */
function ProfileHero({
  user, orders,
}: {
  user: { full_name: string; email: string };
  orders: Order[];
}) {
  const initials   = getUserInitials(user);
  const firstName  = getFirstName(user);
  const uniqueStores = new Set(orders.map((o) => o.store_slug)).size;
  const delivered  = orders.filter((o) => o.status === "delivered").length;

  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: "linear-gradient(135deg, var(--ink), var(--accent-ink))" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-xl text-white flex-shrink-0"
          style={{ background: "rgba(255,255,255,.18)" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[11px] font-medium">¡Hola de nuevo!</p>
          <p className="text-white font-display font-extrabold text-lg leading-tight truncate">
            {firstName}
          </p>
          <p className="text-white/50 text-xs truncate mt-0.5">{user.email}</p>
        </div>
        <Link
          href="/mi-cuenta"
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,.18)" }}
        >
          <Pencil size={15} className="text-white" />
        </Link>
      </div>

      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { value: orders.length,  label: "pedidos" },
            { value: uniqueStores,   label: "tiendas" },
            { value: delivered,      label: "entregados" },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="rounded-xl px-2 py-2.5 text-center"
              style={{ background: "rgba(255,255,255,.12)" }}
            >
              <p className="text-white font-extrabold text-xl leading-none">{value}</p>
              <p className="text-white/60 text-[10px] font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mis tiendas (horizontal scroll) ── */
function MyStores({ orders }: { orders: Order[] }) {
  const stores = useMemo(() => {
    const seen = new Set<string>();
    return orders.filter((o) => {
      if (seen.has(o.store_slug)) return false;
      seen.add(o.store_slug);
      return true;
    });
  }, [orders]);

  if (stores.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
          Mis tiendas
        </h2>
        <Link href="/tiendas" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          Descubrir más →
        </Link>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4"
        style={{ scrollbarWidth: "none" }}
      >
        {stores.map((o) => {
          const color = o.store_color || "var(--accent)";
          return (
            <Link
              key={o.store_slug}
              href={`/tienda/${o.store_slug}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
              style={{ width: 60 }}
            >
              <div
                className="w-14 h-14 rounded-[16px] flex items-center justify-center overflow-hidden"
                style={{ background: color }}
              >
                {o.store_logo_url ? (
                  <img src={o.store_logo_url} alt={o.store_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-bold text-xl text-white">
                    {o.store_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p
                className="text-[10px] font-semibold text-center leading-tight truncate w-full"
                style={{ color: "var(--ink-2)" }}
              >
                {o.store_name.split(" ")[0]}
              </p>
            </Link>
          );
        })}

        {/* Discover */}
        <Link
          href="/tiendas"
          className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all active:scale-95"
          style={{ width: 60 }}
        >
          <div
            className="w-14 h-14 rounded-[16px] flex items-center justify-center"
            style={{ background: "var(--surface-2)" }}
          >
            <Compass size={22} style={{ color: "var(--ink-3)" }} />
          </div>
          <p className="text-[10px] font-semibold text-center leading-tight" style={{ color: "var(--ink-3)" }}>
            Ver más
          </p>
        </Link>
      </div>
    </div>
  );
}

/* ── Discover CTA banner ── */
function DiscoverBanner({ subtle = false }: { subtle?: boolean }) {
  if (subtle) {
    return (
      <Link
        href="/tiendas"
        className="flex items-center gap-3 p-4 rounded-2xl mt-4 transition-all active:scale-[.98]"
        style={{
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-soft)",
        }}
      >
        <Compass size={20} style={{ color: "var(--accent)" }} />
        <div className="flex-1">
          <p className="font-display font-bold text-sm" style={{ color: "var(--accent-ink)" }}>
            Descubrir nuevas tiendas
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--accent-ink)" }}>
            Explora más tiendas cerca de ti
          </p>
        </div>
        <ArrowRight size={16} style={{ color: "var(--accent)" }} />
      </Link>
    );
  }

  return (
    <Link
      href="/tiendas"
      className="flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[.98]"
      style={{
        background: "linear-gradient(135deg, var(--ink), var(--accent-ink))",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,255,255,.15)" }}
      >
        <Compass size={24} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="font-display font-extrabold text-white text-base">Descubrir tiendas</p>
        <p className="text-white/70 text-xs mt-0.5">Explora y haz tu primer pedido</p>
      </div>
      <ArrowRight size={20} className="text-white/80 flex-shrink-0" />
    </Link>
  );
}

/* ── Manual track (guests) ── */
function ManualTrack() {
  const [orderNumber, setOrderNumber] = useState("");
  const [storeSlug,   setStoreSlug]   = useState("");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<any>(null);

  async function track() {
    if (!orderNumber.trim() || !storeSlug.trim()) {
      toast.error("Ingresa el número de pedido y el nombre de la tienda");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await apiClient.get(
        `/public/store/${storeSlug.trim()}/orders/${orderNumber.trim()}/track`
      );
      setResult(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Pedido no encontrado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5 mt-4"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm), 0 0 0 1px var(--line)",
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--accent-soft)" }}
        >
          <Search size={16} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
            Rastrear un pedido
          </p>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Sin necesidad de iniciar sesión
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="field-label">Número de pedido</label>
          <input className="input" placeholder="Ej: MAR-001" value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Nombre de la tienda</label>
          <input className="input" placeholder="Ej: juanamoda" value={storeSlug}
            onChange={(e) => setStoreSlug(e.target.value)} />
        </div>
        <button
          onClick={track}
          disabled={loading || !orderNumber.trim() || !storeSlug.trim()}
          className="btn-primary w-full"
        >
          {loading ? "Buscando..." : "Rastrear pedido"}
        </button>
      </div>

      {result && (
        <div className="mt-4 rounded-xl p-4"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm" style={{ color: "var(--ink)" }}>#{result.order_number}</span>
            <StatusBadge status={result.status} />
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--ink-3)" }}>
            Total: {formatPrice(result.total_cents)}
          </p>
          <StatusStepper status={result.status} />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════
   MAIN PAGE
════════════════════════════════ */
export default function MisPedidosPage() {
  const { user, accessToken } = useAuthStore();
  const isLoggedIn = !!accessToken;

  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    apiClient
      .get("/buyer/orders")
      .then(({ data }) => setOrders(data))
      .catch(() => toast.error("No se pudieron cargar tus pedidos"))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  const displayed = applyFilter(orders, filter);

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>

      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "color-mix(in srgb, var(--surface) 97%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="px-4 pb-3 max-w-lg lg:max-w-3xl mx-auto w-full"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center justify-between">
            <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
              Mis pedidos
            </h1>
            {isLoggedIn && orders.length > 0 && (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
              >
                {orders.length} pedido{orders.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Filter chips */}
          {isLoggedIn && orders.length > 0 && (
            <div
              className="flex gap-2 mt-3 overflow-x-auto -mx-1 px-1"
              style={{ scrollbarWidth: "none", paddingBottom: 2 }}
            >
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all"
                  style={{
                    background: filter === f.key ? "var(--accent)" : "var(--bg)",
                    color:      filter === f.key ? "#fff" : "var(--ink-3)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-4 max-w-lg lg:max-w-3xl mx-auto w-full">

        {/* ── Guest view ── */}
        {!isLoggedIn && (
          <div>
            <div
              className="rounded-2xl p-6 text-center mb-4"
              style={{
                background: "var(--surface)",
                boxShadow: "var(--shadow-sm), 0 0 0 1px var(--line)",
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--accent-soft)" }}
              >
                <ShoppingBag size={28} style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="font-display font-bold text-lg mb-1.5" style={{ color: "var(--ink)" }}>
                Inicia sesión para ver tus pedidos
              </h2>
              <p className="text-sm mb-5" style={{ color: "var(--ink-3)" }}>
                Accede a tu historial de compras en todas las tiendas
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/auth/login" className="btn-primary">Iniciar sesión</Link>
                <Link href="/registro" className="btn-secondary">Crear cuenta gratis</Link>
              </div>
            </div>
            <DiscoverBanner />
            <ManualTrack />
          </div>
        )}

        {/* ── Logged in: loading ── */}
        {isLoggedIn && loading && (
          <>
            <div className="skeleton h-[148px] rounded-2xl mb-4" />
            <div className="skeleton h-[88px] rounded-2xl mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-[90px] rounded-2xl" />)}
            </div>
          </>
        )}

        {/* ── Logged in: loaded ── */}
        {isLoggedIn && !loading && user && (
          <>
            {/* Profile hero */}
            <ProfileHero user={user} orders={orders} />

            {orders.length === 0 ? (
              /* Empty state */
              <>
                <div
                  className="rounded-2xl p-8 text-center mb-4"
                  style={{
                    background: "var(--surface)",
                    boxShadow: "var(--shadow-sm), 0 0 0 1px var(--line)",
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <Package size={28} style={{ color: "var(--ink-4)" }} />
                  </div>
                  <p className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
                    Aún no tienes pedidos
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink-3)" }}>
                    Explora las tiendas disponibles y haz tu primer pedido.
                  </p>
                </div>
                <DiscoverBanner />
              </>
            ) : (
              /* Orders + stores */
              <>
                <MyStores orders={orders} />

                {/* Orders section */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                    Historial de pedidos
                  </h2>
                </div>

                {displayed.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
                      No hay pedidos en esta categoría
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayed.map((order) => (
                      <OrderCard key={order.order_number} order={order} />
                    ))}
                  </div>
                )}

                <DiscoverBanner subtle />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
