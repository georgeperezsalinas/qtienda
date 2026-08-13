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
  FlaskConical,
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
import { formatPrice, getStoreCurrency } from "@/lib/utils";
import { ConfirmModal } from "../_components/ConfirmModal";

interface StoreItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  is_test: boolean;
  city: string | null;
  country?: string | null;
  currency?: string | null;
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  products_count: number;
  orders_count: number;
  revenue_cents: number;
  reactivation_requested_at?: string | null;
}

interface StoreDetail extends StoreItem {
  country: string;
  currency?: string | null;
  whatsapp: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  reactivation_requested_at: string | null;
  reactivation_message: string | null;
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
  { key: "sin-productos", label: "Sin productos" },
  { key: "test", label: "Prueba" },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  active: { bg: "var(--success-soft)", color: "var(--success)", dot: "var(--success)", label: "Activa" },
  pending: { bg: "var(--warn-soft)", color: "var(--warn)", dot: "var(--warn)", label: "Pendiente" },
  suspended: { bg: "var(--danger-soft)", color: "var(--danger)", dot: "var(--danger)", label: "Suspendida" },
  banned: { bg: "var(--surface-2)", color: "var(--ink-3)", dot: "var(--ink-3)", label: "Baneada" },
};

function Skel({ h = 24 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

function TestBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
    >
      <FlaskConical size={10} />
      Prueba
    </span>
  );
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
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const status = searchParams.get("status") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const q = searchParams.get("q") ?? "";

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page, limit: 20 };
      if (status === "test") params.is_test = true;
      else if (status === "sin-productos") params.has_products = false;
      else if (status) params.status = status;
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
      setSuspendTarget(null);
    }
  }

  async function rejectReactivation(id: string) {
    setActing(id);
    try {
      await apiClient.post(`/admin/stores/${id}/reject-reactivation`);
      toast.success("Solicitud descartada");
      await fetchStores();
      if (detail?.id === id) await loadDetail(id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo descartar");
    } finally {
      setActing(null);
    }
  }

  async function markTest(id: string, isTest: boolean) {
    setActing(id);
    try {
      await apiClient.post(`/admin/stores/${id}/mark-test`, { is_test: isTest });
      toast.success(isTest ? "Marcada como prueba" : "Marca de prueba retirada");
      await fetchStores();
      if (detail?.id === id) await loadDetail(id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo actualizar");
    } finally {
      setActing(null);
    }
  }

  async function deleteStore(id: string, reason: string) {
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
      setDeleteTarget(null);
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
          style={{ background: "var(--surface-0)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)" }}>Productos</p>
          <p className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>{totals.products}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)" }}>Pedidos</p>
          <p className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>{totals.orders}</p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
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
                : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid var(--line-2)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skel key={i} h={118} />)}
        </div>
      ) : stores.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
          <Store size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
            No hay tiendas {activeTab.label !== "Todas" ? activeTab.label.toLowerCase() : ""}
          </p>
        </div>
      ) : (
        <>
        {/* Tarjetas — móvil/tablet */}
        <div className="lg:hidden space-y-3">
          {stores.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl p-4"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-lg text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-ink))" }}
                >
                  {s.name[0]?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm truncate" style={{ color: "var(--ink)" }}>
                      {s.name}
                    </p>
                    <StatusBadge status={s.status} />
                    {s.is_test && <TestBadge />}
                    {s.reactivation_requested_at && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                        Pidió reactivación
                      </span>
                    )}
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
                  <p className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{formatPrice(s.revenue_cents, getStoreCurrency(s).code, getStoreCurrency(s).locale)}</p>
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
                  href={`https://${s.slug}.qtienda.shop/`}
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
                    style={{ background: "var(--success-soft)", color: "var(--success)" }}
                  >
                    <CheckCircle2 size={13} />
                    Activar
                  </button>
                )}
                {s.status !== "suspended" && s.status !== "banned" && (
                  <button
                    disabled={acting === s.id}
                    onClick={() => setSuspendTarget(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                  >
                    <PauseCircle size={13} />
                    Suspender
                  </button>
                )}
                <button
                  disabled={acting === s.id}
                  onClick={() => markTest(s.id, !s.is_test)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                >
                  <FlaskConical size={13} />
                  {s.is_test ? "Quitar prueba" : "Marcar prueba"}
                </button>
                <button
                  disabled={acting === s.id}
                  onClick={() => setDeleteTarget(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                >
                  <Trash2 size={13} />
                  Eliminar prueba
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla — escritorio */}
        <div
          className="hidden lg:block rounded-2xl overflow-x-auto"
          style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
        >
          <table className="w-full text-sm" style={{ minWidth: 880 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Tienda</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Dueño</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Estado</th>
                <th className="text-right font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Productos</th>
                <th className="text-right font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Pedidos</th>
                <th className="text-right font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Ventas</th>
                <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Creada</th>
                <th className="text-right font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-ink))" }}
                      >
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold truncate max-w-[160px]" style={{ color: "var(--ink)" }}>{s.name}</p>
                          {s.is_test && <TestBadge />}
                        </div>
                        <p className="text-xs truncate max-w-[180px]" style={{ color: "var(--ink-4)" }}>
                          /{s.slug} · {s.city ?? "sin ciudad"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate max-w-[160px]" style={{ color: "var(--ink-2)" }}>{s.owner_name ?? "Sin dueño"}</p>
                    <p className="text-xs truncate max-w-[180px]" style={{ color: "var(--ink-4)" }}>{s.owner_email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={s.status} />
                      {s.reactivation_requested_at && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                          Pidió reactivación
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--ink)" }}>{s.products_count}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--ink)" }}>{s.orders_count}</td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap" style={{ color: "var(--ink)" }}>{formatPrice(s.revenue_cents, getStoreCurrency(s).code, getStoreCurrency(s).locale)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--ink-3)" }}>{datePE(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Ver detalle"
                        onClick={() => loadDetail(s.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--brand-50)", color: "var(--brand-700)" }}
                      >
                        <Eye size={13} />
                      </button>
                      <a
                        title="Ver tienda pública"
                        href={`https://${s.slug}.qtienda.shop/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                      >
                        <ExternalLink size={13} />
                      </a>
                      {s.status !== "active" ? (
                        <button
                          title="Activar"
                          disabled={acting === s.id}
                          onClick={() => approve(s.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                          style={{ background: "var(--success-soft)", color: "var(--success)" }}
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      ) : (
                        <button
                          title="Suspender"
                          disabled={acting === s.id}
                          onClick={() => setSuspendTarget(s)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                        >
                          <PauseCircle size={13} />
                        </button>
                      )}
                      <button
                        title={s.is_test ? "Quitar marca de prueba" : "Marcar como prueba"}
                        disabled={acting === s.id}
                        onClick={() => markTest(s.id, !s.is_test)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                      >
                        <FlaskConical size={13} />
                      </button>
                      <button
                        title="Eliminar tienda de prueba"
                        disabled={acting === s.id}
                        onClick={() => setDeleteTarget(s)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                        style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
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
                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: detail.primary_color || "var(--brand-600)" }}>
                      {detail.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold" style={{ color: "var(--ink)" }}>{detail.name}</p>
                        <StatusBadge status={detail.status} />
                        {detail.is_test && <TestBadge />}
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
                  <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
                    <Package size={15} style={{ color: "var(--brand-600)" }} />
                    <p className="text-lg font-bold mt-1">{detail.product_count}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>productos</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
                    <ShoppingBag size={15} style={{ color: "var(--brand-600)" }} />
                    <p className="text-lg font-bold mt-1">{detail.order_count}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>pedidos</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
                    <Store size={15} style={{ color: "var(--brand-600)" }} />
                    <p className="text-lg font-bold mt-1">{formatPrice(detail.revenue_cents, getStoreCurrency(detail).code, getStoreCurrency(detail).locale)}</p>
                    <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>ventas</p>
                  </div>
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={15} style={{ color: "var(--ink-3)" }} />
                    <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Dueño</p>
                  </div>
                  <p className="text-sm font-semibold">{detail.owner?.full_name ?? "Sin dueño"}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>{detail.owner?.email ?? "sin email"}</p>
                  {detail.owner?.phone && <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>{detail.owner.phone}</p>}
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
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
                          <p className="font-bold">{formatPrice(p.price_cents, getStoreCurrency(detail).code, getStoreCurrency(detail).locale)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
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
                          <p className="font-bold">{formatPrice(o.total_cents, getStoreCurrency(detail).code, getStoreCurrency(detail).locale)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detail.reactivation_requested_at && (
                  <div className="rounded-2xl p-4" style={{ background: "var(--danger-soft)", border: "1.5px solid var(--line-2)" }}>
                    <p className="text-sm font-bold mb-1" style={{ color: "var(--danger)" }}>
                      Solicitud de reactivación · {datePE(detail.reactivation_requested_at)}
                    </p>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--ink-2)" }}>
                      {detail.reactivation_message || "(sin mensaje)"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => approve(detail.id)}
                        disabled={acting === detail.id}
                        className="btn-primary justify-center text-sm disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} /> Aprobar y reactivar
                      </button>
                      <button
                        onClick={() => rejectReactivation(detail.id)}
                        disabled={acting === detail.id}
                        className="btn-secondary justify-center text-sm disabled:opacity-50"
                      >
                        <X size={15} /> Rechazar
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl p-4" style={{ background: "var(--warn-soft)", border: "1.5px solid var(--line-2)" }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} style={{ color: "var(--warn)", marginTop: 2 }} />
                    <p className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      Para tiendas de prueba, usa eliminar solo cuando estés seguro. La acción es soft delete y queda registrada en auditoría.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pb-4">
                  <a href={`https://${detail.slug}.qtienda.shop/`} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center text-sm">
                    <ExternalLink size={15} />
                    Ver pública
                  </a>
                  {detail.status !== "active" ? (
                    <button onClick={() => approve(detail.id)} disabled={acting === detail.id} className="btn-primary justify-center text-sm disabled:opacity-50">
                      <CheckCircle2 size={15} />
                      Activar
                    </button>
                  ) : (
                    <button onClick={() => setSuspendTarget(detail)} disabled={acting === detail.id} className="btn-secondary justify-center text-sm disabled:opacity-50">
                      <PauseCircle size={15} />
                      Suspender
                    </button>
                  )}
                  <button
                    onClick={() => markTest(detail.id, !detail.is_test)}
                    disabled={acting === detail.id}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                  >
                    <FlaskConical size={15} />
                    {detail.is_test ? "Quitar marca de prueba" : "Marcar como prueba"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(detail)}
                    disabled={acting === detail.id}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
                    style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
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

      <ConfirmModal
        open={!!suspendTarget}
        variant="danger"
        title="Suspender tienda"
        message={suspendTarget && <>&quot;{suspendTarget.name}&quot; dejará de estar operativa para el público hasta que la reactives.</>}
        confirmLabel="Suspender"
        loading={!!suspendTarget && acting === suspendTarget.id}
        onCancel={() => setSuspendTarget(null)}
        onConfirm={() => suspendTarget && suspend(suspendTarget.id)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        variant="danger"
        title="Eliminar tienda de prueba"
        message={deleteTarget && <>Se ocultará &quot;{deleteTarget.name}&quot; con soft delete (no se borra físicamente) y quedará registrado en auditoría.</>}
        confirmLabel="Eliminar tienda"
        reasonLabel="Motivo"
        reasonPlaceholder="Tienda de prueba marcha blanca"
        typedConfirmText="DELETE"
        loading={!!deleteTarget && acting === deleteTarget.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(reason) => deleteTarget && deleteStore(deleteTarget.id, reason)}
      />
    </div>
  );
}
