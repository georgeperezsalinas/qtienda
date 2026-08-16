"use client";

// src/components/dashboard/StoreCreationWizard.tsx
//
// Reemplaza el formulario de una sola pantalla (nombre/URL/WhatsApp/ciudad)
// que vivía en dashboard/configuracion/page.tsx. Un solo POST /stores/ al
// terminar el paso 3 — nada se guarda a mitad de camino. Los campos fuera
// de este wizard (pagos, horarios, delivery, banners, pixels) se quedan en
// /dashboard/configuracion, no bloquean "quiero ver mi tienda ya".

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Loader2, Package, CalendarClock, Sparkles, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { track } from "@vercel/analytics";
import { COUNTRIES } from "@/lib/countries";
import { ThemePreviewGrid, type StoreTheme } from "@/components/dashboard/ThemePreviewGrid";
import PhoneInput from "@/components/ui/PhoneInput";

const COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
  "#F59E0B", "#FB7185", "#64748B", "#84CC16",
];

interface MallCategory {
  slug: string;
  label: string;
  icon?: string;
}

type Sells = "productos" | "servicios" | "ambos";

interface WizardForm {
  name: string;
  slug: string;
  description: string;
  whatsapp: string;
  country: string;
  city: string;
  sells: Sells | null;
  accept_pickup: boolean;
  pickup_instructions: string;
  mall_category: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  primary_color: string;
  theme: StoreTheme;
}

const EMPTY_FORM: WizardForm = {
  name: "", slug: "", description: "", whatsapp: "",
  country: "PE", city: "", sells: null,
  accept_pickup: false, pickup_instructions: "",
  mall_category: "",
  instagram: "", tiktok: "", facebook: "",
  primary_color: COLORS[0], theme: "clasico",
};

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full"
    >
      <span className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>{label}</span>
      <div
        style={{
          width: 40, height: 24, borderRadius: 12,
          background: value ? "var(--accent)" : "var(--line-2)",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute", top: 2, left: value ? 18 : 2,
            width: 20, height: 20, background: "#fff", borderRadius: "50%",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
        />
      </div>
    </button>
  );
}

const STEP_LABELS = ["Identidad", "Ubicación", "Estilo"];

