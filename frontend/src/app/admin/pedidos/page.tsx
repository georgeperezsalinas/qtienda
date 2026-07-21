"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ShoppingBag, ChevronLeft, ChevronRight as ChevronRightIcon, Store } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface OrderItem {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string;
  buyer_phone: string;
  total_cents: number;
  payment_method: string;
  created_at: string;
  store: { name: string; slug: string };
}

interface OrdersResponse {
  total: number;
  page: number;
  pages: number;
  items: OrderItem[];
}

const STATUS_TABS = [
  { key: "", label: "Todos" },
  { key: "pending", label: "Pendiente" },
  { key: "confirmed", label: "Confirmado" },
  { key: "preparing", label: "Preparando" },
  { key: "on_the_way", label: "En camino" },
  { key: "delivered", label: "Entregado" },
  { key: "cancelled", label: "Cancelado" },
];

const STATUS_CLS: Record<string, string> = {
  pending: "badge-warn",
  confirmed: "badge-mute",
  preparing: "badge-mute",
  on_the_way: "badge-mute",
  delivered: "badge-success",
  cancelled: "badge-danger",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
  card: "Tarjeta",
};

function statusLabel(status: string) {
  return STATUS_TABS.find((t) => t.key === status)?.label ?? status;
}

function dateTimePE(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function Skel({ h = 24 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

export default function AdminPedidosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const status = searchParams.get("status") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const q = searchParams.get("q") ?? "";

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (status) params.status = status;
      if (q) params.q = q;
      const { data } = await apiClient.get<OrdersResponse>("/admin/orders", { params });
      setOrders(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [status, page, q]);

  useEffect(() => {
    setQuery(q);
    fetchOrders();
  }, [q, fetchOrders]);

  function setFilter(key: string) {
    const params = new URLSearchParams();
    if (key) params.set("status", key);
    if (q) params.set("q", q);
    params.set("page", "1");
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    params.set("page", "1");
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/admin/pedidos?${params.toString()}`);
  }

  const activeTab = STATUS_TABS.find((t) => t.key === status) ?? STATUS_TABS[0];

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto px-5 py-6 space-y-5">

      <div>
        <p className="eyebrow">Marcha blanca</p>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Pedidos
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          {total} pedido{total !== 1 ? "s" : ""} {activeTab.label !== "Todos" ? activeTab.label.toLowerCase() : "registrados"}
        </p>
      </div>

      <form onSubmit={submitSearch} className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9 pr-3 py-2.5"
          placeholder="Buscar por comprador, celular o número de pedido"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              status === t.key
                ? { background: "var(--brand-600)", color: "#fff" }
                : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid var(--line-2)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skel key={i} h={82} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
          <ShoppingBag size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
            No hay pedidos {activeTab.label !== "Todos" ? activeTab.label.toLowerCase() : ""}
          </p>
        </div>
      ) : (
        <>
        {/* Tarjetas — móvil/tablet */}
        <div className="lg:hidden space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl p-4"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>#{o.order_number}</p>
                    <span className={`badge ${STATUS_CLS[o.status] ?? "badge-mute"}`}>{statusLabel(o.status)}</span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
                    {o.buyer_name} · {o.buyer_phone}
                  </p>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--ink-4)" }}>
                    <Store size={11} />
                    {o.store.name} · {PAYMENT_LABELS[o.payment_method] ?? o.payment_method} · {dateTimePE(o.created_at)}
                  </p>
                </div>
                <p className="font-display font-extrabold text-base flex-shrink-0" style={{ color: "var(--ink)" }}>
                  {formatPrice(o.total_cents)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla — escritorio */}
        <div
          className="hidden lg:block rounded-2xl overflow-x-auto"
          style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
        >
          <table className="w-full text-sm" style={{ minWidth: 800 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Pedido</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Tienda</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Cliente</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Estado</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Pago</th>
                <th className="text-right font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Monto</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--ink)" }}>#{o.order_number}</td>
                  <td className="px-4 py-3 truncate max-w-[160px]" style={{ color: "var(--ink-2)" }}>{o.store.name}</td>
                  <td className="px-4 py-3">
                    <p className="truncate max-w-[160px]" style={{ color: "var(--ink-2)" }}>{o.buyer_name}</p>
                    <p className="text-xs" style={{ color: "var(--ink-4)" }}>{o.buyer_phone}</p>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_CLS[o.status] ?? "badge-mute"}`}>{statusLabel(o.status)}</span></td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--ink-3)" }}>{PAYMENT_LABELS[o.payment_method] ?? o.payment_method}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap" style={{ color: "var(--ink)" }}>{formatPrice(o.total_cents)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--ink-3)" }}>{dateTimePE(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronLeft size={16} style={{ color: "var(--ink-2)" }} />
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronRightIcon size={16} style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
      )}

    </div>
  );
}
