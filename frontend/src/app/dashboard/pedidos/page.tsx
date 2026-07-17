"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Phone, MapPin, Package } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "Preparando" },
  { value: "on_the_way", label: "En camino" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:    { label: "Pendiente",  cls: "badge-warn" },
  confirmed:  { label: "Confirmado", cls: "badge-mute" },
  preparing:  { label: "Preparando", cls: "badge-mute" },
  on_the_way: { label: "En camino",  cls: "badge-mute" },
  delivered:  { label: "Entregado",  cls: "badge-success" },
  cancelled:  { label: "Cancelado",  cls: "badge-danger" },
};

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  pending:    [{ value: "confirmed", label: "Confirmar" }, { value: "cancelled", label: "Cancelar" }],
  confirmed:  [{ value: "preparing", label: "Preparando" }, { value: "cancelled", label: "Cancelar" }],
  preparing:  [{ value: "on_the_way", label: "En camino" }, { value: "cancelled", label: "Cancelar" }],
  on_the_way: [{ value: "delivered", label: "Entregado" }],
  delivered:  [],
  cancelled:  [{ value: "pending", label: "Reactivar" }],
};

interface Order {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string;
  buyer_phone: string;
  total_cents: number;
  items_count: number;
  created_at: string;
}

interface OrderDetail extends Order {
  buyer_address?: string;
  buyer_email?: string;
  notes?: string;
  subtotal_cents: number;
  delivery_cents: number;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    image_url?: string;
  }[];
}

