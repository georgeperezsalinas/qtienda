"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, PauseCircle, ChevronLeft, ChevronRight as ChevronRightIcon, Store } from "lucide-react";
import { apiClient } from "@/lib/api";

interface StoreItem {
  id:          string;
  slug:        string;
  name:        string;
  status:      string;
  city:        string | null;
  created_at:  string;
  owner_email: string | null;
  owner_name:  string | null;
}

interface StoresResponse {
  total: number;
  page:  number;
  pages: number;
  items: StoreItem[];
}

const STATUS_TABS = [
  { key: "",          label: "Todas"      },
  { key: "pending",   label: "Pendientes" },
  { key: "active",    label: "Activas"    },
  { key: "suspended", label: "Suspendidas"},
];

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  active:    { bg: "#D1FAE5", color: "#065F46", dot: "#10B981", label: "Activa"     },
  pending:   { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B", label: "Pendiente"  },
  suspended: { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444", label: "Suspendida" },
  banned:    { bg: "#F3F4F6", color: "#374151", dot: "#6B7280", label: "Baneada"    },
};

function Skel({ h = 24 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

export default function AdminTiendasPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [stores,  setStores]  = useState<StoreItem[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);

  const status = searchParams.get("status") ?? "";
  const page   = Number(searchParams.get("page") ?? "1");

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (status) params.status = status;
      const { data } = await apiClient.get<StoresResponse>("/admin/stores", { params });
      setStores(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  function setFilter(key: string) {
    const params = new URLSearchParams();
    if (key) params.set("status", key);
    params.set("page", "1");
    router.push(`/admin/tiendas?${params.toString()}`);
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/admin/tiendas?${params.toString()}`);
  }

  async function approve(id: string) {
    setActing(id);
    try {
      await apiClient.post(`/admin/stores/${id}/approve`);
      await fetchStores();
    } finally {
      setActing(null);
    }
  }

  async function suspend(id: string) {
    setActing(id);
    try {
      await apiClient.post(`/admin/stores/${id}/suspend`);
      await fetchStores();
    } finally {
      setActing(null);
    }
  }

  const activeTab = STATUS_TABS.find((t) => t.key === status) ?? STATUS_TABS[0];

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

      <div>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Tiendas
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          {total} tienda{total !== 1 ? "s" : ""} {activeTab.label !== "Todas" ? activeTab.label.toLowerCase() : "registradas"}
        </p>
      </div>

      {/* Tabs */}
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

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(5)].map((_, i) => <Skel key={i} h={96} />)
        ) : stores.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
          >
            <Store size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
              No hay tiendas {activeTab.label !== "Todas" ? activeTab.label.toLowerCase() : ""}
            </p>
          </div>
        ) : (
          stores.map((s) => {
            const st = STATUS_STYLES[s.status] ?? STATUS_STYLES.pending;
            return (
              <div
                key={s.id}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
              >
                {/* Initials */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-lg text-white flex-shrink-0"
                  style={{ background: "var(--brand-600)" }}
                >
                  {s.name[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                      {s.name}
                    </p>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
                    {s.owner_email ?? "sin dueño"} {s.city ? `· ${s.city}` : ""}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                    /{s.slug} · {new Date(s.created_at).toLocaleDateString("es-PE")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {s.status !== "active" && (
                    <button
                      disabled={acting === s.id}
                      onClick={() => approve(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: "#D1FAE5", color: "#065F46" }}
                    >
                      <CheckCircle2 size={13} />
                      Aprobar
                    </button>
                  )}
                  {s.status !== "suspended" && s.status !== "banned" && (
                    <button
                      disabled={acting === s.id}
                      onClick={() => suspend(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: "#FEE2E2", color: "#991B1B" }}
                    >
                      <PauseCircle size={13} />
                      Suspender
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
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

    </div>
  );
}
