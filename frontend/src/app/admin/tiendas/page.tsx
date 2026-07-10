"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Eye,
  ExternalLink,
  Package,
  PauseCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface StoreItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  city: string | null;
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  products_count: number;
  orders_count: number;
  revenue_cents: number;
}

interface StoreDetail extends StoreItem {
  country: string;
  whatsapp: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  order_count: number;
  product_count: number;
  revenue_cents: number;
  owner: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    is_active: boolean;
  } | null;
  settings: {
    accept_cash: boolean;
    accept_yape: boolean;
    accept_plin: boolean;
    accept_transfer: boolean;
    accept_card: boolean;
    delivery_fee_cents: number;
    min_order_cents: number;
  } | null;
  products: {
    id: string;
    name: string;
    status: string;
    price_cents: number;
    stock: number | null;
    created_at: string;
  }[];
  recent_orders: {
    id: string;
    order_number: string;
    status: string;
    buyer_name: string;
    total_cents: number;
    created_at: string;
  }[];
}

interface StoresResponse {
  total: number;
  page: number;
  pages: number;
  items: StoreItem[];
}

const STATUS_TABS = [
  { key: "", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "active", label: "Activas" },
  { key: "suspended", label: "Suspendidas" },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  active: { bg: "#D1FAE5", color: "#065F46", dot: "#10B981", label: "Activa" },
  pending: { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B", label: "Pendiente" },
  suspended: { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444", label: "Suspendida" },
  banned: { bg: "#F3F4F6", color: "#374151", dot: "#6B7280", label: "Baneada" },
};

function Skel({ h = 24 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: st.bg, color: st.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
      {st.label}
    </span>
  );
}

function datePE(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminTiendasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoreDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const status = searchParams.get("status") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const q = searchParams.get("q") ?? "";

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (status) params.status = status;
      if (q) params.q = q;
      const { data } = await apiClient.get<StoresResponse>("/admin/stores", { params });
      setStores(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [status, page, q]);

  useEffect(() => {
    setQuery(q);
    fetchStores();
  }, [q, fetchStores]);

  function setFilter(key: string) {
    const params = new URLSearchParams();
    if (key) params.set("status", key);
    if (q) params.set("q", q);
    params.set("page", "1");
    router.push(`/admin/tiendas?${params.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    params.set("page", "1");
    router.push(`/admin/tiendas?${params.toString()}`);
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/admin/tiendas?${params.toString()}`);
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const { data } = await apiClient.get<StoreDetail>(`/admin/stores/${id}`);
      setDetail(data);
    } catch {
      toast.error("No se pudo cargar la tienda");
    } finally {
      setDetailLoading(false);
    }
  }

  async function approve(id: string) {
    setActing(id);
    try {
      await apiClient.post(`/admin/stores/${id}/approve`);
      toast.success("Tienda activada");
      await fetchStores();
      if (detail?.id === id) await loadDetail(id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo activar");
    } finally {
      setActing(null);
    }
  }

  async function suspend(id: string) {
    if (!window.confirm("¿Suspender esta tienda? Dejará de estar operativa para el público.")) return;
    setActing(id);
    try {
      await apiClient.post(`/admin/stores/${id}/suspend`);
      toast.success("Tienda suspendida");
      await fetchStores();
      if (detail?.id === id) await loadDetail(id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo suspender");
    } finally {
      setActing(null);
    }
  }

  async function deleteStore(id: string, name: string) {
    const reason = window.prompt(
      `Eliminar tienda de prueba: ${name}\n\nEscribe el motivo. La tienda se ocultará con soft delete y quedará auditada.`
    );
    if (reason === null) return;
    const confirmText = window.prompt("Para confirmar escribe DELETE");
    if (confirmText !== "DELETE") {
      toast.error("Eliminación cancelada");
      return;
    }
    setActing(id);
    try {
      await apiClient.delete(`/admin/stores/${id}`, {
        data: { confirm: "DELETE", reason: reason.trim() || "Tienda de prueba marcha blanca" },
      });
      toast.success("Tienda eliminada de la vista pública");
      setDetail(null);
      await fetchStores();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo eliminar");
    } finally {
      setActing(null);
    }
  }

  const activeTab = STATUS_TABS.find((t) => t.key === status) ?? STATUS_TABS[0];
  const totals = stores.reduce(
    (acc, s) => ({
      products: acc.products + (s.products_count || 0),
      orders: acc.orders + (s.orders_count || 0),
      revenue: acc.revenue + (s.revenue_cents || 0),
    }),
    { products: 0, orders: 0, revenue: 0 }
  );

  return (
    <div className="max-w-5xl mx-auto px-5 py-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="eyebrow">Marcha blanca</p>
          <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
            Tiendas creadas
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
            {total} tienda{total !== 1 ? "s" : ""} {activeTab.label !== "Todas" ? activeTab.label.toLowerCase() : "registradas"}
          </p>
        </div>
        <button
          onClick={fetchStores}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "var(--surface-0)", color: "var(--ink-2)", border: "1.5px solid #E2E8F0" }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)" }}>Productos</p>
          <p className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>{totals.products}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)" }}>Pedidos</p>
          <p className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>{totals.orders}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)" }}>Ventas</p>
          <p className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>{formatPrice(totals.revenue)}</p>
        </div>
      </div>

      <form onSubmit={submitSearch} className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9 pr-3 py-2.5"
          placeholder="Buscar por tienda, slug o ciudad"
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
                : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid #E2E8F0" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(5)].map((_, i) => <Skel key={i} h={118} />)
        ) : stores.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
            <Store size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
              No hay tiendas {activeTab.label !== "Todas" ? activeTab.label.toLowerCase() : ""}
            </p>
          </div>
        ) : (
          stores.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl p-4"
              style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-lg text-white flex-shrink-0"
                  style={{ background: "var(--brand-600)" }}
                >
                  {s.name[0]?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm truncate" style={{ color: "var(--ink)" }}>
                      {s.name}
                    </p>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
                    {s.owner_name ?? "Sin dueño"} · {s.owner_email ?? "sin email"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                    /{s.slug} · {s.city ?? "sin ciudad"} · {datePE(s.created_at)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="rounded-xl p-2" style={{ background: "var(--surface-2)" }}>
                  <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>Productos</p>
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{s.products_count}</p>
                </div>
                <div className="rounded-xl p-2" style={{ background: "var(--surface-2)" }}>
                  <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>Pedidos</p>
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{s.orders_count}</p>
                </div>
                <div className="rounded-xl p-2" style={{ background: "var(--surface-2)" }}>
                  <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>Ventas</p>
                  <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{formatPrice(s.revenue_cents)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => loadDetail(s.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--brand-50)", color: "var(--brand-700)" }}
                >
                  <Eye size={13} />
                  Ver detalle
                </button>
                <a
                  href={`/tienda/${s.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                >
                  <ExternalLink size={13} />
                  Pública
                </a>
                {s.status !== "active" && (
                  <button
                    disabled={acting === s.id}
                    onClick={() => approve(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ background: "#D1FAE5", color: "#065F46" }}
                  >
                    <CheckCircle2 size={13} />
                    Activar
                  </button>
                )}
                {s.status !== "suspended" && s.status !== "banned" && (
                  <button
                    disabled={acting === s.id}
                    onClick={() => suspend(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ background: "#FEF3C7", color: "#92400E" }}
                  >
                    <PauseCircle size={13} />
                    Suspender
                  </button>
                )}
                <button
                  disabled={acting === s.id}
                  onClick={() => deleteStore(s.id, s.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{ background: "#FEE2E2", color: "#991B1B" }}
                >
                  <Trash2 size={13} />
                  Eliminar prueba
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
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
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
          >
            <ChevronRightIcon size={16} style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
      )}

      {(detail || detailLoading) && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDetail(null)} />
          <aside
            className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto z-50 md:w-[460px] max-h-[90dvh] md:max-h-none overflow-y-auto"
            style={{ background: "var(--bg)", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
              <div>
                <p className="eyebrow">Detalle tienda</p>
                <h2 className="font-display font-extrabold text-lg" style={{ color: "var(--ink)" }}>
                  {detail?.name ?? "Cargando..."}
                </h2>
              </div>
              <button onClick={() => setDetail(null)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-0)" }}>
                <X size={17} />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="p-5 space-y-3">
                <Skel h={90} />
                <Skel h={120} />
                <Skel h={160} />
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: detail.primary_color || "var(--brand-600)" }}>
                      {detail.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold" style={{ color: "var(--ink)" }}>{detail.name}</p>
                        <StatusBadge status={detail.status} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>
                        /{detail.slug} · creada {datePE(detail.created_at)}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>
                        {detail.description || "Sin descripción"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                    <Package size={15} style={{ color: "var(--brand-600)" }} />
                    <p className="text-lg font-bold mt-1">{detail.product_count}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>productos</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                    <ShoppingBag size={15} style={{ color: "var(--brand-600)" }} />
                    <p className="text-lg font-bold mt-1">{detail.order_count}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>pedidos</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                    <Store size={15} style={{ color: "var(--brand-600)" }} />
                    <p className="text-lg font-bold mt-1">{formatPrice(detail.revenue_cents)}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>ventas</p>
                  </div>
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={15} style={{ color: "var(--ink-3)" }} />
                    <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Dueño</p>
                  </div>
                  <p className="text-sm font-semibold">{detail.owner?.full_name ?? "Sin dueño"}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>{detail.owner?.email ?? "sin email"}</p>
                  {detail.owner?.phone && <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>{detail.owner.phone}</p>}
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                  <p className="text-sm font-bold mb-3" style={{ color: "var(--ink)" }}>Productos recientes</p>
                  {detail.products.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--ink-3)" }}>La tienda todavía no tiene productos.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{p.name}</p>
                            <p style={{ color: "var(--ink-3)" }}>{p.status} · stock {p.stock ?? "sin control"}</p>
                          </div>
                          <p className="font-bold">{formatPrice(p.price_cents)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}>
                  <p className="text-sm font-bold mb-3" style={{ color: "var(--ink)" }}>Pedidos recientes</p>
                  {detail.recent_orders.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--ink-3)" }}>Sin pedidos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.recent_orders.map((o) => (
                        <div key={o.id} className="flex items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-semibold">#{o.order_number} · {o.buyer_name}</p>
                            <p style={{ color: "var(--ink-3)" }}>{o.status} · {datePE(o.created_at)}</p>
                          </div>
                          <p className="font-bold">{formatPrice(o.total_cents)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-4" style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} style={{ color: "#B45309", marginTop: 2 }} />
                    <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>
                      Para tiendas de prueba, usa eliminar solo cuando estés seguro. La acción es soft delete y queda registrada en auditoría.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pb-4">
                  <a href={`/tienda/${detail.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center text-sm">
                    <ExternalLink size={15} />
                    Ver pública
                  </a>
                  {detail.status !== "active" ? (
                    <button onClick={() => approve(detail.id)} disabled={acting === detail.id} className="btn-primary justify-center text-sm disabled:opacity-50">
                      <CheckCircle2 size={15} />
                      Activar
                    </button>
                  ) : (
                    <button onClick={() => suspend(detail.id)} disabled={acting === detail.id} className="btn-secondary justify-center text-sm disabled:opacity-50">
                      <PauseCircle size={15} />
                      Suspender
                    </button>
                  )}
                  <button
                    onClick={() => deleteStore(detail.id, detail.name)}
                    disabled={acting === detail.id}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
                    style={{ background: "#FEE2E2", color: "#991B1B" }}
                  >
                    <Trash2 size={15} />
                    Eliminar tienda de prueba
                  </button>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
