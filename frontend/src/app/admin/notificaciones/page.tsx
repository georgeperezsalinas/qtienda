"use client";

// Mismo patrón que dashboard/notificaciones/page.tsx (vendedor), contra el
// inbox global de admin (/admin/notifications, sin store_id).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Bell } from "lucide-react";
import { apiClient } from "@/lib/api";

interface AdminNotifItem {
  id: number;
  type: string;
  title: string;
  body: string;
  icon: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminNotificacionesPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((beforeId?: number) => {
    const setBusy = beforeId ? setLoadingMore : setLoading;
    setBusy(true);
    apiClient
      .get("/admin/notifications/", { params: beforeId ? { before_id: beforeId, limit: 20 } : { limit: 20 } })
      .then(({ data }) => {
        const newItems: AdminNotifItem[] = data.items ?? [];
        setItems((prev) => (beforeId ? [...prev, ...newItems] : newItems));
        setHasMore(newItems.length === 20);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(n: AdminNotifItem) {
    if (!n.read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      apiClient.post(`/admin/notifications/${n.id}/read`).catch(() => {});
    }
    if (n.action_url) router.push(n.action_url);
  }

  return (
    <div className="px-5 md:px-8 py-5 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} style={{ color: "var(--brand-600)" }} />
        <h1 className="font-display font-bold text-xl lg:text-2xl" style={{ color: "var(--ink)" }}>
          Notificaciones
        </h1>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 14 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center" style={{ padding: 32, background: "var(--surface-0)", border: "1px solid var(--line)", borderRadius: 16 }}>
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Sin notificaciones pendientes.
          </p>
        </div>
      ) : (
        <div style={{ background: "var(--surface-0)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
          {items.map((n, i) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="w-full text-left flex items-start gap-3"
              style={{
                padding: "14px 16px",
                borderTop: i === 0 ? "0" : "1px solid var(--line)",
                background: n.read ? "transparent" : "var(--brand-50)",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{n.icon ?? "🔔"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {n.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                  {n.body}
                </p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-3)" }}>
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {!n.read && (
                <span
                  className="rounded-full flex-shrink-0"
                  style={{ width: 7, height: 7, background: "var(--brand-600)", marginTop: 5 }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && hasMore && items.length > 0 && (
        <button
          onClick={() => load(items[items.length - 1].id)}
          disabled={loadingMore}
          className="w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            padding: "10px",
            borderRadius: 12,
            background: "var(--surface-0)",
            border: "1px solid var(--line)",
            color: "var(--ink-2)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {loadingMore ? <RefreshCw size={14} className="animate-spin" /> : null}
          Cargar más
        </button>
      )}
    </div>
  );
}
