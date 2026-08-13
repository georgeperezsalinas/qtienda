"use client";

// Campanita de notificaciones del admin — mismo patrón que
// components/ui/NotificationBell.tsx (vendedor), pero contra el inbox
// global de admin (/admin/notifications, sin store_id) y con la paleta
// --brand-* que usa el resto del panel /admin.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

export default function AdminNotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function fetchNotifications() {
    apiClient
      .get("/admin/notifications/")
      .then(({ data }) => {
        setItems(data.items ?? []);
        setUnreadCount(data.unread_count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    fetchNotifications();
    // Polling — el admin no siempre tiene la pestaña activa, y estos eventos
    // (reactivación, reclamos, pagos) necesitan que se note pronto.
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      if (!v) fetchNotifications();
      return !v;
    });
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiClient.post("/admin/notifications/read-all");
    } catch {
      // best-effort
    }
  }

  async function handleClick(n: AdminNotifItem) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      setUnreadCount((c) => Math.max(0, c - 1));
      apiClient.post(`/admin/notifications/${n.id}/read`).catch(() => {});
    }
    if (n.action_url) router.push(n.action_url);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={toggleOpen}
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 34, height: 34, background: "var(--surface-0)", border: "1px solid var(--line)" }}
        aria-label="Notificaciones"
      >
        <Bell size={16} strokeWidth={1.7} style={{ color: "var(--ink-2)" }} />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-full font-bold"
            style={{
              top: -3, right: -3, minWidth: 16, height: 16, padding: "0 3px",
              background: "var(--danger)", color: "#fff", fontSize: 9,
              border: "2px solid var(--surface-0)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="animate-fade-in"
          style={{
            position: "absolute",
            top: 42,
            right: 0,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--surface-0)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            boxShadow: "var(--shadow-lg)",
            zIndex: 60,
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}
          >
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
              Notificaciones
            </p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold" style={{ color: "var(--brand-600)" }}>
                Marcar todas leídas
              </button>
            )}
          </div>

          {!loaded ? (
            <div className="text-xs text-center" style={{ padding: 24, color: "var(--ink-3)" }}>
              Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="text-xs text-center" style={{ padding: 24, color: "var(--ink-3)" }}>
              Sin notificaciones pendientes
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="w-full text-left flex items-start gap-2.5"
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--line)",
                  background: n.read ? "transparent" : "var(--brand-50)",
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{n.icon ?? "🔔"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                    {n.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-2)" }}>
                    {n.body}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read && (
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: 6, height: 6, background: "var(--brand-600)", marginTop: 4 }}
                  />
                )}
              </button>
            ))
          )}

          <a
            href="/admin/notificaciones"
            className="block text-center text-xs font-semibold"
            style={{ padding: "10px 14px", color: "var(--brand-600)" }}
          >
            Ver todas
          </a>
        </div>
      )}
    </div>
  );
}
