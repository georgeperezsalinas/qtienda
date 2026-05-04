"use client";

import { useEffect, useState, useCallback } from "react";
import { Phone, MapPin, MessageCircle, RefreshCw, Package, Bike, CheckCircle2, Clock, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface StaffMember {
  id: string;
  full_name: string;
}

interface DeliveryOrder {
  id: string;
  order_number: string;
  status: "preparing" | "on_the_way";
  buyer_name: string;
  buyer_phone: string;
  buyer_address?: string;
  buyer_reference?: string;
  total_cents: number;
  items_count: number;
  created_at: string;
  notes?: string;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return "ahora";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} h ${mins % 60} min`;
}

function OrderCard({
  order,
  staff,
  onAction,
  onAssign,
  updating,
  assigning,
}: {
  order: DeliveryOrder;
  staff: StaffMember[];
  onAction: (id: string, status: string) => void;
  onAssign: (orderId: string, staffId: string | null) => void;
  updating: boolean;
  assigning: boolean;
}) {
  const isPreparing = order.status === "preparing";
  const accentColor = isPreparing ? "#7C3AED" : "#2563EB";

  const waLink = `https://wa.me/${order.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hola ${order.buyer_name}, soy de la tienda. Te contacto sobre tu pedido #${order.order_number}.`
  )}`;

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-up"
      style={{ background: "#fff", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 12px rgba(15,23,42,.06)" }}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-2.5"
           style={{ background: `${accentColor}10`, borderBottom: `1.5px solid ${accentColor}20` }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold" style={{ color: accentColor }}>
            #{order.order_number}
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {isPreparing ? "Preparando" : "En camino"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#94A3B8" }}>
          <Clock size={11} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Buyer */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display font-bold text-sm" style={{ color: "#0F172A" }}>
              {order.buyer_name}
            </p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: "#64748B" }}>
              {order.buyer_phone}
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <a
              href={`tel:${order.buyer_phone}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
              aria-label="Llamar"
            >
              <Phone size={15} style={{ color: "#16A34A" }} />
            </a>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
              aria-label="WhatsApp"
            >
              <MessageCircle size={15} style={{ color: "#16A34A" }} />
            </a>
          </div>
        </div>

        {/* Address */}
        {order.buyer_address && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2"
               style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#64748B" }} />
            <div>
              <p className="text-xs font-medium" style={{ color: "#334155" }}>
                {order.buyer_address}
              </p>
              {order.buyer_reference && (
                <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>
                  Ref: {order.buyer_reference}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Note */}
        {order.notes && (
          <p className="text-xs px-3 py-2 rounded-xl italic"
             style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
            📝 {order.notes}
          </p>
        )}

        {/* Assign repartidor — solo en pedidos preparando */}
        {isPreparing && (
          staff.length > 0 ? (
            <div className="flex items-center gap-2">
              <UserCheck size={13} style={{ color: "#64748B", flexShrink: 0 }} />
              <select
                value={order.assigned_to_id ?? ""}
                disabled={assigning}
                onChange={(e) => onAssign(order.id, e.target.value || null)}
                className="flex-1 text-xs rounded-lg px-2 py-1.5 font-medium outline-none"
                style={{
                  border: order.assigned_to_id ? "1.5px solid #93C5FD" : "1.5px solid #E2E8F0",
                  background: order.assigned_to_id ? "#EFF6FF" : "#F8FAFC",
                  color: order.assigned_to_id ? "#1D4ED8" : "#94A3B8",
                }}
              >
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          ) : (
            <a
              href="/dashboard/configuracion"
              className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1.5"
              style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#EA580C" }}
            >
              <UserCheck size={13} />
              Sin repartidores — Crear en Configuración
            </a>
          )
        )}

        {/* En camino: mostrar repartidor asignado (solo lectura) */}
        {!isPreparing && order.assigned_to_name && (
          <div className="flex items-center gap-1.5">
            <UserCheck size={13} style={{ color: "#2563EB" }} />
            <span className="text-xs font-medium" style={{ color: "#2563EB" }}>
              {order.assigned_to_name}
            </span>
          </div>
        )}

        {/* Total + items */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#94A3B8" }}>
            {order.items_count} producto{order.items_count !== 1 ? "s" : ""}
          </span>
          <span className="font-display font-extrabold text-sm" style={{ color: "#0F172A" }}>
            {formatPrice(order.total_cents)}
          </span>
        </div>
      </div>

      {/* Action button */}
      <div className="px-4 pb-4">
        {isPreparing ? (
          <button
            onClick={() => onAction(order.id, "on_the_way")}
            disabled={updating}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: "#2563EB", boxShadow: "0 4px 16px #2563EB44" }}
          >
            <Bike size={16} />
            Despachar pedido
          </button>
        ) : (
          <button
            onClick={() => onAction(order.id, "delivered")}
            disabled={updating}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: "#16A34A", boxShadow: "0 4px 16px #16A34A44" }}
          >
            <CheckCircle2 size={16} />
            Confirmar entrega
          </button>
        )}
      </div>
    </div>
  );
}

