"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { apiClient } from "@/lib/api";
import { syncAppBadge } from "@/lib/pwa";

interface NotifItem {
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

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function fetchNotifications() {
    apiClient
      .get("/notifications/")
      .then(({ data }) => {
        setItems(data.items ?? []);
        setUnreadCount(data.unread_count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    syncAppBadge(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      if (!v) fetchNotifications(); // refresca al abrir
      return !v;
    });
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiClient.post("/notifications/read-all");
    } catch {
      // best-effort
    }
  }

  async function handleClick(n: NotifItem) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      setUnreadCount((c) => Math.max(0, c - 1));
      apiClient.post(`/notifications/${n.id}/read`).catch(() => {});
    }
    if (n.action_url) router.push(n.action_url);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={toggleOpen}
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 36, height: 36, background: "var(--surface)", border: "1px solid var(--line)" }}
        aria-label="Notificaciones"
      >
        <Bell size={16} strokeWidth={1.7} style={{ color: "var(--ink-2)" }} />
        {unreadCount > 0 && (
          <span
            className="absolute rounded-full"
            style={{ top: 8, right: 8, width: 7, height: 7, background: "var(--accent)", border: "2px solid var(--bg)" }}
          />
        )}
      </button>

      {open && (
        <div
          className="card animate-fade-in"
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: 420,
            overflowY: "auto",
            padding: 0,
            zIndex: 50,
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              Notificaciones
            </p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium" style={{ color: "var(--accent)" }}>
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
              Todavía no tienes notificaciones
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
                  background: n.read ? "transparent" : "var(--accent-soft)",
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{n.icon ?? "🔔"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
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
                    style={{ width: 6, height: 6, background: "var(--accent)", marginTop: 4 }}
                  />
                )}
              </button>
            ))
          )}

          <a
            href="/dashboard/notificaciones"
            className="block text-center text-xs font-medium"
            style={{ padding: "10px 14px", color: "var(--accent)" }}
          >
            Ver todas
          </a>
        </div>
      )}
    </div>
  );
}
