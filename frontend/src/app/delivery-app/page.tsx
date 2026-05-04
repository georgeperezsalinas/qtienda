"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MapPin, MessageCircle, RefreshCw,
  Package, Bike, CheckCircle2, Clock, LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatPrice } from "@/lib/utils";
import Logo from "@/components/ui/Logo";

interface DeliveryOrder {
  id: string;
  order_number: string;
  status: "preparing" | "on_the_way";
  buyer_name: string;
  buyer_phone: string;
  buyer_address?: string;
  buyer_reference?: string;
  total_cents: number;
  notes?: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "ahora";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export default function DeliveryAppPage() {
  const router  = useRouter();
  const { user, accessToken, logout } = useAuthStore();
  const [orders,   setOrders]   = useState<DeliveryOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) { router.replace("/auth/login"); return; }
    if (user?.role !== "delivery") { router.replace("/auth/login"); }
  }, [accessToken, user, router]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/delivery/orders");
      setOrders(data);
    } catch {
      toast.error("Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 30_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  async function handleAction(orderId: string, newStatus: string) {
    setUpdating(orderId);
    try {
      const res = await apiClient.patch(`/delivery/orders/${orderId}/status`, { status: newStatus });
      toast.success(newStatus === "on_the_way" ? "¡Pedido despachado!" : "¡Entrega confirmada!");
      await fetchOrders();
      if (res.data?.buyer_wa_link) {
        const waUrl = res.data.buyer_wa_link;
        toast(
          (t) => (
            <span className="flex items-center gap-3">
              <span className="text-sm font-medium">¿Notificar al cliente?</span>
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                 onClick={() => toast.dismiss(t.id)}
                 className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                 style={{ background: "#16A34A" }}>
                WhatsApp
              </a>
              <button onClick={() => toast.dismiss(t.id)}
                      className="text-xs text-slate-400">Omitir</button>
            </span>
          ),
          { duration: 8000, icon: "💬" }
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setUpdating(null);
    }
  }

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  const preparing  = orders.filter((o) => o.status === "preparing");
  const on_the_way = orders.filter((o) => o.status === "on_the_way");

  return (
    <div className="min-h-dvh" style={{ background: "var(--surface-2)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: "#fff", borderBottom: "1px solid #F1F5F9", boxShadow: "0 1px 8px rgba(15,23,42,.06)" }}
      >
        <Logo size="sm" href="/delivery-app" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "#0F172A" }}>{user?.full_name}</p>
            <p className="text-[10px]" style={{ color: "#94A3B8" }}>Repartidor</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
            aria-label="Cerrar sesión"
          >
            <LogOut size={15} style={{ color: "#DC2626" }} />
          </button>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {/* Stats strip */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 rounded-2xl p-3 text-center"
               style={{ background: "#EDE9FE", border: "1.5px solid #C4B5FD" }}>
            <p className="text-2xl font-extrabold" style={{ color: "#7C3AED" }}>{preparing.length}</p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: "#6D28D9" }}>Preparando</p>
          </div>
          <div className="flex-1 rounded-2xl p-3 text-center"
               style={{ background: "#DBEAFE", border: "1.5px solid #93C5FD" }}>
            <p className="text-2xl font-extrabold" style={{ color: "#2563EB" }}>{on_the_way.length}</p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: "#1D4ED8" }}>En camino</p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "#F1F5F9", border: "1.5px solid #E2E8F0" }}
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} style={{ color: "#64748B" }} />
          </button>
        </div>

        {/* Empty state */}
        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: "#F0FDF4" }}>
              <Package size={28} style={{ color: "#16A34A" }} />
            </div>
            <p className="font-bold text-slate-700">Sin pedidos activos</p>
            <p className="text-sm text-slate-400 mt-1">Cuando haya pedidos listos aparecerán aquí.</p>
          </div>
        )}

        {/* Preparing */}
        {preparing.length > 0 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-purple-600">
                Por despachar ({preparing.length})
              </h2>
            </div>
            <div className="space-y-3">
              {preparing.map((o) => (
                <OrderCard key={o.id} order={o} onAction={handleAction}
                           updating={updating === o.id} />
              ))}
            </div>
          </section>
        )}

        {/* On the way */}
        {on_the_way.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">
                En camino ({on_the_way.length})
              </h2>
            </div>
            <div className="space-y-3">
              {on_the_way.map((o) => (
                <OrderCard key={o.id} order={o} onAction={handleAction}
                           updating={updating === o.id} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onAction, updating }: {
  order: DeliveryOrder;
  onAction: (id: string, status: string) => void;
  updating: boolean;
}) {
  const isPreparing  = order.status === "preparing";
  const accentColor  = isPreparing ? "#7C3AED" : "#2563EB";

  const waLink = `https://wa.me/${order.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hola ${order.buyer_name}, te contacto sobre tu pedido #${order.order_number}.`
  )}`;

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: "#fff", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 12px rgba(15,23,42,.06)" }}>
      {/* Strip */}
      <div className="flex items-center justify-between px-4 py-2.5"
           style={{ background: `${accentColor}10`, borderBottom: `1.5px solid ${accentColor}20` }}>
        <span className="text-xs font-extrabold" style={{ color: accentColor }}>
          #{order.order_number}
        </span>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#94A3B8" }}>
          <Clock size={11} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {/* Buyer + contact */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display font-bold text-sm" style={{ color: "#0F172A" }}>
              {order.buyer_name}
            </p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: "#64748B" }}>
              {order.buyer_phone}
            </p>
          </div>
          <div className="flex gap-1.5">
            <a href={`tel:${order.buyer_phone}`}
               className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
              <Phone size={15} style={{ color: "#16A34A" }} />
            </a>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
               className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
              <MessageCircle size={15} style={{ color: "#16A34A" }} />
            </a>
          </div>
        </div>

        {order.buyer_address && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2"
               style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#64748B" }} />
            <div>
              <p className="text-xs font-medium" style={{ color: "#334155" }}>{order.buyer_address}</p>
              {order.buyer_reference && (
                <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>Ref: {order.buyer_reference}</p>
              )}
            </div>
          </div>
        )}

        {order.notes && (
          <p className="text-xs px-3 py-2 rounded-xl italic"
             style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
            📝 {order.notes}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#94A3B8" }}>Total del pedido</span>
          <span className="font-display font-extrabold text-sm" style={{ color: "#0F172A" }}>
            {formatPrice(order.total_cents)}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isPreparing ? (
          <button
            onClick={() => onAction(order.id, "on_the_way")}
            disabled={updating}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: "#2563EB", boxShadow: "0 4px 16px #2563EB44" }}
          >
            <Bike size={17} />
            {updating ? "Procesando…" : "Salir a entregar"}
          </button>
        ) : (
          <button
            onClick={() => onAction(order.id, "delivered")}
            disabled={updating}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: "#16A34A", boxShadow: "0 4px 16px #16A34A44" }}
          >
            <CheckCircle2 size={17} />
            {updating ? "Procesando…" : "Confirmar entrega"}
          </button>
        )}
      </div>
    </div>
  );
}
