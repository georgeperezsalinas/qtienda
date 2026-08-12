"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Search, Phone, MapPin, Package, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice, getStoreCurrency, type StoreCurrency } from "@/lib/utils";

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
  confirmed:  { label: "Confirmado", cls: "badge-info" },
  preparing:  { label: "Preparando", cls: "badge-progress" },
  on_the_way: { label: "En camino",  cls: "badge-accent" },
  delivered:  { label: "Entregado",  cls: "badge-success" },
  cancelled:  { label: "Cancelado",  cls: "badge-danger" },
};

/* Hoja de ruta del pedido: el vendedor ve en qué paso está y cuál sigue */
const FLOW = [
  { key: "pending",    label: "Pendiente",  desc: "Nuevo pedido, esperando tu confirmación" },
  { key: "confirmed",  label: "Confirmado", desc: "Aceptaste el pedido" },
  { key: "preparing",  label: "Preparando", desc: "Estás alistando los productos" },
  { key: "on_the_way", label: "En camino",  desc: "El pedido salió a entrega" },
  { key: "delivered",  label: "Entregado",  desc: "El cliente recibió su pedido" },
] as const;

const FLOW_IDX: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 2, on_the_way: 3, delivered: 4,
};

/* Siguiente paso explícito por estado */
const NEXT_ACTION: Record<string, { next: string; label: string } | undefined> = {
  pending:    { next: "confirmed",  label: "Confirmar pedido" },
  confirmed:  { next: "preparing",  label: "Empezar preparación" },
  preparing:  { next: "on_the_way", label: "Enviar pedido (en camino)" },
  on_the_way: { next: "delivered",  label: "Marcar como entregado" },
};

/* Estados desde los que aún se puede cancelar */
const CAN_CANCEL = new Set(["pending", "confirmed", "preparing", "on_the_way"]);

interface Order {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string;
  buyer_phone: string;
  total_cents: number;
  items_count: number;
  created_at: string;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
}

interface Staff {
  id: string;
  full_name: string;
  is_active: boolean;
}

interface OrderDetail extends Order {
  buyer_dni?: string;
  buyer_department?: string;
  buyer_province?: string;
  buyer_district?: string;
  buyer_address?: string;
  buyer_reference?: string;
  buyer_email?: string;
  notes?: string;
  subtotal_cents: number;
  delivery_cents: number;
  discount_cents?: number;
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

/* Hoja de ruta visual: pasos del pedido con el actual resaltado y la acción siguiente.
   Integra la entrega: al enviar, el vendedor decide explícitamente quién reparte
   (un repartidor de su equipo o él mismo). Sin repartidores registrados no hay fricción. */
function StatusRoadmap({
  status,
  updating,
  staff,
  assignedToId,
  assignedToName,
  onAdvance,
  onSend,
  onCancel,
  onReactivate,
}: {
  status: string;
  updating: boolean;
  staff: Staff[];
  assignedToId: string | null;
  assignedToName: string | null;
  onAdvance: (next: string) => void;
  onSend: (staffId: string | null) => void;
  onCancel: () => void;
  onReactivate: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  if (status === "cancelled") {
    return (
      <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "var(--danger-soft)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--danger)" }}>Pedido cancelado</p>
        <p className="text-xs mt-1 mb-3" style={{ color: "var(--ink-2)" }}>
          Si fue un error, puedes reactivarlo y volverá a &ldquo;Pendiente&rdquo;.
        </p>
        <button
          onClick={onReactivate}
          disabled={updating}
          className="text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          Reactivar pedido
        </button>
      </div>
    );
  }

  const currentIdx = FLOW_IDX[status] ?? 0;
  const action = NEXT_ACTION[status];

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
        Ruta del pedido
      </p>

