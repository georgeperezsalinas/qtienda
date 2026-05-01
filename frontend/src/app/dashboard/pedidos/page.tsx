"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ChevronDown, Phone, MapPin, Package } from "lucide-react";
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendiente",  color: "bg-yellow-100 text-yellow-700" },
  confirmed:  { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  preparing:  { label: "Preparando", color: "bg-purple-100 text-purple-700" },
  on_the_way: { label: "En camino",  color: "bg-indigo-100 text-indigo-700" },
  delivered:  { label: "Entregado",  color: "bg-green-100 text-green-700" },
  cancelled:  { label: "Cancelado",  color: "bg-red-100 text-red-700" },
};

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  pending:    [{ value: "confirmed", label: "Confirmar" }, { value: "cancelled", label: "Cancelar" }],
  confirmed:  [{ value: "preparing", label: "Preparando" }, { value: "cancelled", label: "Cancelar" }],
  preparing:  [{ value: "on_the_way", label: "En camino" }, { value: "cancelled", label: "Cancelar" }],
  on_the_way: [{ value: "delivered", label: "Entregado" }],
  delivered:  [],
  cancelled:  [],
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

export default function PedidosPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
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
      const { data } = await apiClient.get(`/orders/?${params}`);
      setOrders(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

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
    setUpdating(true);
    try {
      await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success("Estado actualizado");
      await fetchOrders();
      if (selected?.id === orderId) {
        await loadDetail(orderId);
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

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-xl text-gray-900 mb-4">Pedidos</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
      </div>

      {/* Order list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-40" />
          <p>No hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const s = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600" };
            return (
              <div
                key={order.id}
                onClick={() => loadDetail(order.id)}
                className="card p-4 cursor-pointer hover:border-brand-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-gray-900">#{order.order_number}</span>
                      <span className={`badge text-xs ${s.color}`}>{s.label}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{order.buyer_name}</p>
                    <p className="text-xs text-gray-400">{order.buyer_phone} · {order.items_count} ítem{order.items_count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">{formatPrice(order.total_cents)}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                  </div>
                </div>

                {/* Inline quick actions */}
                {TRANSITIONS[order.status]?.length > 0 && (
                  <div
                    className="flex gap-2 mt-3 pt-3 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {TRANSITIONS[order.status].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => changeStatus(order.id, t.value)}
                        disabled={updating}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                          t.value === "cancelled"
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                        }`}
                      >
                        {t.label}
                      </button>
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
          <span className="text-sm text-gray-500 self-center">
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

      {/* Order detail drawer */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelected(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg">Pedido #{selected.order_number}</h2>
                <span className={`badge ${STATUS_LABELS[selected.status]?.color}`}>
                  {STATUS_LABELS[selected.status]?.label}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`tel:${selected.buyer_phone}`} className="hover:text-brand-600">
                    {selected.buyer_name} — {selected.buyer_phone}
                  </a>
                </div>
                {selected.buyer_address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-400 mt-0.5" />
                    {selected.buyer_address}
                  </div>
                )}
                {selected.notes && (
                  <p className="text-sm text-gray-500 italic">"{selected.notes}"</p>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover bg-gray-50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-500">x{item.quantity} · {formatPrice(item.unit_price)}</p>
                    </div>
                    <p className="text-sm font-bold">{formatPrice(item.unit_price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-gray-50 p-3 space-y-1 text-sm mb-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span>{formatPrice(selected.subtotal_cents)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span><span>{formatPrice(selected.delivery_cents)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1">
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
                      className={`flex-1 font-semibold py-3 rounded-xl text-sm transition-colors ${
                        t.value === "cancelled"
                          ? "bg-red-50 text-red-600"
                          : "bg-brand-600 text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
