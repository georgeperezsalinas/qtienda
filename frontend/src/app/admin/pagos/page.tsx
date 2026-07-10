"use client";

// Admin: pagos manuales de planes (Yape directo).
// El vendedor yapea al celular del admin y registra su nº de operación;
// aquí se verifica contra la app de Yape y se aprueba o rechaza.

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, Clock, RefreshCw, Smartphone, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface PlanRequest {
  id: string;
  status: string;
  method: string;
  amount_cents: number;
  operation_number: string | null;
  payer_phone: string | null;
  note: string | null;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  plan: { id: string; name: string; slug: string } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    owner_email: string | null;
    owner_phone: string | null;
  } | null;
}

const TABS = [
  { key: "pending", label: "Pendientes" },
  { key: "approved", label: "Aprobados" },
  { key: "rejected", label: "Rechazados" },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#FEF3C7", color: "#92400E", label: "Pendiente" },
  approved: { bg: "#D1FAE5", color: "#065F46", label: "Aprobado" },
  rejected: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazado" },
};

function dateTimePE(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPagosPage() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<PlanRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/admin/plan-requests", {
        params: { status, limit: 50 },
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error("No se pudieron cargar los pagos");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function approve(req: PlanRequest) {
    if (
      !window.confirm(
        `¿Confirmar que recibiste el Yape de ${formatPrice(req.amount_cents)} (op. ${req.operation_number ?? "—"})?\n\nSe activará el plan ${req.plan?.name} por 30 días para "${req.store?.name}".`
      )
    )
      return;
    setActing(req.id);
    try {
      await apiClient.post(`/admin/plan-requests/${req.id}/approve`);
      toast.success(`Plan ${req.plan?.name} activado para ${req.store?.name}`);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo aprobar");
    } finally {
      setActing(null);
    }
  }

  async function reject(req: PlanRequest) {
    const reason = window.prompt(
      `Rechazar pago de "${req.store?.name}".\n\nMotivo (lo verá el vendedor):`,
      "No encontramos el Yape con ese número de operación"
    );
    if (reason === null) return;
    setActing(req.id);
    try {
      await apiClient.post(`/admin/plan-requests/${req.id}/reject`, { reason });
      toast.success("Pago rechazado");
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo rechazar");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Planes</p>
          <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
            Pagos Yape
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
            {total} pago{total !== 1 ? "s" : ""} {STATUS_STYLES[status].label.toLowerCase()}
            {total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "var(--surface-0)", color: "var(--ink-2)", border: "1.5px solid #E2E8F0" }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
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
          [...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          ))
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
          >
            <Smartphone size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
              No hay pagos {STATUS_STYLES[status].label.toLowerCase()}s
            </p>
          </div>
        ) : (
          items.map((r) => {
            const st = STATUS_STYLES[r.status] ?? STATUS_STYLES.pending;
            return (
              <div
                key={r.id}
                className="rounded-2xl p-4"
                style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                        {r.store?.name ?? "Tienda eliminada"}
                      </p>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                      {r.store?.owner_email ?? "sin email"}
                      {r.store?.owner_phone ? ` · ${r.store.owner_phone}` : ""}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                      <Clock size={10} className="inline mr-1" />
                      {dateTimePE(r.created_at)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-extrabold text-lg" style={{ color: "var(--ink)" }}>
                      {formatPrice(r.amount_cents)}
                    </p>
                    <p className="text-xs font-semibold" style={{ color: "#742384" }}>
                      Plan {r.plan?.name}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-3 rounded-xl px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                >
                  <span>
                    Nº operación: <strong className="mono">{r.operation_number ?? "—"}</strong>
                  </span>
                  {r.payer_phone && <span>Celular: {r.payer_phone}</span>}
                  {r.note && <span>Nota: {r.note}</span>}
                  {r.reject_reason && <span style={{ color: "#991B1B" }}>Motivo: {r.reject_reason}</span>}
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      disabled={acting === r.id}
                      onClick={() => approve(r)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
                      style={{ background: "#D1FAE5", color: "#065F46" }}
                    >
                      <CheckCircle2 size={14} />
                      Recibí el Yape, activar plan
                    </button>
                    <button
                      disabled={acting === r.id}
                      onClick={() => reject(r)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
                      style={{ background: "#FEE2E2", color: "#991B1B" }}
                    >
                      <XCircle size={14} />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
