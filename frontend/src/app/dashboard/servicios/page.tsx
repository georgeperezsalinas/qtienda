"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Clock, CalendarClock, CalendarX2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useStoreCurrency } from "@/hooks/useStoreCurrency";
import { ImageUpload } from "@/components/ui/ImageUpload";

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price_cents?: number | null;
  is_active: boolean;
  image_url?: string | null;
}

interface Exception {
  id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}

type Range = { start: string; end: string };
type WeekHours = Record<string, Range[]>;

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const emptyForm = {
  name: "",
  description: "",
  duration_minutes: 30,
  price_cents: "",
  image_url: "",
};

export default function ServiciosPage() {
  const { code: currency, locale } = useStoreCurrency();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [hours, setHours] = useState<WeekHours>({});
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [savingHours, setSavingHours] = useState(false);

  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [excDate, setExcDate] = useState("");
  const [excReason, setExcReason] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      apiClient.get("/services/"),
      apiClient.get("/services/appointment-settings"),
      apiClient.get("/services/availability-exceptions"),
    ])
      .then(([s, a, e]) => {
        setServices(s.data);
        setHours(a.data.appointment_hours || {});
        setAutoConfirm(a.data.appointments_auto_confirm ?? true);
        setExceptions(e.data);
      })
      .catch(() => toast.error("No se pudo cargar la información"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(s: Service) {
    setEditId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      duration_minutes: s.duration_minutes,
      price_cents: s.price_cents != null ? String(Math.round(s.price_cents / 100)) : "",
      image_url: s.image_url || "",
    });
    setShowModal(true);
  }

  async function saveService() {
    if (!form.name.trim()) {
      toast.error("Ponle un nombre al servicio");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        duration_minutes: Number(form.duration_minutes) || 30,
        price_cents: form.price_cents.trim() ? Math.round(Number(form.price_cents) * 100) : null,
        image_url: form.image_url || null,
      };
      if (editId) {
        await apiClient.patch(`/services/${editId}`, body);
      } else {
        await apiClient.post("/services/", body);
      }
      toast.success(editId ? "Servicio actualizado" : "Servicio creado");
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await apiClient.patch(`/services/${s.id}`, { is_active: !s.is_active });
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function removeService(id: string) {
    if (!confirm("¿Eliminar este servicio? Las citas ya reservadas no se pierden, solo deja de estar disponible para nuevas citas.")) return;
    try {
      await apiClient.delete(`/services/${id}`);
      toast.success("Servicio eliminado");
      load();
    } catch {
      toast.error("No se pudo eliminar");
    }
  }

  function addRange(day: string) {
    setHours((h) => ({ ...h, [day]: [...(h[day] || []), { start: "09:00", end: "18:00" }] }));
  }
  function removeRange(day: string, idx: number) {
    setHours((h) => ({ ...h, [day]: (h[day] || []).filter((_, i) => i !== idx) }));
  }
  function updateRange(day: string, idx: number, field: "start" | "end", value: string) {
    setHours((h) => ({
      ...h,
      [day]: (h[day] || []).map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    }));
  }

  async function saveHours() {
    setSavingHours(true);
    try {
      await apiClient.patch("/services/appointment-settings", {
        appointment_hours: hours,
        appointments_auto_confirm: autoConfirm,
      });
      toast.success("Horario guardado");
    } catch {
      toast.error("No se pudo guardar el horario");
    } finally {
      setSavingHours(false);
    }
  }

  async function addException() {
    if (!excDate) {
      toast.error("Elige una fecha");
      return;
    }
    try {
      const { data } = await apiClient.post("/services/availability-exceptions", {
        date: excDate,
        reason: excReason.trim() || null,
      });
      setExceptions((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setExcDate("");
      setExcReason("");
      toast.success("Bloqueo agregado");
    } catch {
      toast.error("No se pudo agregar el bloqueo");
    }
  }

  async function removeException(id: string) {
    try {
      await apiClient.delete(`/services/availability-exceptions/${id}`);
      setExceptions((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast.error("No se pudo eliminar");
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
          Servicios con cita
        </h1>
        <button onClick={openCreate} className="btn-primary" style={{ width: "auto", padding: "10px 16px" }}>
          <Plus size={16} /> Agregar
        </button>
      </div>
      <p className="text-xs mb-6" style={{ color: "var(--ink-3)" }}>
        Define lo que ofreces con cita (ej. una limpieza dental, un corte de cabello) — tus clientes van a poder
        reservar directo desde tu tienda.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>Cargando…</p>
      ) : services.length === 0 ? (
        <div className="card p-6 text-center mb-8">
          <CalendarClock size={28} className="mx-auto mb-2" style={{ color: "var(--ink-4)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--ink-2)" }}>Todavía no tienes servicios</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>Agrega el primero para empezar a recibir citas.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {services.map((s) => (
            <div key={s.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{s.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {s.duration_minutes} min
                  {s.price_cents != null && <> · {formatPrice(s.price_cents, currency, locale)}</>}
                </p>
              </div>
              <button
                onClick={() => toggleActive(s)}
                className={`badge ${s.is_active ? "badge-success" : "badge-mute"}`}
                style={{ cursor: "pointer" }}
              >
                {s.is_active ? "Activo" : "Inactivo"}
              </button>
              <button onClick={() => openEdit(s)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                <Pencil size={13} style={{ color: "var(--ink-2)" }} />
              </button>
              <button onClick={() => removeService(s.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--danger-soft)" }}>
                <Trash2 size={13} style={{ color: "var(--danger)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card p-5 mb-6">
        <p className="font-display font-bold text-sm mb-1" style={{ color: "var(--ink)" }}>Horario de atención por cita</p>
        <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
          Define tus franjas disponibles por día (puedes agregar varias, ej. mañana y tarde con descanso al medio).
        </p>
        {DAYS.map((d) => (
          <div key={d.key} className="mb-3 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: "var(--ink-2)" }}>{d.label}</span>
              <button onClick={() => addRange(d.key)} className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                + franja
              </button>
            </div>
            {(hours[d.key] || []).length === 0 && (
              <p className="text-[11px]" style={{ color: "var(--ink-4)" }}>Sin horario — no se ofrecen citas este día</p>
            )}
            {(hours[d.key] || []).map((r, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <Clock size={12} style={{ color: "var(--ink-4)" }} />
                <input type="time" className="input text-xs py-1.5" style={{ width: 110 }} value={r.start} onChange={(e) => updateRange(d.key, i, "start", e.target.value)} />
                <span className="text-xs" style={{ color: "var(--ink-4)" }}>a</span>
                <input type="time" className="input text-xs py-1.5" style={{ width: 110 }} value={r.end} onChange={(e) => updateRange(d.key, i, "end", e.target.value)} />
                <button onClick={() => removeRange(d.key, i)}><X size={13} style={{ color: "var(--ink-4)" }} /></button>
              </div>
            ))}
          </div>
        ))}
        <label className="flex items-center gap-2 mt-2 mb-4 text-xs font-medium" style={{ color: "var(--ink-2)" }}>
          <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />
          Confirmar citas automáticamente (si lo apagas, tienes que confirmarlas tú manualmente)
        </label>
        <button onClick={saveHours} disabled={savingHours} className="btn-primary" style={{ width: "auto", padding: "10px 18px" }}>
          {savingHours ? "Guardando…" : "Guardar horario"}
        </button>
      </div>

      <div className="card p-5">
        <p className="font-display font-bold text-sm mb-1" style={{ color: "var(--ink)" }}>Bloqueos puntuales</p>
        <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>Para vacaciones, feriados o días que no vas a atender.</p>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Fecha</label>
            <input type="date" className="input text-xs py-2" value={excDate} onChange={(e) => setExcDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Motivo (opcional)</label>
            <input className="input text-xs py-2" placeholder="Ej: Feriado" value={excReason} onChange={(e) => setExcReason(e.target.value)} />
          </div>
          <button onClick={addException} className="btn-secondary" style={{ padding: "9px 14px" }}>
            <CalendarX2 size={14} /> Bloquear
          </button>
        </div>
        {exceptions.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--ink-4)" }}>Sin bloqueos próximos.</p>
        ) : (
          <div className="space-y-1.5">
            {exceptions.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className="font-bold" style={{ color: "var(--ink)" }}>{e.date}</span>
                {e.reason && <span style={{ color: "var(--ink-3)" }}>— {e.reason}</span>}
                <button onClick={() => removeException(e.id)} className="ml-auto"><X size={13} style={{ color: "var(--ink-4)" }} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 z-[90]" style={{ background: "rgba(20,19,15,.5)" }} onClick={() => !saving && setShowModal(false)} />
          <div
            className="fixed z-[91] left-1/2 top-1/2 w-[92vw] max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-extrabold text-base" style={{ color: "var(--ink)" }}>
                {editId ? "Editar servicio" : "Nuevo servicio"}
              </h3>
              <button onClick={() => setShowModal(false)}><X size={16} style={{ color: "var(--ink-3)" }} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Nombre *</label>
                <input className="input text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Limpieza dental" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Descripción</label>
                <textarea className="input text-sm" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Duración (min) *</label>
                  <input type="number" className="input text-sm" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Precio (opcional)</label>
                  <input type="number" className="input text-sm" placeholder="Sin definir" value={form.price_cents} onChange={(e) => setForm((f) => ({ ...f, price_cents: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: "var(--ink-3)" }}>Foto (opcional)</label>
                <ImageUpload
                  value={form.image_url}
                  onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
                  hint="JPG o PNG, se recorta automático"
                  className="h-32 w-full"
                />
              </div>
              <button onClick={saveService} disabled={saving} className="btn-primary w-full mt-2" style={{ padding: "12px" }}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