      {FLOW.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        const isNext = i === currentIdx + 1;
        return (
          <div key={step.key} className="flex gap-3">
            {/* Punto + conector */}
            <div className="flex flex-col items-center">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-all"
                style={{
                  background: done ? "var(--ink)" : active ? "var(--warn)" : "transparent",
                  border: done || active ? "none" : "1.5px solid var(--line-2)",
                  color: done || active ? "var(--bg)" : "var(--ink-4)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              {i < FLOW.length - 1 && (
                <div
                  className="w-0.5 flex-1"
                  style={{ background: done ? "var(--ink)" : "var(--line-2)", minHeight: 12 }}
                />
              )}
            </div>
            {/* Texto del paso */}
            <div className={i < FLOW.length - 1 ? "pb-2.5" : ""} style={{ minWidth: 0 }}>
              <p
                className="text-sm font-semibold leading-5"
                style={{ color: done || active ? "var(--ink)" : "var(--ink-4)" }}
              >
                {step.label}
                {active && (
                  <span
                    className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full align-middle"
                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                  >
                    Estado actual
                  </span>
                )}
              </p>
              {active && (
                <p className="text-xs" style={{ color: "var(--ink-3)" }}>{step.desc}</p>
              )}

              {/* Entrega: alerta de repartidor pendiente mientras se prepara */}
              {active && step.key === "preparing" && staff.length > 0 && (
                <span
                  className="inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={
                    assignedToName
                      ? { background: "var(--tint)", color: "var(--ink-2)" }
                      : { background: "var(--warn-soft)", color: "var(--warn)" }
                  }
                >
                  {assignedToName
                    ? `🛵 Entregará: ${assignedToName}`
                    : "⚠️ Repartidor por asignar — lo eliges al enviar"}
                </span>
              )}

              {/* Entrega en curso: quién lleva el pedido */}
              {active && step.key === "on_the_way" && (
                <span
                  className="inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "var(--tint)", color: "var(--ink-2)" }}
                >
                  {assignedToName ? `🛵 ${assignedToName} lleva este pedido` : "🙋 Tú llevas este pedido"}
                </span>
              )}

              {/* La acción vive junto al paso al que lleva: queda claro qué pasará.
                  Con un solo repartidor no hay una decisión real que tomar —
                  se envía directo a esa persona (con opción de cambiarlo abajo)
                  en vez de forzar una pantalla extra a elegir entre 1 opción. */}
              {isNext && action && !choosing && (
                <>
                  <button
                    onClick={() => {
                      if (action.next === "on_the_way" && staff.length > 1) setChoosing(true);
                      else if (action.next === "on_the_way" && staff.length === 1) onSend(staff[0].id);
                      else onAdvance(action.next);
                    }}
                    disabled={updating}
                    className="mt-1.5 mb-1 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg transition-opacity disabled:opacity-50"
                    style={{ background: "var(--ink)", color: "var(--bg)" }}
                  >
                    {updating
                      ? "Guardando…"
                      : action.next === "on_the_way" && staff.length === 1
                      ? `Enviar con ${staff[0].full_name} →`
                      : `${action.label} →`}
                  </button>
                  {action.next === "on_the_way" && staff.length === 1 && (
                    <button
                      onClick={() => onSend(null)}
                      disabled={updating}
                      className="block text-[11px] font-semibold disabled:opacity-50"
                      style={{ color: "var(--ink-3)" }}
                    >
                      Entregar tú mismo en su lugar
                    </button>
                  )}
                </>
              )}

              {/* Selector explícito de quién entrega, al momento de enviar */}
              {isNext && action?.next === "on_the_way" && choosing && (
                <div
                  className="mt-2 mb-1 rounded-xl p-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--line-2)" }}
                >
                  <p className="text-xs font-bold mb-2" style={{ color: "var(--ink)" }}>
                    ¿Quién entrega este pedido?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {staff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setChoosing(false); onSend(s.id); }}
                        disabled={updating}
                        className="text-left text-xs font-semibold px-3 py-2.5 rounded-lg disabled:opacity-50"
                        style={{
                          background: "var(--bg)",
                          border: assignedToId === s.id ? "1.5px solid var(--ink)" : "1px solid var(--line-2)",
                          color: "var(--ink-2)",
                        }}
                      >
                        🛵 {s.full_name}
                        {assignedToId === s.id && (
                          <span className="ml-1.5 text-[10px]" style={{ color: "var(--ink-3)" }}>· ya asignado</span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => { setChoosing(false); onSend(null); }}
                      disabled={updating}
                      className="text-left text-xs font-semibold px-3 py-2.5 rounded-lg disabled:opacity-50"
                      style={{ background: "var(--bg)", border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
                    >
                      🙋 Yo mismo lo entrego
                    </button>
                  </div>
                  <button
                    onClick={() => setChoosing(false)}
                    className="w-full mt-2 text-[11px] font-medium py-1"
                    style={{ color: "var(--ink-3)" }}
                  >
                    Volver
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {status === "delivered" ? (
        <p className="text-xs font-medium mt-2 text-center" style={{ color: "var(--success)" }}>
          ✓ Pedido completado
        </p>
      ) : (
        CAN_CANCEL.has(status) && (
          <button
            onClick={onCancel}
            disabled={updating}
            className="w-full mt-2 text-xs font-semibold py-2 rounded-lg disabled:opacity-50"
            style={{ color: "var(--danger)", background: "transparent" }}
          >
            Cancelar pedido
          </button>
        )
      )}
    </div>
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
  const [staff, setStaff] = useState<Staff[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeCurrency, setStoreCurrency] = useState<StoreCurrency>(() => getStoreCurrency(null));
  // IDs de la última carga — para detectar pedidos nuevos en el polling
  // silencioso sin necesitar otro endpoint.
  const knownOrderIds = useRef<Set<string> | null>(null);

  // Slug de la tienda: para el link "Ver como comprador" en el detalle del pedido
  useEffect(() => {
    apiClient.get("/stores/me").then(({ data }) => {
      setStoreSlug(data.slug);
      setStoreCurrency(getStoreCurrency(data));
    }).catch(() => {});
  }, []);

  // Repartidores activos: integran la entrega al flujo del pedido
  useEffect(() => {
    apiClient
      .get("/delivery/staff")
      .then(({ data }) => setStaff((data ?? []).filter((s: Staff) => s.is_active)))
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
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

      // Pedidos que aparecieron desde la última carga (silenciosa o no) —
      // solo se avisa en polling silencioso y en la página 1, para no
      // confundir "cambié de filtro/página" con "llegó un pedido nuevo".
      if (opts?.silent && page === 1 && knownOrderIds.current) {
        const fresh = data.items.filter((o: Order) => !knownOrderIds.current!.has(o.id));
        fresh.forEach((o: Order) => {
          toast.success(`🛎️ Nuevo pedido #${o.order_number} — ${o.buyer_name}`, { duration: 6000 });
        });
      }
      knownOrderIds.current = new Set(data.items.map((o: Order) => o.id));

      setOrders(data.items);
      setTotal(data.total);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [statusFilter, search, page, dateRange]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh: esta es la pantalla de más uso diario y antes no se
  // actualizaba sola — un pedido nuevo solo aparecía si el vendedor recargaba
  // a mano o cambiaba de filtro. Silencioso (no dispara el skeleton de carga).
  useEffect(() => {
    const t = setInterval(() => fetchOrders({ silent: true }), 30_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  async function loadDetail(orderId: string) {
    try {
      const { data } = await apiClient.get(`/orders/${orderId}`);
      setSelected(data);
    } catch {
      toast.error("Error al cargar pedido");
    }
  }

  /* Enviar pedido: asigna (o desasigna) el repartidor elegido y pasa a "En camino" */
  /* Actualiza un pedido ya en memoria (lista + detalle si está abierto) en vez
     de recargar del servidor — esta es la pantalla de más uso diario y cada
     cambio de estado disparaba un refetch completo, se sentía lento en
     conexiones débiles. Si el nuevo estado ya no calza con el filtro activo
     (ej. estabas viendo "Pendientes" y lo confirmaste), sale de la lista —
     mismo resultado que un refetch, sin el viaje de ida y vuelta. */
  function patchOrder(orderId: string, patch: Partial<Order>) {
    const movesOutOfFilter = !!patch.status && !!statusFilter && patch.status !== statusFilter;
    if (movesOutOfFilter && orders.some((o) => o.id === orderId)) {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setTotal((t) => Math.max(0, t - 1));
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
    }
    setSelected((prev) => (prev && prev.id === orderId ? { ...prev, ...patch } : prev));
  }

  async function sendOrder(orderId: string, staffId: string | null) {
    const current = selected?.assigned_to_id ?? null;
    if (staffId !== current) {
      try {
        await apiClient.patch(`/orders/${orderId}/assign`, { staff_id: staffId });
      } catch {
        toast.error("No se pudo asignar el repartidor");
        return;
      }
      const staffName = staff.find((s) => s.id === staffId)?.full_name ?? null;
      patchOrder(orderId, { assigned_to_id: staffId, assigned_to_name: staffName });
    }
    await changeStatus(orderId, "on_the_way");
  }

  async function changeStatus(orderId: string, newStatus: string) {
    if (newStatus === "cancelled") {
      if (!window.confirm("¿Seguro que deseas cancelar este pedido?\nPodrás reactivarlo después si fue un error.")) return;
    }
    setUpdating(true);
    try {
      const res = await apiClient.patch(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Pedido → ${STATUS_LABELS[newStatus]?.label ?? newStatus}`);
      patchOrder(orderId, { status: newStatus });
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

      {storeSlug && (
        <a
          href={`https://${storeSlug}.qtienda.shop/pedido/${selected.order_number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-bold mb-4 -mt-2"
          style={{ color: "var(--accent)" }}
        >
          <ExternalLink size={12} /> Ver como comprador
        </a>
      )}

      <StatusRoadmap
        key={selected.id}
        status={selected.status}
        updating={updating}
        staff={staff}
        assignedToId={selected.assigned_to_id ?? null}
        assignedToName={selected.assigned_to_name ?? null}
        onAdvance={(next) => changeStatus(selected.id, next)}
        onSend={(staffId) => sendOrder(selected.id, staffId)}
        onCancel={() => changeStatus(selected.id, "cancelled")}
        onReactivate={() => changeStatus(selected.id, "pending")}
      />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
          <Phone size={14} style={{ color: "var(--ink-4)" }} />
          <a href={`tel:${selected.buyer_phone}`} className="hover:underline">
            {selected.buyer_name} — {selected.buyer_phone}
          </a>
        </div>
        {selected.buyer_dni && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--ink-4)" }}>DNI</span>
            {selected.buyer_dni}
          </div>
        )}
        {(selected.buyer_address || selected.buyer_district) && (
          <div className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
            <MapPin size={14} className="mt-0.5" style={{ color: "var(--ink-4)" }} />
            <div>
              {selected.buyer_address}
              {(selected.buyer_district || selected.buyer_province || selected.buyer_department) && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {[selected.buyer_district, selected.buyer_province, selected.buyer_department]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {selected.buyer_reference && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  Ref: {selected.buyer_reference}
                </p>
              )}
            </div>
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
              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "var(--surface-2)" }}>
                <Image src={item.image_url} alt={item.product_name} fill sizes="40px" className="object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{item.product_name}</p>
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>x{item.quantity} · {formatPrice(item.unit_price, storeCurrency.code, storeCurrency.locale)}</p>
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{formatPrice(item.unit_price * item.quantity, storeCurrency.code, storeCurrency.locale)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 space-y-1 text-sm mb-4" style={{ background: "var(--bg)" }}>
        <div className="flex justify-between" style={{ color: "var(--ink-2)" }}>
          <span>Subtotal</span><span>{formatPrice(selected.subtotal_cents, storeCurrency.code, storeCurrency.locale)}</span>
        </div>
        <div className="flex justify-between" style={{ color: "var(--ink-2)" }}>
          <span>Delivery</span><span>{formatPrice(selected.delivery_cents, storeCurrency.code, storeCurrency.locale)}</span>
        </div>
        {!!selected.discount_cents && (
          <div className="flex justify-between" style={{ color: "var(--success)" }}>
            <span>🎁 Descuento de bienvenida</span><span>-{formatPrice(selected.discount_cents, storeCurrency.code, storeCurrency.locale)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold pt-1" style={{ color: "var(--ink)", borderTop: "1px solid var(--line-2)" }}>
          <span>Total</span><span>{formatPrice(selected.total_cents, storeCurrency.code, storeCurrency.locale)}</span>
        </div>
      </div>

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
                    <p className="font-bold" style={{ color: "var(--ink)" }}>{formatPrice(order.total_cents, storeCurrency.code, storeCurrency.locale)}</p>
                    <p className="text-xs" style={{ color: "var(--ink-4)" }}>{formatDate(order.created_at)}</p>
                  </div>
                </div>

                {/* La gestión del estado se hace en el detalle (hoja de ruta),
                    aquí solo se invita a abrirlo — evita cambios accidentales.
                    Excepción: confirmar un pedido nuevo es la acción más
                    frecuente y no ambigua (no hay repartidor que elegir), así
                    que se puede resolver en 1 toque sin abrir el detalle. */}
                {order.status === "pending" ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); changeStatus(order.id, "confirmed"); }}
                    disabled={updating}
                    className="w-full mt-3 pt-2.5 flex items-center justify-center gap-1.5 text-xs font-bold disabled:opacity-50"
                    style={{ borderTop: "1px solid var(--line)", color: "var(--success)" }}
                  >
                    ✓ Confirmar pedido
                  </button>
                ) : NEXT_ACTION[order.status] && (
                  <div
                    className="flex items-center justify-between mt-3 pt-2.5 text-xs font-semibold"
                    style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}
                  >
                    <span>
                      {order.status === "preparing" && staff.length > 0 && !order.assigned_to_id ? (
                        <span style={{ color: "var(--warn)" }}>⚠️ Falta asignar repartidor</span>
                      ) : order.status === "on_the_way" ? (
                        <>🛵 {order.assigned_to_name ?? "Entregas tú"}</>
                      ) : (
                        <>Siguiente paso: {STATUS_LABELS[NEXT_ACTION[order.status]!.next]?.label}</>
                      )}
                    </span>
                    <span style={{ color: "var(--ink-2)" }}>Gestionar →</span>
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
