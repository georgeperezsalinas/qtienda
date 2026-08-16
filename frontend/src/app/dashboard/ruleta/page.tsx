"use client";

import { useEffect, useState } from "react";
import { Sparkles, Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import WheelPreview, { type WheelSegment as Segment } from "@/components/store/WheelPreview";

const COLORS = ["#C5613B", "#3E6B8A", "#6B4F8A", "#4A8B5F", "#B8944A", "#8A5050"];

const DEFAULT_SEGMENTS: Segment[] = [
  { label: "10% de descuento", discount_type: "percent", discount_value: 10, weight: 3, color: COLORS[0] },
  { label: "Sigue intentando", discount_type: "none", discount_value: 0, weight: 5, color: COLORS[1] },
  { label: "S/ 5 de descuento", discount_type: "fixed", discount_value: 500, weight: 3, color: COLORS[2] },
  { label: "20% de descuento", discount_type: "percent", discount_value: 20, weight: 1, color: COLORS[3] },
];

const MAX_SEGMENTS = 6;

export default function RuletaPage() {
  const [enabled, setEnabled] = useState(false);
  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get("/wheel-config/");
        setEnabled(!!data.enabled);
        if (Array.isArray(data.segments) && data.segments.length > 0) {
          setSegments(data.segments);
        }
      } catch {
        toast.error("No se pudo cargar la configuración de la ruleta");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateSegment(i: number, patch: Partial<Segment>) {
    setSegments((segs) => segs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSegment() {
    if (segments.length >= MAX_SEGMENTS) return;
    setSegments((segs) => [
      ...segs,
      { label: "Nuevo premio", discount_type: "percent", discount_value: 5, weight: 1, color: COLORS[segs.length % COLORS.length] },
    ]);
  }

  function removeSegment(i: number) {
    if (segments.length <= 2) { toast.error("Necesitas al menos 2 premios"); return; }
    setSegments((segs) => segs.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (segments.length < 2) { toast.error("Necesitas al menos 2 premios"); return; }
    if (segments.some((s) => !s.label.trim())) { toast.error("Todos los premios necesitan un nombre"); return; }
    setSaving(true);
    try {
      await apiClient.put("/wheel-config/", { enabled, segments });
      toast.success("Ruleta guardada");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudo guardar la ruleta");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100%" }} className="px-5 pt-8 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-2xl" style={{ height: 70 }} />)}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div
        className="sticky top-0 z-10 px-5 pt-[max(20px,env(safe-area-inset-top))] md:pt-[max(28px,env(safe-area-inset-top))] pb-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-extrabold text-xl flex items-center gap-2" style={{ color: "var(--ink)" }}>
              <Sparkles size={19} style={{ color: "var(--accent)" }} /> Ruleta de premios
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              Un giro por visitante — gana un cupón automático si le toca premio
            </p>
          </div>
          <button
            onClick={() => setEnabled((e) => !e)}
            className="text-xs font-bold px-3 py-2 rounded-xl transition-all flex-shrink-0"
            style={{ background: enabled ? "var(--success)" : "var(--surface-2)", color: enabled ? "#fff" : "var(--ink-2)" }}
          >
            {enabled ? "Activada" : "Desactivada"}
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 pb-8 space-y-2.5 max-w-2xl">
        {/* Preview en vivo — exactamente lo que ve el comprador, se actualiza
            al tocar colores/premios/probabilidades de abajo */}
        <div className="rounded-2xl p-5 mb-2.5 flex flex-col items-center" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <WheelPreview segments={segments} size={190} />
          <p className="text-xs mt-4 text-center" style={{ color: "var(--ink-3)" }}>
            Así la ve tu cliente al girar
          </p>
        </div>

        {segments.map((s, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ background: s.color, border: "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--line)" }}
              />
              <input
                className="input flex-1"
                placeholder="Nombre del premio"
                value={s.label}
                onChange={(e) => updateSegment(i, { label: e.target.value })}
              />
              <button
                onClick={() => removeSegment(i)}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--danger-soft)" }}
              >
                <Trash2 size={14} style={{ color: "var(--danger)" }} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "var(--ink-3)" }}>Tipo</label>
                <select
                  className="input"
                  value={s.discount_type}
                  onChange={(e) => updateSegment(i, { discount_type: e.target.value as Segment["discount_type"] })}
                >
                  <option value="percent">% Porcentaje</option>
                  <option value="fixed">S/ Monto fijo</option>
                  <option value="none">Sin premio</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "var(--ink-3)" }}>Valor</label>
                <input
                  className="input"
                  type="number"
                  disabled={s.discount_type === "none"}
                  value={s.discount_type === "none" ? 0 : s.discount_value}
                  onChange={(e) => updateSegment(i, { discount_value: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "var(--ink-3)" }}>Probabilidad</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={s.weight}
                  onChange={(e) => updateSegment(i, { weight: Math.max(1, Number(e.target.value)) })}
                />
              </div>
            </div>
          </div>
        ))}

        {segments.length < MAX_SEGMENTS && (
          <button
            onClick={addSegment}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1px dashed var(--line-2)" }}
          >
            <Plus size={15} /> Agregar premio
          </button>
        )}

        <p className="text-xs" style={{ color: "var(--ink-4)" }}>
          "Probabilidad" es un peso relativo entre premios — un premio con peso 5 sale ~5 veces más seguido que uno con peso 1. Incluye al menos un premio "Sin premio" para que no todos ganen.
        </p>

        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60" style={{ width: "auto", padding: "12px 24px" }}>
          <Save size={15} /> {saving ? "Guardando…" : "Guardar ruleta"}
        </button>
      </div>
    </div>
  );
}
