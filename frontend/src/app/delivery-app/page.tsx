"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MapPin, MessageCircle, RefreshCw,
  Package, Bike, CheckCircle2, Clock, LogOut,
  Camera, X, Upload, History,
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
  payment_method: string;
  payment_status: string;
  notes?: string;
  created_at: string;
}

interface DeliveredOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_address?: string;
  total_cents: number;
  updated_at: string;
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
  const [tab,        setTab]        = useState<"active" | "history">("active");
  const [storeName,  setStoreName]  = useState<string>("");
  const [orders,     setOrders]     = useState<DeliveryOrder[]>([]);
  const [history,    setHistory]    = useState<DeliveredOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [updating,   setUpdating]   = useState<string | null>(null);

  // Proof photo + GPS + payment modal state
  const [confirmOrder,      setConfirmOrder]      = useState<DeliveryOrder | null>(null);
  const [proofFile,         setProofFile]         = useState<File | null>(null);
  const [proofPreview,      setProofPreview]      = useState<string | null>(null);
  const [uploading,         setUploading]         = useState(false);
  const [gpsCoords,         setGpsCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus,         setGpsStatus]         = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [paymentCollected,  setPaymentCollected]  = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // IDs de la última carga — detecta pedidos nuevos en el polling silencioso
  const knownOrderIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!accessToken) { router.replace("/auth/login"); return; }
    if (user?.role !== "delivery") { router.replace("/auth/login"); }
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    apiClient.get("/delivery/store")
      .then(({ data }) => setStoreName(data.name))
      .catch(() => {});
  }, [accessToken]);

  const fetchOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const { data } = await apiClient.get("/delivery/orders");

      // Solo avisa en polling silencioso — al cargar por primera vez "todo"
      // es nuevo y no tiene sentido avisar de golpe.
      if (opts?.silent && knownOrderIds.current) {
        const fresh = data.filter((o: DeliveryOrder) => !knownOrderIds.current!.has(o.id));
        fresh.forEach((o: DeliveryOrder) => {
          toast.success(`🛎️ Pedido #${o.order_number} listo para repartir`, { duration: 6000 });
        });
      }
      knownOrderIds.current = new Set(data.map((o: DeliveryOrder) => o.id));

      setOrders(data);
    } catch {
      if (!opts?.silent) toast.error("Error al cargar pedidos");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await apiClient.get("/delivery/orders/history");
      setHistory(data);
    } catch {
      toast.error("Error al cargar historial");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(() => fetchOrders({ silent: true }), 30_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  function requestGps() {
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("ok");
      },
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  async function handleAction(orderId: string, newStatus: string) {
    if (newStatus === "delivered") {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setConfirmOrder(order);
        setGpsCoords(null);
        setGpsStatus("idle");
        requestGps();
      }
      return;
    }
    setUpdating(orderId);
    try {
      const res = await apiClient.patch(`/delivery/orders/${orderId}/status`, { status: newStatus });
      toast.success("¡Pedido despachado!");
      await fetchOrders();
      if (res.data?.buyer_wa_link) showWaToast(res.data.buyer_wa_link);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    } finally {
      setUpdating(null);
    }
  }

  function showWaToast(waUrl: string) {
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span className="text-sm font-medium">¿Notificar al cliente?</span>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
             onClick={() => toast.dismiss(t.id)}
             className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
             style={{ background: "var(--success)" }}>
            WhatsApp
          </a>
          <button onClick={() => toast.dismiss(t.id)}
                  className="text-xs" style={{ color: "var(--ink-3)" }}>Omitir</button>
        </span>
      ),
      { duration: 8000, icon: "💬" }
    );
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  function cancelConfirm() {
    setConfirmOrder(null);
    setProofFile(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
    setGpsCoords(null);
    setGpsStatus("idle");
    setPaymentCollected(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmDelivery() {
    if (!confirmOrder || !proofFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      const uploadRes = await apiClient.post(
        `/delivery/orders/${confirmOrder.id}/proof-photo`,
        formData,
      );
      const proofUrl: string = uploadRes.data.url;

      const res = await apiClient.patch(`/delivery/orders/${confirmOrder.id}/status`, {
        status: "delivered",
        proof_photo_url: proofUrl,
        lat: gpsCoords?.lat ?? null,
        lng: gpsCoords?.lng ?? null,
        payment_collected: paymentCollected,
      });

      toast.success("¡Entrega confirmada!");
      cancelConfirm();
      await fetchOrders();
      if (res.data?.buyer_wa_link) showWaToast(res.data.buyer_wa_link);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al confirmar entrega");
    } finally {
      setUploading(false);
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
        style={{ background: "var(--surface-0)", borderBottom: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
      >
        <div>
          <Logo size="sm" href="/delivery-app" />
          {storeName && (
            <p className="text-[10px] font-bold mt-0.5 truncate max-w-[140px]" style={{ color: "var(--accent-ink)" }}>
              {storeName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>{user?.full_name}</p>
            <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>Repartidor</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--danger-soft)", border: "1.5px solid var(--line-2)" }}
            aria-label="Cerrar sesión"
          >
            <LogOut size={15} style={{ color: "var(--danger)" }} />
          </button>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-5 rounded-2xl p-1" style={{ background: "var(--surface-2)" }}>
          <button
            onClick={() => setTab("active")}
            className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            style={tab === "active"
              ? { background: "var(--surface-0)", color: "var(--ink)", boxShadow: "var(--shadow-sm)" }
              : { color: "var(--ink-3)" }}
          >
            <Bike size={13} />
            Activos {orders.length > 0 && `(${orders.length})`}
          </button>
          <button
            onClick={() => setTab("history")}
            className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            style={tab === "history"
              ? { background: "var(--surface-0)", color: "var(--ink)", boxShadow: "var(--shadow-sm)" }
              : { color: "var(--ink-3)" }}
          >
            <History size={13} />
            Entregados
          </button>
        </div>

        {/* Stats strip — solo en tab activos */}
        {tab === "active" && <div className="flex gap-3 mb-5">
          <div className="flex-1 rounded-2xl p-3 text-center"
               style={{ background: "var(--accent-soft)", border: "1.5px solid var(--line-2)" }}>
            <p className="text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{preparing.length}</p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: "var(--accent-ink)" }}>Preparando</p>
          </div>
          <div className="flex-1 rounded-2xl p-3 text-center"
               style={{ background: "var(--surface-2)", border: "1.5px solid var(--line-2)" }}>
            <p className="text-2xl font-extrabold" style={{ color: "var(--ink)" }}>{on_the_way.length}</p>
            <p className="text-[11px] font-bold mt-0.5" style={{ color: "var(--ink-2)" }}>En camino</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            disabled={loading}
            className="w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--surface-2)", border: "1.5px solid var(--line-2)" }}
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} style={{ color: "var(--ink-3)" }} />
          </button>
        </div>}

        {/* ── Tab Activos ── */}
        {tab === "active" && <>

        {/* Empty state */}
        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: "var(--success-soft)" }}>
              <Package size={28} style={{ color: "var(--success)" }} />
            </div>
            <p className="font-bold" style={{ color: "var(--ink-2)" }}>Sin pedidos activos</p>
            <p className="text-sm mt-1" style={{ color: "var(--ink-4)" }}>Cuando haya pedidos listos aparecerán aquí.</p>
          </div>
        )}

        {/* Preparing */}
        {preparing.length > 0 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
              <h2 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--accent-ink)" }}>
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
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--ink-2)" }} />
              <h2 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--ink-2)" }}>
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

        </> /* fin tab activos */}

        {/* ── Tab Historial ── */}
        {tab === "history" && (
          <section>
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--surface-2)" }} />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                     style={{ background: "var(--success-soft)" }}>
                  <History size={28} style={{ color: "var(--success)" }} />
                </div>
                <p className="font-bold" style={{ color: "var(--ink-2)" }}>Sin entregas aún</p>
                <p className="text-sm mt-1" style={{ color: "var(--ink-4)" }}>Aquí aparecerán los pedidos que hayas entregado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((o) => (
                  <div key={o.id} className="rounded-2xl px-4 py-3 flex items-center justify-between"
                       style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
                    <div>
                      <p className="text-xs font-extrabold" style={{ color: "var(--success)" }}>
                        #{o.order_number}
                      </p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: "var(--ink)" }}>
                        {o.buyer_name}
                      </p>
                      {o.buyer_address && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>{o.buyer_address}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-display font-extrabold text-sm" style={{ color: "var(--ink)" }}>
                        {formatPrice(o.total_cents)}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                        {timeAgo(o.updated_at)}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <CheckCircle2 size={11} style={{ color: "var(--success)" }} />
                        <span className="text-[11px] font-bold" style={{ color: "var(--success)" }}>Entregado</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Proof photo modal */}
      {confirmOrder && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(20,19,15,.6)", backdropFilter: "blur(3px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) cancelConfirm(); }}
        >
          <div className="rounded-t-3xl p-5 space-y-4" style={{ background: "var(--surface-0)" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm" style={{ color: "var(--ink)" }}>
                  Confirmar entrega
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  #{confirmOrder.order_number} · {confirmOrder.buyer_name}
                </p>
              </div>
              <button
                onClick={cancelConfirm}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-2)" }}
              >
                <X size={16} style={{ color: "var(--ink-3)" }} />
              </button>
            </div>

            {/* Photo area */}
            {proofPreview ? (
              <div className="relative rounded-2xl overflow-hidden" style={{ height: 220 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofPreview}
                  alt="Foto de entrega"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => {
                    setProofFile(null);
                    URL.revokeObjectURL(proofPreview);
                    setProofPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(20,19,15,.6)" }}
                >
                  <X size={14} style={{ color: "#fff" }} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer"
                style={{
                  height: 180,
                  border: "2px dashed var(--line-2)",
                  background: "var(--surface-2)",
                }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                     style={{ background: "var(--accent-soft)" }}>
                  <Camera size={26} style={{ color: "var(--accent)" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: "var(--ink-2)" }}>Tomar foto de la entrega</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    Foto obligatoria para confirmar
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </label>
            )}

            {/* Payment confirmation */}
            {confirmOrder && (() => {
              const method = confirmOrder.payment_method;
              const isPrepaid = method === "transfer";
              const methodLabel: Record<string, string> = {
                cash: "💵 Efectivo (contra entrega)",
                yape: "💜 Yape",
                plin: "💚 Plin",
                transfer: "🏦 Transferencia (anticipado)",
                card: "💳 Tarjeta",
              };
              return (
                <div className="rounded-2xl p-3 space-y-2.5"
                     style={{ background: "var(--surface-2)", border: "1.5px solid var(--line-2)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "var(--ink-2)" }}>
                      {methodLabel[method] ?? method}
                    </span>
                    <span className="font-display font-extrabold text-sm" style={{ color: "var(--ink)" }}>
                      {formatPrice(confirmOrder.total_cents)}
                    </span>
                  </div>
                  {isPrepaid ? (
                    <p className="text-xs" style={{ color: "var(--success)" }}>
                      Pago anticipado — no necesitas cobrar en la entrega
                    </p>
                  ) : (
                    <>
                      <p className="text-xs font-medium" style={{ color: "var(--ink-3)" }}>
                        ¿Cobró el pago?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaymentCollected(true)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                          style={paymentCollected === true
                            ? { background: "var(--success-soft)", color: "var(--success)", border: "1.5px solid var(--line-2)" }
                            : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid var(--line-2)" }}
                        >
                          ✓ Sí, cobré
                        </button>
                        <button
                          onClick={() => setPaymentCollected(false)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                          style={paymentCollected === false
                            ? { background: "var(--danger-soft)", color: "var(--danger)", border: "1.5px solid var(--line-2)" }
                            : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid var(--line-2)" }}
                        >
                          ✗ No cobré
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* GPS status */}
            <div className="flex items-center gap-2 px-1">
              <MapPin size={13} style={{ color: gpsStatus === "ok" ? "var(--success)" : gpsStatus === "denied" ? "var(--ink-3)" : "var(--warn)", flexShrink: 0 }} />
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                {gpsStatus === "loading" && "Obteniendo ubicación…"}
                {gpsStatus === "ok"      && `Ubicación capturada (${gpsCoords!.lat.toFixed(5)}, ${gpsCoords!.lng.toFixed(5)})`}
                {gpsStatus === "denied"  && "Ubicación no disponible"}
                {gpsStatus === "idle"    && "Esperando GPS…"}
              </span>
              {gpsStatus === "denied" && (
                <button onClick={requestGps} className="text-xs font-bold ml-auto" style={{ color: "var(--accent-ink)" }}>
                  Reintentar
                </button>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={confirmDelivery}
              disabled={!proofFile || uploading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--success)", boxShadow: proofFile ? "var(--shadow-md)" : "none" }}
            >
              {uploading ? (
                <>
                  <Upload size={17} className="animate-bounce" />
                  Subiendo foto…
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  {proofFile ? "Confirmar entrega" : "Selecciona una foto primero"}
                </>
              )}
            </button>

            <button
              onClick={cancelConfirm}
              disabled={uploading}
              className="w-full py-3 rounded-xl font-medium text-sm"
              style={{ color: "var(--ink-3)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onAction, updating }: {
  order: DeliveryOrder;
  onAction: (id: string, status: string) => void;
  updating: boolean;
}) {
  const isPreparing  = order.status === "preparing";
  const accentColor  = isPreparing ? "var(--accent-ink)" : "var(--ink-2)";
  const accentSoft   = isPreparing ? "var(--accent-soft)" : "var(--surface-2)";

  const waLink = `https://wa.me/${order.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hola ${order.buyer_name}, te contacto sobre tu pedido #${order.order_number}.`
  )}`;

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}>
      {/* Strip */}
      <div className="flex items-center justify-between px-4 py-2.5"
           style={{ background: accentSoft, borderBottom: "1.5px solid var(--line-2)" }}>
        <span className="text-xs font-extrabold" style={{ color: accentColor }}>
          #{order.order_number}
        </span>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
          <Clock size={11} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {/* Buyer + contact */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
              {order.buyer_name}
            </p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--ink-3)" }}>
              {order.buyer_phone}
            </p>
          </div>
          <div className="flex gap-1.5">
            <a href={`tel:${order.buyer_phone}`}
               className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: "var(--success-soft)", border: "1.5px solid var(--line-2)" }}>
              <Phone size={15} style={{ color: "var(--success)" }} />
            </a>
            <a href={waLink} target="_blank" rel="noopener noreferrer"
               className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: "var(--success-soft)", border: "1.5px solid var(--line-2)" }}>
              <MessageCircle size={15} style={{ color: "var(--success)" }} />
            </a>
          </div>
        </div>

        {order.buyer_address && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2"
               style={{ background: "var(--surface-2)", border: "1px solid var(--line-2)" }}>
            <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--ink-3)" }} />
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>{order.buyer_address}</p>
              {order.buyer_reference && (
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>Ref: {order.buyer_reference}</p>
              )}
            </div>
          </div>
        )}

        {order.notes && (
          <p className="text-xs px-3 py-2 rounded-xl italic"
             style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--line-2)" }}>
            📝 {order.notes}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
                style={{
                  background: order.payment_method === "cash" ? "var(--warn-soft)" :
                              order.payment_method === "transfer" ? "var(--success-soft)" : "var(--accent-soft)",
                  color: order.payment_method === "cash" ? "var(--warn)" :
                         order.payment_method === "transfer" ? "var(--success)" : "var(--accent-ink)",
                }}>
            { order.payment_method === "cash"     ? "💵 Efectivo"
            : order.payment_method === "yape"     ? "💜 Yape"
            : order.payment_method === "plin"     ? "💚 Plin"
            : order.payment_method === "card"     ? "💳 Tarjeta"
            : "🏦 Transferencia" }
          </span>
          <span className="font-display font-extrabold text-sm" style={{ color: "var(--ink)" }}>
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
            style={{ background: "var(--ink)", boxShadow: "var(--shadow-md)" }}
          >
            <Bike size={17} />
            {updating ? "Procesando…" : "Salir a entregar"}
          </button>
        ) : (
          <button
            onClick={() => onAction(order.id, "delivered")}
            disabled={updating}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: "var(--success)", boxShadow: "var(--shadow-md)" }}
          >
            <CheckCircle2 size={17} />
            {updating ? "Procesando…" : "Confirmar entrega"}
          </button>
        )}
      </div>
    </div>
  );
}