export default function DeliveryPage() {
  const [orders,    setOrders]    = useState<DeliveryOrder[]>([]);
  const [staff,     setStaff]     = useState<StaffMember[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [updating,  setUpdating]  = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const preparing  = orders.filter((o) => o.status === "preparing");
  const on_the_way = orders.filter((o) => o.status === "on_the_way");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        apiClient.get("/orders/?status=preparing&limit=50"),
        apiClient.get("/orders/?status=on_the_way&limit=50"),
      ]);
      setOrders([...r1.data.items, ...r2.data.items]);
    } catch {
      toast.error("Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    apiClient.get("/delivery/staff").then(({ data }) => setStaff(data)).catch(() => {});
    const t = setInterval(fetchOrders, 60_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  async function handleAction(orderId: string, newStatus: string) {
    setUpdating(true);
    try {
      const res = await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(newStatus === "on_the_way" ? "¡Pedido despachado!" : "¡Entrega confirmada!");
      await fetchOrders();
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
                style={{ background: "#16A34A" }}
              >
                WhatsApp
              </a>
              <button onClick={() => toast.dismiss(t.id)}
                      className="text-xs text-slate-400 hover:text-slate-600">
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

  async function handleAssign(orderId: string, staffId: string | null) {
    setAssigning(orderId);
    try {
      await apiClient.patch(`/orders/${orderId}/assign`, { staff_id: staffId });
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const member = staff.find((s) => s.id === staffId);
          return {
            ...o,
            assigned_to_id: staffId,
            assigned_to_name: member?.full_name ?? null,
          };
        })
      );
      toast.success(staffId ? "Repartidor asignado" : "Asignación eliminada");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al asignar");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-extrabold text-xl" style={{ color: "#0F172A" }}>
            Control de Delivery
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            {preparing.length + on_the_way.length} pedido{preparing.length + on_the_way.length !== 1 ? "s" : ""} activo{preparing.length + on_the_way.length !== 1 ? "s" : ""}
            {" · "}se actualiza cada 60 s
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: "#F1F5F9", border: "1.5px solid #E2E8F0" }}
          aria-label="Actualizar"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} style={{ color: "#64748B" }} />
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: "#F1F5F9" }} />
          ))}
        </div>
      ) : preparing.length === 0 && on_the_way.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: "#F0FDF4" }}>
            <Package size={28} style={{ color: "#16A34A" }} />
          </div>
          <p className="font-bold text-slate-700">Sin pedidos activos</p>
          <p className="text-sm text-slate-400 mt-1">Los pedidos en preparación o en camino aparecerán aquí.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {preparing.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-purple-600">
                  Preparando ({preparing.length})
                </h2>
              </div>
              <div className="space-y-3">
                {preparing.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    staff={staff}
                    onAction={handleAction}
                    onAssign={handleAssign}
                    updating={updating}
                    assigning={assigning === o.id}
                  />
                ))}
              </div>
            </section>
          )}

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
                  <OrderCard
                    key={o.id}
                    order={o}
                    staff={staff}
                    onAction={handleAction}
                    onAssign={handleAssign}
                    updating={updating}
                    assigning={assigning === o.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
