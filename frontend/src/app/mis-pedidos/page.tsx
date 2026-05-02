"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Search, Package } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatPrice } from "@/lib/utils";

/* ── Types ── */
interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url: string | null;
}

interface Order {
  order_number: string;
  status: string;
  total_cents: number;
  created_at: string;
  store_name: string;
  store_slug: string;
  store_logo_url: string | null;
  store_color: string;
  items_count: number;
}

interface OrderDetail extends Order {
  subtotal_cents: number;
  delivery_cents: number;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string | null;
  notes: string | null;
  items: OrderItem[];
}

/* ── Status helpers ── */
const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: "Pendiente",    bg: "#FEF9C3", text: "#92400E" },
  confirmed:  { label: "Confirmado",   bg: "#DBEAFE", text: "#1E40AF" },
  preparing:  { label: "Preparando",   bg: "#EDE9FE", text: "#5B21B6" },
  on_the_way: { label: "En camino",    bg: "#D1FAE5", text: "#065F46" },
  delivered:  { label: "Entregado",    bg: "#D1FAE5", text: "#065F46" },
  cancelled:  { label: "Cancelado",    bg: "#FEE2E2", text: "#991B1B" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, bg: "#F3F4F6", text: "#374151" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function StoreInitial({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
      style={{ background: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── Manual track section (for guests) ── */
function ManualTrack() {
  const [orderNumber, setOrderNumber] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

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
      const detail = err.response?.data?.detail;
      toast.error(detail || "Pedido no encontrado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl border p-5 mt-6"
      style={{ background: "var(--surface-0)", borderColor: "#E2E8F0" }}
    >
      <h3
        className="font-display font-bold text-base mb-4"
        style={{ color: "var(--ink)" }}
      >
        Rastrear un pedido
      </h3>

      <div className="space-y-3">
        <div>
          <label className="field-label">Número de pedido</label>
          <input
            className="input"
            placeholder="Ej: MAR-001"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Slug de la tienda</label>
          <input
            className="input"
            placeholder="Ej: juanamoda"
            value={storeSlug}
            onChange={(e) => setStoreSlug(e.target.value)}
          />
        </div>
        <button
          onClick={track}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Buscando..." : (
            <>
              <Search size={16} />
              Rastrear pedido
            </>
          )}
        </button>
      </div>

      {result && (
        <div
          className="mt-4 rounded-xl p-4 space-y-2"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color: "var(--ink)" }}>
              {result.order_number}
            </span>
            <StatusBadge status={result.status} />
          </div>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Total: {formatPrice(result.total_cents)}
          </p>
          {result.items?.length > 0 && (
            <ul className="space-y-1 mt-2">
              {result.items.map((item: any, i: number) => (
                <li key={i} className="text-xs flex gap-2 items-center" style={{ color: "var(--ink-2)" }}>
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-6 h-6 rounded object-cover flex-shrink-0"
                    />
                  )}
                  {item.name} × {item.qty}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Order card with expandable detail ── */
function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function toggleExpand() {
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
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface-0)", borderColor: "#E2E8F0" }}
    >
      <button
        onClick={toggleExpand}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        {order.store_logo_url ? (
          <img
            src={order.store_logo_url}
            alt={order.store_name}
            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <StoreInitial name={order.store_name} color={order.store_color} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-display font-bold text-sm truncate"
              style={{ color: "var(--ink)" }}
            >
              {order.store_name}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
            #{order.order_number} · {order.items_count} producto{order.items_count !== 1 ? "s" : ""}
          </p>
          <p className="text-xs mt-0.5 font-semibold" style={{ color: order.store_color }}>
            {formatPrice(order.total_cents)}
          </p>
        </div>
        <div style={{ color: "var(--ink-4)" }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 border-t space-y-3"
          style={{ borderColor: "#F1F5F9" }}
        >
          {loadingDetail ? (
            <p className="text-xs text-center py-3" style={{ color: "var(--ink-4)" }}>
              Cargando...
            </p>
          ) : detail ? (
            <>
              <div className="pt-3 space-y-1.5">
                {detail.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                      />
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
              <div
                className="rounded-xl p-3 text-xs space-y-1"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="flex justify-between" style={{ color: "var(--ink-2)" }}>
                  <span>Subtotal</span>
                  <span>{formatPrice(detail.subtotal_cents)}</span>
                </div>
                <div className="flex justify-between" style={{ color: "var(--ink-2)" }}>
                  <span>Delivery</span>
                  <span>{formatPrice(detail.delivery_cents)}</span>
                </div>
                <div
                  className="flex justify-between font-bold border-t pt-1"
                  style={{ color: "var(--ink)", borderColor: "#E2E8F0" }}
                >
                  <span>Total</span>
                  <span style={{ color: detail.store_color }}>{formatPrice(detail.total_cents)}</span>
                </div>
              </div>
              <Link
                href={`/tienda/${detail.store_slug}`}
                className="block text-center text-xs font-semibold py-2 rounded-xl transition-colors"
                style={{
                  color: detail.store_color,
                  background: "transparent",
                  border: `1.5px solid ${detail.store_color}`,
                }}
              >
                Visitar tienda
              </Link>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ── Grouped by store ── */
function GroupedOrders({ orders }: { orders: Order[] }) {
  const groups = orders.reduce<Record<string, Order[]>>((acc, order) => {
    const key = order.store_slug;
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([slug, storeOrders]) => {
        const first = storeOrders[0];
        return (
          <div key={slug}>
            <div className="flex items-center gap-2 mb-3">
              {first.store_logo_url ? (
                <img
                  src={first.store_logo_url}
                  alt={first.store_name}
                  className="w-6 h-6 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: first.store_color }}
                >
                  {first.store_name.charAt(0)}
                </div>
              )}
              <Link
                href={`/tienda/${slug}`}
                className="font-display font-bold text-sm"
                style={{ color: first.store_color }}
              >
                {first.store_name}
              </Link>
              <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                ({storeOrders.length} pedido{storeOrders.length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="space-y-3">
              {storeOrders.map((order) => (
                <OrderCard key={order.order_number} order={order} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main page ── */
export default function MisPedidosPage() {
  const { user, accessToken } = useAuthStore();
  const isLoggedIn  = !!accessToken;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    setLoading(true);
    apiClient
      .get("/buyer/orders")
      .then(({ data }) => setOrders(data))
      .catch(() => toast.error("No se pudieron cargar tus pedidos"))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  return (
    <div>
      <main className="px-5 pt-5 pb-10 max-w-lg mx-auto w-full">
        <div className="mb-6">
          <h1
            className="font-display font-extrabold text-2xl mb-1"
            style={{ color: "var(--ink)" }}
          >
            Mis pedidos
          </h1>
          {isLoggedIn && user && (
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {user.email}
            </p>
          )}
        </div>

        {!isLoggedIn ? (
          /* Guest view */
          <div>
            <div
              className="rounded-2xl border p-6 text-center"
              style={{ background: "var(--surface-0)", borderColor: "#E2E8F0" }}
            >
              <Package size={48} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
              <h2
                className="font-display font-bold text-lg mb-2"
                style={{ color: "var(--ink)" }}
              >
                Inicia sesión para ver tus pedidos
              </h2>
              <p className="text-sm mb-5" style={{ color: "var(--ink-3)" }}>
                Accede a tu historial de compras en todas las tiendas
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/auth/login" className="btn-primary">
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className="btn-secondary"
                >
                  Crear cuenta gratis
                </Link>
              </div>
            </div>

            <ManualTrack />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <svg
              className="animate-spin"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--brand-600)"
              strokeWidth="2.5"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{ background: "var(--surface-0)", borderColor: "#E2E8F0" }}
          >
            <Package size={48} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p
              className="font-display font-bold text-base mb-1"
              style={{ color: "var(--ink)" }}
            >
              Aún no tienes pedidos
            </p>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              Cuando hagas un pedido en una tienda, aparecerá aquí.
            </p>
            <Link href="/" className="btn-primary mt-4 inline-flex">
              Descubrir tiendas
            </Link>
          </div>
        ) : (
          <GroupedOrders orders={orders} />
        )}
      </main>
    </div>
  );
}

