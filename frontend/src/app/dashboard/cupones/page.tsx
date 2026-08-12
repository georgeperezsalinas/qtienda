"use client";

import { useEffect, useState } from "react";
import { Plus, Tag, X, Trash2, Percent, DollarSign, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useStoreCurrency } from "@/hooks/useStoreCurrency";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_cents?: number | null;
  max_uses?: number | null;
  uses_count: number;
  expires_at?: string | null;
  active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  code: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "",
  min_order_cents: "",
  max_uses: "",
  expires_at: "",
};

function Skel({ h = 80 }: { h?: number }) {
  return <div className="skeleton rounded-2xl" style={{ height: h }} />;
}

function isExpired(c: Coupon) {
  return !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();
}

function CouponRow({ coupon, onToggle, onDelete, currency, locale }: {
  coupon: Coupon;
  onToggle: () => void;
  onDelete: () => void;
  currency: string;
  locale: string;
}) {
  const expired = isExpired(coupon);
  const exhausted = !!coupon.max_uses && coupon.uses_count >= coupon.max_uses;
  const effectivelyOff = !coupon.active || expired || exhausted;

  function copyCode() {
    navigator.clipboard?.writeText(coupon.code);
    toast.success("Código copiado");
  }

  return (
    <div
      className="flex items-center gap-3 p-4 rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", opacity: effectivelyOff ? 0.6 : 1 }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--accent-soft)" }}
      >
        {coupon.discount_type === "percent"
          ? <Percent size={18} style={{ color: "var(--accent)" }} />
          : <DollarSign size={18} style={{ color: "var(--accent)" }} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button onClick={copyCode} className="flex items-center gap-1.5 group">
            <p className="font-display font-extrabold text-sm tracking-wide" style={{ color: "var(--ink)" }}>
              {coupon.code}
            </p>
            <Copy size={11} style={{ color: "var(--ink-4)" }} />
          </button>
          {!coupon.active && (
            <span className="badge badge-mute text-[10px]">Desactivado</span>
          )}
          {coupon.active && expired && (
            <span className="badge badge-danger text-[10px]">Vencido</span>
          )}
          {coupon.active && !expired && exhausted && (
            <span className="badge badge-warn text-[10px]">Agotado</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
          {coupon.discount_type === "percent" ? `${coupon.discount_value}% de descuento` : `${formatPrice(coupon.discount_value, currency, locale)} de descuento`}
          {coupon.min_order_cents ? ` · mín. ${formatPrice(coupon.min_order_cents, currency, locale)}` : ""}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-4)" }}>
          Usado {coupon.uses_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""} vez{coupon.uses_count !== 1 ? "es" : ""}
          {coupon.expires_at ? ` · vence ${new Date(coupon.expires_at).toLocaleDateString("es-PE")}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onToggle}
          className="text-xs font-bold px-3 py-2 rounded-xl transition-all"
          style={{
            background: coupon.active ? "var(--surface-2)" : "var(--ink)",
            color: coupon.active ? "var(--ink-2)" : "var(--bg)",
          }}
        >
          {coupon.active ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--danger-soft)" }}
        >
          <Trash2 size={14} style={{ color: "var(--danger)" }} />
        </button>
      </div>
    </div>
  );
}

export default function CuponesPage() {
  const { code: currency, locale } = useStoreCurrency();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/coupons/");
      setCoupons(data);
    } catch {
      toast.error("No se pudieron cargar los cupones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  async function saveCoupon() {
    const code = form.code.trim();
    const value = Number(form.discount_value);
    if (!code) { toast.error("Ingresa un código"); return; }
    if (!value || value <= 0) { toast.error("Ingresa un valor de descuento válido"); return; }
    if (form.discount_type === "percent" && (value < 1 || value > 100)) {
      toast.error("El porcentaje debe estar entre 1 y 100");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/coupons/", {
        code,
        discount_type: form.discount_type,
        discount_value: Math.round(value),
        min_order_cents: form.min_order_cents ? Math.round(Number(form.min_order_cents) * 100) : undefined,
        max_uses: form.max_uses ? Math.round(Number(form.max_uses)) : undefined,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
      });
      toast.success("Cupón creado");
      setShowModal(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al crear el cupón");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await apiClient.patch(`/coupons/${coupon.id}`, { active: !coupon.active });
      setCoupons((cs) => cs.map((c) => c.id === coupon.id ? { ...c, active: !c.active } : c));
    } catch {
      toast.error("No se pudo actualizar el cupón");
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`¿Eliminar el cupón ${coupon.code}?`)) return;
    try {
      await apiClient.delete(`/coupons/${coupon.id}`);
      setCoupons((cs) => cs.filter((c) => c.id !== coupon.id));
      toast.success("Cupón eliminado");
    } catch {
      toast.error("No se pudo eliminar el cupón");
    }
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div
        className="sticky top-0 z-10 px-5 pt-[max(20px,env(safe-area-inset-top))] md:pt-[max(28px,env(safe-area-inset-top))] pb-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
              Cupones
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              {coupons.length} cupón{coupons.length !== 1 ? "es" : ""} creado{coupons.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary" style={{ width: "auto", padding: "10px 16px" }}>
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 pb-8 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
        {loading ? (
          [...Array(3)].map((_, i) => <Skel key={i} h={92} />)
        ) : coupons.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center animate-fade-in lg:col-span-2 xl:col-span-3">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--surface-2)" }}>
              <Tag size={36} style={{ color: "var(--ink-4)" }} />
            </div>
            <h3 className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              Aún no tienes cupones
            </h3>
            <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--ink-3)" }}>
              Crea un código como "TIKTOK20" para promocionar en tus lives o redes sociales
            </p>
            <button onClick={openCreate} className="btn-primary" style={{ width: "auto", padding: "12px 24px" }}>
              <Plus size={16} /> Crear mi primer cupón
            </button>
          </div>
        ) : (
          coupons.map((c) => (
            <CouponRow
              key={c.id}
              coupon={c}
              onToggle={() => toggleActive(c)}
              onDelete={() => deleteCoupon(c)}
              currency={currency}
              locale={locale}
            />
          ))
        )}
      </div>

      {showModal && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowModal(false)}
          />
          <div
            className="fixed z-[70] left-1/2 top-1/2 w-[92vw] max-w-sm rounded-[24px] p-5 max-h-[85dvh] overflow-y-auto"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-extrabold text-base" style={{ color: "var(--ink)" }}>
                Nuevo cupón
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-2)" }}
              >
                <X size={15} style={{ color: "var(--ink-2)" }} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--ink-3)" }}>
                  Código *
                </label>
                <input
                  className="input"
                  placeholder="Ej: TIKTOK20"
                  autoCapitalize="characters"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--ink-3)" }}>
                  Tipo de descuento *
                </label>
                <div className="flex gap-2">
                  {(["percent", "fixed"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, discount_type: t })}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: form.discount_type === t ? "var(--ink)" : "var(--surface-2)",
                        color: form.discount_type === t ? "var(--bg)" : "var(--ink-2)",
                      }}
                    >
                      {t === "percent" ? "% Porcentaje" : "S/ Monto fijo"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--ink-3)" }}>
                  {form.discount_type === "percent" ? "Porcentaje (1-100) *" : "Monto en soles *"}
                </label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder={form.discount_type === "percent" ? "20" : "10.00"}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--ink-3)" }}>
                  Pedido mínimo (opcional, en soles)
                </label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder="Sin mínimo"
                  value={form.min_order_cents}
                  onChange={(e) => setForm({ ...form, min_order_cents: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--ink-3)" }}>
                  Límite de usos (opcional)
                </label>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  placeholder="Sin límite"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--ink-3)" }}>
                  Vence el (opcional)
                </label>
                <input
                  className="input"
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={saveCoupon}
              disabled={saving}
              className="btn-primary w-full mt-5 disabled:opacity-60"
            >
              {saving ? "Creando…" : "Crear cupón"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
