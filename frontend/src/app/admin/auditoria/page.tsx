"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ScrollText, ChevronLeft, ChevronRight as ChevronRightIcon, Store, User } from "lucide-react";
import { apiClient } from "@/lib/api";

interface AuditLogItem {
  id: number;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  admin: { name: string; email: string } | null;
  store: { name: string; slug: string } | null;
}

interface AuditLogResponse {
  total: number;
  page: number;
  pages: number;
  items: AuditLogItem[];
}

const ENTITY_TABS = [
  { key: "", label: "Todos" },
  { key: "stores", label: "Tiendas" },
  { key: "users", label: "Usuarios" },
  { key: "orders", label: "Pedidos" },
  { key: "plan_payment_requests", label: "Pagos" },
];

const ACTION_LABELS: Record<string, string> = {
  "store.approved": "Aprobó tienda",
  "store.suspended": "Suspendió tienda",
  "store.marked_test": "Marcó tienda como prueba",
  "store.unmarked_test": "Quitó marca de prueba",
  "store.soft_deleted": "Eliminó tienda (soft delete)",
  "plan_payment.approved": "Aprobó pago de plan",
  "plan_payment.rejected": "Rechazó pago de plan",
  "order.status_change": "Cambió estado de pedido",
  "user.activated": "Activó usuario",
  "user.suspended": "Suspendió usuario",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function summarizeChange(oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) {
  if (!newValue) return null;
  const keys = Object.keys(newValue).filter((k) => k !== "reason");
  const parts = keys.map((k) => {
    const before = oldValue?.[k];
    const after = newValue[k];
    if (before === undefined || before === after) return `${k}: ${String(after)}`;
    return `${k}: ${String(before)} → ${String(after)}`;
  });
  const reason = newValue.reason ? ` · Motivo: ${newValue.reason}` : "";
  return parts.join(", ") + reason;
}

function dateTimePE(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Skel({ h = 24 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

export default function AdminAuditoriaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const entity = searchParams.get("entity") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 30 };
      if (entity) params.entity = entity;
      const { data } = await apiClient.get<AuditLogResponse>("/admin/audit-logs", { params });
      setLogs(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [entity, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function setFilter(key: string) {
    const params = new URLSearchParams();
    if (key) params.set("entity", key);
    params.set("page", "1");
    router.push(`/admin/auditoria?${params.toString()}`);
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/admin/auditoria?${params.toString()}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

      <div>
        <p className="eyebrow">Trazabilidad</p>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Auditoría
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          {total === 1 ? "1 acción registrada" : `${total} acciones registradas`}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {ENTITY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={
              entity === t.key
                ? { background: "var(--brand-600)", color: "#fff" }
                : { background: "var(--surface-0)", color: "var(--ink-3)", border: "1.5px solid var(--line-2)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          [...Array(8)].map((_, i) => <Skel key={i} h={68} />)
        ) : logs.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
            <ScrollText size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>Sin actividad registrada</p>
          </div>
        ) : (
          logs.map((log) => {
            const summary = summarizeChange(log.old_value, log.new_value);
            return (
              <div
                key={log.id}
                className="rounded-2xl p-3.5"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                      {actionLabel(log.action)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--ink-3)" }}>
                        <User size={11} />
                        {log.admin?.name ?? log.admin?.email ?? "Sistema"}
                      </span>
                      {log.store && (
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--ink-3)" }}>
                          <Store size={11} />
                          {log.store.name}
                        </span>
                      )}
                    </div>
                    {summary && (
                      <p className="text-xs mt-1.5 rounded-lg px-2 py-1 inline-block" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                        {summary}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] flex-shrink-0 whitespace-nowrap" style={{ color: "var(--ink-4)" }}>
                    {dateTimePE(log.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

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

    </div>
  );
}
