"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, MessageCircle, Check, X as XIcon, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

interface Appointment {
  id: string;
  service_name: string;
  patient_name: string;
  patient_phone: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes?: string;
  patient_no_show_count?: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "badge-warn" },
  confirmed: { label: "Confirmada", cls: "badge-info" },
  completed: { label: "Completada", cls: "badge-success" },
  cancelled: { label: "Cancelada", cls: "badge-danger" },
  no_show: { label: "No se presentó", cls: "badge-mute" },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
}

function whatsappReminderUrl(a: Appointment) {
  const phone = a.patient_phone.replace(/\D/g, "");
  const msg = `Hola ${a.patient_name}, te recordamos tu cita de "${a.service_name}" el ${formatDate(a.scheduled_at)} a las ${formatTime(a.scheduled_at)}. ¡Te esperamos!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export default function CitasPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyToday, setOnlyToday] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  function load() {
    setLoading(true);
    const params: Record<string, string | boolean> = {};
    if (onlyToday) params.today = true;
    if (statusFilter) params.status = statusFilter;
    apiClient
      .get("/services/appointments", { params })
      .then(({ data }) => setAppointments(data))
      .catch(() => toast.error("No se pudieron cargar las citas"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [onlyToday, statusFilter]);

  async function updateStatus(id: string, status: string) {
    try {
      await apiClient.patch(`/services/appointments/${id}`, { status });
      toast.success("Actualizado");
      load();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>Citas</h1>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setOnlyToday(true)}
          className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: onlyToday ? "var(--ink)" : "var(--surface)",
            color: onlyToday ? "var(--bg)" : "var(--ink-3)",
            border: `1.5px solid ${onlyToday ? "var(--ink)" : "var(--line-2)"}`,
          }}
        >
          <CalendarDays size={12} className="inline mr-1" /> Hoy
        </button>
        <button
          onClick={() => setOnlyToday(false)}
          className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: !onlyToday ? "var(--ink)" : "var(--surface)",
            color: !onlyToday ? "var(--bg)" : "var(--ink-3)",
            border: `1.5px solid ${!onlyToday ? "var(--ink)" : "var(--line-2)"}`,
          }}
        >
          Todas
        </button>
        <select className="input text-xs py-2 w-auto ml-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>Cargando…</p>
      ) : appointments.length === 0 ? (
        <div className="card p-6 text-center">
          <CalendarCheck size={28} className="mx-auto mb-2" style={{ color: "var(--ink-4)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            {onlyToday ? "No tienes citas para hoy" : "Sin citas todavía"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => {
            const st = STATUS_LABELS[a.status] || STATUS_LABELS.pending;
            return (
              <div key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{a.patient_name}</p>
                      {!!a.patient_no_show_count && (
                        <span className="badge badge-warn" title="Cancelaciones o inasistencias previas de este número">
                          ⚠️ {a.patient_no_show_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                      {a.service_name} · {formatDate(a.scheduled_at)} · {formatTime(a.scheduled_at)} ({a.duration_minutes} min)
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>{a.patient_phone}</p>
                  </div>
                  <span className={`badge ${st.cls} flex-shrink-0`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <a
                    href={whatsappReminderUrl(a)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
                    style={{ background: "#25D366" }}
                  >
                    <MessageCircle size={12} /> Recordatorio WhatsApp
                  </a>
                  {a.status === "pending" && (
                    <button onClick={() => updateStatus(a.id, "confirmed")} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
                      <Check size={12} className="inline" /> Confirmar
                    </button>
                  )}
                  {(a.status === "pending" || a.status === "confirmed") && (
                    <>
                      <button onClick={() => updateStatus(a.id, "completed")} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                        Completada
                      </button>
                      <button onClick={() => updateStatus(a.id, "no_show")} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                        No se presentó
                      </button>
                      <button onClick={() => updateStatus(a.id, "cancelled")} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                        <XIcon size={12} className="inline" /> Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