const DATE_RANGES = [
  { value: "",   label: "Siempre" },
  { value: "0",  label: "Hoy" },
  { value: "7",  label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/* Botón de transición de estado — estilo consistente con tokens */
function TransitionButton({ t, onClick, disabled }: { t: { value: string; label: string }; onClick: () => void; disabled: boolean }) {
  const style =
    t.value === "cancelled"
      ? { background: "var(--danger-soft)", color: "var(--danger)" }
      : t.value === "pending"
      ? { background: "var(--warn-soft)", color: "var(--warn)" }
      : { background: "var(--ink)", color: "var(--bg)" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
      style={style}
    >
      {t.label}
    </button>
  );
}

export default function PedidosPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [dateRange, setDateRange] = useState("");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (dateRange !== "") {
        const from = new Date();
        from.setDate(from.getDate() - Number(dateRange));
        params.set("from_date", toISODate(from));
      }
      const { data } = await apiClient.get(`/orders/?${params}`);
      setOrders(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page, dateRange]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function loadDetail(orderId: string) {
    try {
      const { data } = await apiClient.get(`/orders/${orderId}`);
      setSelected(data);
    } catch {
      toast.error("Error al cargar pedido");
    }
  }

  async function changeStatus(orderId: string, newStatus: string) {
    if (newStatus === "cancelled") {
      if (!window.confirm("¿Seguro que deseas cancelar este pedido?\nPodrás reactivarlo después si fue un error.")) return;
    }
    setUpdating(true);
    try {
      const res = await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success("Estado actualizado");
      await fetchOrders();
      if (selected?.id === orderId) {
        await loadDetail(orderId);
      }
      if (res.data?.buyer_wa_link) {
        const waUrl = res.data.buyer_wa_link;
        toast(
          (t) => (
            <span className="flex items-center gap-3">
              <span className="text-sm font-medium">¿Notificar al cliente?</span>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => toast.dismiss(t.id)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: "var(--success)" }}
              >
                WhatsApp
              </a>
              <button onClick={() => toast.dismiss(t.id)}
                      className="text-xs" style={{ color: "var(--ink-3)" }}>
                Omitir
              </button>
            </span>
          ),
          { duration: 8000, icon: "💬" }
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setUpdating(false);
    }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  }

  /* Detalle de pedido: se reutiliza en el drawer móvil y el panel lateral desktop */
  const detailContent = selected && (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>Pedido #{selected.order_number}</h2>
        <span className={`badge ${STATUS_LABELS[selected.status]?.cls}`}>
          {STATUS_LABELS[selected.status]?.label}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
          <Phone size={14} style={{ color: "var(--ink-4)" }} />
          <a href={`tel:${selected.buyer_phone}`} className="hover:underline">
            {selected.buyer_name} — {selected.buyer_phone}
          </a>
        </div>
        {selected.buyer_address && (
          <div className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
            <MapPin size={14} className="mt-0.5" style={{ color: "var(--ink-4)" }} />
            {selected.buyer_address}
          </div>
        )}
        {selected.notes && (
          <p className="text-sm italic" style={{ color: "var(--ink-3)" }}>"{selected.notes}"</p>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {selected.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {item.image_url && (
              <img src={item.image_url} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover" style={{ background: "var(--surface-2)" }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{item.product_name}</p>
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>x{item.quantity} · {formatPrice(item.unit_price)}</p>
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{formatPrice(item.unit_price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 space-y-1 text-sm mb-4" style={{ background: "var(--bg)" }}>
        <div className="flex justify-between" style={{ color: "var(--ink-2)" }}>
          <span>Subtotal</span><span>{formatPrice(selected.subtotal_cents)}</span>
        </div>
        <div className="flex justify-between" style={{ color: "var(--ink-2)" }}>
          <span>Delivery</span><span>{formatPrice(selected.delivery_cents)}</span>
        </div>
        <div className="flex justify-between font-bold pt-1" style={{ color: "var(--ink)", borderTop: "1px solid var(--line-2)" }}>
          <span>Total</span><span>{formatPrice(selected.total_cents)}</span>
        </div>
      </div>

      {TRANSITIONS[selected.status]?.length > 0 && (
        <div className="flex gap-3">
          {TRANSITIONS[selected.status].map((t) => (
            <button
              key={t.value}
              onClick={() => changeStatus(selected.id, t.value)}
              disabled={updating}
              className="flex-1 font-semibold py-3 rounded-xl text-sm transition-opacity disabled:opacity-50"
              style={
                t.value === "cancelled"
                  ? { background: "var(--danger-soft)", color: "var(--danger)" }
                  : t.value === "pending"
                  ? { background: "var(--warn-soft)", color: "var(--warn)" }
                  : { background: "var(--ink)", color: "var(--bg)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="p-5 md:p-8 max-w-2xl lg:max-w-6xl mx-auto">
      <h1 className="font-display font-bold text-xl lg:text-2xl mb-4 lg:mb-6" style={{ color: "var(--ink)" }}>Pedidos</h1>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:items-start">
      <div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
          <input
            className="input pl-9 py-2.5"
            placeholder="Buscar nombre, teléfono..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto py-2.5"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          className="input w-auto py-2.5"
          value={dateRange}
          onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
        >
          {DATE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Order list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--ink-4)" }}>
          <Package size={48} className="mx-auto mb-3 opacity-40" />
          <p>No hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {orders.map((order) => {
            const s = STATUS_LABELS[order.status] ?? { label: order.status, cls: "badge-mute" };
            const isSelected = selected?.id === order.id;
            return (
              <div
                key={order.id}
                onClick={() => loadDetail(order.id)}
                className="card p-4 cursor-pointer transition-all h-fit"
                style={{
                  borderColor: isSelected ? "var(--ink)" : "var(--line)",
                  boxShadow: isSelected ? "0 0 0 1.5px var(--ink)" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{ color: "var(--ink)" }}>#{order.order_number}</span>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--ink-2)" }}>{order.buyer_name}</p>
                    <p className="text-xs" style={{ color: "var(--ink-4)" }}>{order.buyer_phone} · {order.items_count} ítem{order.items_count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold" style={{ color: "var(--ink)" }}>{formatPrice(order.total_cents)}</p>
                    <p className="text-xs" style={{ color: "var(--ink-4)" }}>{formatDate(order.created_at)}</p>
                  </div>
                </div>

                {/* Inline quick actions */}
                {TRANSITIONS[order.status]?.length > 0 && (
                  <div
                    className="flex gap-2 mt-3 pt-3"
                    style={{ borderTop: "1px solid var(--line)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {TRANSITIONS[order.status].map((t) => (
                      <TransitionButton key={t.value} t={t} disabled={updating} onClick={() => changeStatus(order.id, t.value)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-3 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm px-4 py-2"
          >
            Anterior
          </button>
          <span className="text-sm self-center" style={{ color: "var(--ink-3)" }}>
            {page} / {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="btn-secondary text-sm px-4 py-2"
          >
            Siguiente
          </button>
        </div>
      )}

      </div>{/* /columna izquierda */}

      {/* Panel de detalle fijo (solo desktop) */}
      <aside className="hidden lg:block sticky top-6">
        {selected ? (
          <div className="card p-5">{detailContent}</div>
        ) : (
          <div className="card p-10 text-center" style={{ color: "var(--ink-4)" }}>
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Selecciona un pedido para ver el detalle</p>
          </div>
        )}
      </aside>
      </div>{/* /grid */}

      {/* Order detail drawer (solo móvil/tablet) */}
      {selected && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(20,19,15,.4)" }}
            onClick={() => setSelected(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto" style={{ background: "var(--surface)" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--line-2)" }} />
            </div>
            <div className="px-5 pb-8">{detailContent}</div>
          </div>
        </div>
      )}
    </div>
  );
}