export function StoreCreationWizard({ onCreated }: { onCreated: (redirectTo: string) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [categories, setCategories] = useState<MallCategory[]>([]);
  const [showSocial, setShowSocial] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient
      .get("/public/mall-categories")
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  function update<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Elegir "Servicios con cita" preselecciona la categoría del Mall —
  // la mayoría de esas tiendas no tienen otro rubro que aplique. Si el
  // vendedor vuelve atrás y cambia de opción, no le dejamos pegada esa
  // categoría sin sentido.
  function selectSells(sells: Sells) {
    setForm((f) => ({
      ...f,
      sells,
      mall_category: sells === "servicios" ? "servicios" : f.mall_category === "servicios" ? "" : f.mall_category,
    }));
  }

  const canAdvanceStep1 = form.name.trim().length > 0 && form.slug.trim().length > 0;

  async function handleCreate() {
    setCreating(true);
    try {
      await apiClient.post("/stores/", {
        name: form.name.trim(),
        slug: form.slug,
        description: form.description.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country,
        mall_category: form.mall_category || undefined,
        instagram: form.instagram.trim() || undefined,
        tiktok: form.tiktok.trim() || undefined,
        facebook: form.facebook.trim() || undefined,
        primary_color: form.primary_color,
        theme: form.theme,
      });
      // accept_pickup/pickup_instructions viven en StoreSettings, no en
      // Store — POST /stores/ ya crea el settings por defecto (apagado),
      // así que el toggle se guarda con un PATCH aparte, mismo endpoint
      // que usa la pestaña de pagos en /dashboard/configuracion.
      if (form.accept_pickup) {
        await apiClient.patch("/stores/me/settings", {
          accept_pickup: true,
          pickup_instructions: form.pickup_instructions.trim() || undefined,
        });
      }
      toast.success("¡Tienda creada!");
      track("store_created", {
        country: form.country,
        city: form.city || "sin_ciudad",
        sells: form.sells || "sin_especificar",
        mall_category: form.mall_category || "sin_categoria",
        has_whatsapp: !!form.whatsapp,
        has_social: !!(form.instagram || form.tiktok || form.facebook),
        accept_pickup: form.accept_pickup,
      });
      onCreated(form.sells === "servicios" ? "/dashboard/servicios" : "/dashboard/productos");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al crear tienda");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-5 max-w-sm mx-auto">
      <h1 className="font-display font-bold text-xl text-[var(--ink)] mb-1">Crear tienda</h1>
      <p className="text-sm text-[var(--ink-3)] mb-4">Configura tu tienda para empezar a recibir pedidos</p>

      {/* Progreso */}
      <div className="flex items-center gap-1.5 mb-5">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex-1">
              <div
                className="h-1.5 rounded-full mb-1.5"
                style={{ background: active || done ? "var(--accent)" : "var(--line-2)" }}
              />
              <p
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: active ? "var(--accent)" : "var(--ink-4)" }}
              >
                {n}. {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Paso 1 — Identidad */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Nombre *</label>
            <input className="input" placeholder="Ej: Postres de Ana" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">URL *</label>
            <div className="flex items-center gap-1">
              <input
                className="input"
                placeholder="anapostres"
                value={form.slug}
                onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
              <span className="text-xs text-[var(--ink-4)] whitespace-nowrap">.qtienda.shop</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Descripción</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Ej: Postres caseros con delivery en Lima"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
            <p className="text-[11px] mt-1 text-[var(--ink-4)]">Aparece en tu tienda y en el Mall — es lo primero que leen.</p>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide mb-1.5">
              <span
                className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
                style={{ background: "#25D366" }}
              >
                <Phone size={9} fill="white" color="white" />
              </span>
              WhatsApp
            </label>
            <PhoneInput value={form.whatsapp} onChange={(v) => update("whatsapp", v)} />
            <p className="text-[11px] mt-1 text-[var(--ink-4)]">Con el código de país — si no, el botón de WhatsApp de tu tienda no va a funcionar.</p>
          </div>
        </div>
      )}

      {/* Paso 2 — Ubicación y qué vende */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">País</label>
            <select className="input" value={form.country} onChange={(e) => update("country", e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Ciudad</label>
            <input className="input" placeholder="Lima" value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-2">¿Qué vendes?</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "productos", label: "Productos", icon: Package },
                  { value: "servicios", label: "Servicios", icon: CalendarClock },
                  { value: "ambos", label: "Ambos", icon: Sparkles },
                ] as const
              ).map((opt) => {
                const active = form.sells === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectSells(opt.value)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                    style={{
                      border: `2px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                      background: active ? "var(--accent-soft)" : "var(--surface)",
                    }}
                  >
                    <Icon size={18} style={{ color: active ? "var(--accent)" : "var(--ink-3)" }} />
                    <span className="text-xs font-bold" style={{ color: active ? "var(--accent)" : "var(--ink-2)" }}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl p-3.5" style={{ border: "1px solid var(--line-2)", background: "var(--surface)" }}>
            <Toggle
              value={form.accept_pickup}
              onChange={(v) => update("accept_pickup", v)}
              label="¿Ofreces recojo en tienda?"
            />
            {form.accept_pickup && (
              <div className="mt-3">
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Dirección y referencia — ej: Av. Los Olivos 245, Trujillo. Frente al parque, puerta azul."
                  value={form.pickup_instructions}
                  onChange={(e) => update("pickup_instructions", e.target.value)}
                />
                <p className="text-[11px] mt-1 text-[var(--ink-4)]">Se muestra al comprador cuando elige recoger su pedido.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paso 3 — Categoría, redes y estilo */}
      {step === 3 && (
        <div className="space-y-4">
          {categories.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Categoría del Mall</label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((c) => {
                  const active = form.mall_category === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => update("mall_category", active ? "" : c.slug)}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                      style={{
                        border: `1.5px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                        background: active ? "var(--accent-soft)" : "var(--surface)",
                      }}
                    >
                      <span className="text-base leading-none">{c.icon || "🛍️"}</span>
                      <span className="text-[9px] font-bold text-center leading-tight" style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowSocial((v) => !v)}
              className="flex items-center gap-1 text-xs font-bold"
              style={{ color: "var(--accent)" }}
            >
              <ChevronDown size={13} style={{ transform: showSocial ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              Agregar redes sociales (opcional)
            </button>
            {showSocial && (
              <div className="space-y-2.5 mt-2.5">
                <input className="input" placeholder="Instagram (usuario)" value={form.instagram} onChange={(e) => update("instagram", e.target.value)} />
                <input className="input" placeholder="TikTok (usuario)" value={form.tiktok} onChange={(e) => update("tiktok", e.target.value)} />
                <input className="input" placeholder="Facebook (usuario)" value={form.facebook} onChange={(e) => update("facebook", e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Color principal</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update("primary_color", c)}
                  className={`w-8 h-8 rounded-full transition-transform ${form.primary_color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Tema de tu vitrina</label>
            <p className="text-[11px] text-[var(--ink-4)] mb-2">
              Cambia la disposición y los neutros de tu tienda pública. Tu color de marca se mantiene en cualquier tema.
            </p>
            <ThemePreviewGrid value={form.theme} onChange={(theme) => update("theme", theme)} primaryColor={form.primary_color} />
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="flex items-center gap-2.5 mt-6">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center justify-center gap-1 rounded-xl text-sm font-bold px-4 py-3"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          >
            <ChevronLeft size={16} /> Atrás
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            disabled={step === 1 && !canAdvanceStep1}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 flex items-center justify-center gap-1 rounded-xl text-sm font-bold px-4 py-3 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Siguiente <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold px-4 py-3 disabled:opacity-60"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : null}
            {creating ? "Creando..." : "Crear tienda"}
          </button>
        )}
      </div>
    </div>
  );
}
