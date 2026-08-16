"use client";

// src/components/dashboard/ProductCreationWizard.tsx
//
// Wizard de pasos para crear un producto — reemplaza el formulario largo de
// una sola pantalla, mismo patrón que StoreCreationWizard.tsx (progreso
// segmentado, validación por paso, un solo submit al final). Editar un
// producto existente sigue usando el formulario directo en productos/page.tsx
// — un wizard no aporta nada cuando solo quieres tocar un campo.

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, X, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { MultiImageUpload, type FormImage } from "@/components/ui/MultiImageUpload";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

interface Category { id: string; name: string; icon?: string }

interface WizardForm {
  name: string;
  description: string;
  price_cents: string;
  compare_price: string;
  sale_ends_at: string;
  stock: string;
  sku: string;
  category_id: string;
  is_featured: boolean;
  is_published: boolean;
}

const EMPTY_FORM: WizardForm = {
  name: "", description: "", price_cents: "", compare_price: "", sale_ends_at: "",
  stock: "", sku: "", category_id: "", is_featured: false, is_published: false,
};

interface VariantDraft {
  key: string; // solo para el key de React, no se envía
  label: string;
  sku: string;
  price_cents: string;
  stock: string;
}

function emptyVariant(): VariantDraft {
  return { key: crypto.randomUUID(), label: "", sku: "", price_cents: "", stock: "" };
}

function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: () => void; label: string; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>{sub}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? "var(--ink)" : "var(--line-2)" }}
        aria-checked={checked}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ left: 2, transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

const STEP_LABELS = ["Fotos", "Información", "Precio y stock", "Variantes", "Publicar"];

export function ProductCreationWizard({
  categories, onCategoryCreated, onCreated, onCancel,
}: {
  categories: Category[];
  onCategoryCreated: (cat: Category) => void;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [images, setImages] = useState<FormImage[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [creating, setCreating] = useState(false);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  function update<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const { data } = await apiClient.post("/categories/", { name: newCategoryName.trim() });
      onCategoryCreated(data);
      update("category_id", data.id);
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success("Categoría creada");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al crear categoría");
    } finally {
      setCreatingCategory(false);
    }
  }

  const canAdvance2 = form.name.trim().length > 0;
  const canAdvance3 = !!parseFloat(form.price_cents) && parseFloat(form.price_cents) > 0;

  async function handleCreate() {
    setCreating(true);
    try {
      const cleanDesc = form.description.replace(/<p>\s*<\/p>/g, "").trim();
      const { data: product } = await apiClient.post("/products/", {
        name: form.name.trim(),
        description: cleanDesc || undefined,
        price_cents: Math.round(parseFloat(form.price_cents) * 100),
        compare_price: form.compare_price ? Math.round(parseFloat(form.compare_price) * 100) : undefined,
        sale_ends_at: form.sale_ends_at ? new Date(form.sale_ends_at).toISOString() : undefined,
        stock: form.stock !== "" ? parseInt(form.stock) : undefined,
        sku: form.sku.trim() || undefined,
        category_id: form.category_id || undefined,
        is_featured: form.is_featured,
        status: form.is_published ? "active" : "inactive",
      });

      for (let i = 0; i < images.length; i++) {
        await apiClient.post(`/products/${product.id}/images`, { url: images[i].url, is_primary: i === 0 });
      }

      const validVariants = variants.filter((v) => v.label.trim());
      for (const v of validVariants) {
        await apiClient.post(`/products/${product.id}/variants`, {
          label: v.label.trim(),
          sku: v.sku.trim() || undefined,
          price_cents: v.price_cents ? Math.round(parseFloat(v.price_cents) * 100) : undefined,
          stock: v.stock !== "" ? parseInt(v.stock) : undefined,
        });
      }

      toast.success(form.is_published ? "Producto creado y publicado ✓" : "Producto guardado como borrador ✓");
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Error al guardar");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-5 pt-5 pb-10 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-extrabold text-lg" style={{ color: "var(--ink)" }}>Nuevo producto</h2>
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: "var(--surface-2)", border: "1.5px solid var(--line-2)" }}
        >
          <X size={17} style={{ color: "var(--ink-2)" }} />
        </button>
      </div>

      {/* Progreso */}
      <div className="flex items-center gap-1.5 my-4">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex-1">
              <div className="h-1.5 rounded-full mb-1.5" style={{ background: active || done ? "var(--accent)" : "var(--line-2)" }} />
              <p className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color: active ? "var(--accent)" : "var(--ink-4)" }}>
                {n}. {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Paso 1 — Fotos */}
      {step === 1 && (
        <div className="space-y-2">
          <label className="field-label">
            Fotos del producto
            <span className="ml-1 font-normal" style={{ color: "var(--ink-3)" }}>(hasta 6)</span>
          </label>
          <MultiImageUpload images={images} onChange={setImages} maxImages={6} />
        </div>
      )}

      {/* Paso 2 — Información */}
      {step === 2 && (
        <div className="space-y-4">
          <Field label="Nombre del producto" required>
            <input className="input" placeholder="Ej: Polera oversize negra" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </Field>

          <Field label="Categoría">
            <select className="input" value={form.category_id} onChange={(e) => update("category_id", e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
              ))}
            </select>
            {!showNewCategory ? (
              <button type="button" onClick={() => setShowNewCategory(true)} className="text-xs font-bold mt-1.5" style={{ color: "var(--accent)" }}>
                + Nueva categoría
              </button>
            ) : (
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  className="input flex-1"
                  placeholder="Nombre de la categoría"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createCategory())}
                />
                <button
                  type="button"
                  onClick={createCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="rounded-xl text-xs font-bold px-3 py-3 disabled:opacity-50 flex-shrink-0"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Crear
                </button>
              </div>
            )}
          </Field>

          <div>
            <label className="field-label">Descripción</label>
            <RichTextEditor value={form.description} onChange={(html) => update("description", html)} placeholder="Talla, material, colores disponibles..." />
          </div>
        </div>
      )}

      {/* Paso 3 — Precio y stock */}
      {step === 3 && (
        <div className="space-y-4">
          <Field label="Precio de venta" required>
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--line-2)", background: "var(--surface-2)" }}>
              <span className="px-3 font-bold text-sm" style={{ color: "var(--ink-2)", borderRight: "1px solid var(--line-2)" }}>S/</span>
              <input
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                type="number" step="0.10" min="0.10" placeholder="0.00"
                value={form.price_cents}
                onChange={(e) => update("price_cents", e.target.value)}
                style={{ color: "var(--ink)" }}
              />
            </div>
          </Field>

          <Field label="Precio tachado (opcional)" hint="Para mostrar un descuento — déjalo vacío si no aplica.">
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--line-2)", background: "var(--surface-2)" }}>
              <span className="px-3 font-bold text-sm" style={{ color: "var(--ink-2)", borderRight: "1px solid var(--line-2)" }}>S/</span>
              <input
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                type="number" step="0.10" min="0" placeholder="0.00"
                value={form.compare_price}
                onChange={(e) => update("compare_price", e.target.value)}
                style={{ color: "var(--ink)" }}
              />
            </div>
          </Field>

          {!!form.compare_price && (
            <Field label="Oferta termina (opcional)" hint="Se muestra un contador real en tu tienda hasta esta fecha.">
              <input className="input" type="datetime-local" value={form.sale_ends_at} onChange={(e) => update("sale_ends_at", e.target.value)} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock" hint="Vacío = sin límite">
              <input className="input" type="number" min="0" placeholder="Sin límite" value={form.stock} onChange={(e) => update("stock", e.target.value)} />
            </Field>
            <Field label="SKU (opcional)">
              <input className="input" placeholder="Código interno" value={form.sku} onChange={(e) => update("sku", e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* Paso 4 — Variantes */}
      {step === 4 && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Opcional — agrega variantes si vendes el mismo producto en distintas tallas, colores, etc.
            Deja vacío el precio o el stock de una variante para que hereden los del producto.
          </p>
          {variants.map((v) => (
            <div key={v.key} className="rounded-2xl p-3 space-y-2" style={{ border: "1px solid var(--line-2)" }}>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Ej: Talla M - Azul"
                  value={v.label}
                  onChange={(e) => updateVariant(v.key, { label: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setVariants((prev) => prev.filter((x) => x.key !== v.key))}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--danger-soft)" }}
                  aria-label="Quitar variante"
                >
                  <Trash2 size={14} style={{ color: "var(--danger)" }} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className="input text-xs" placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(v.key, { sku: e.target.value })} />
                <input className="input text-xs" type="number" step="0.10" placeholder="Precio" value={v.price_cents} onChange={(e) => updateVariant(v.key, { price_cents: e.target.value })} />
                <input className="input text-xs" type="number" min="0" placeholder="Stock" value={v.stock} onChange={(e) => updateVariant(v.key, { stock: e.target.value })} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
            className="flex items-center justify-center gap-1.5 w-full rounded-xl text-sm font-bold py-3"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px dashed var(--line-2)" }}
          >
            <Plus size={15} /> Agregar variante
          </button>
        </div>
      )}

      {/* Paso 5 — Publicar */}
      {step === 5 && (
        <div className="space-y-4">
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <Toggle
              checked={form.is_published}
              onChange={() => update("is_published", !form.is_published)}
              label="Publicar en la tienda"
              sub={form.is_published ? "Visible para tus clientes" : "Guardado como borrador, no visible aún"}
            />
            <Toggle
              checked={form.is_featured}
              onChange={() => update("is_featured", !form.is_featured)}
              label="Producto destacado"
              sub="Aparece primero en tu tienda"
            />
          </div>

          <div className="rounded-2xl p-3.5 space-y-1" style={{ background: "var(--surface-2)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{form.name || "Sin nombre"}</p>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              {form.price_cents ? `S/ ${parseFloat(form.price_cents).toFixed(2)}` : "Sin precio"}
              {" · "}{images.length} foto{images.length !== 1 ? "s" : ""}
              {variants.filter((v) => v.label.trim()).length > 0 && ` · ${variants.filter((v) => v.label.trim()).length} variante(s)`}
            </p>
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
        {step < 5 ? (
          <button
            type="button"
            disabled={(step === 2 && !canAdvance2) || (step === 3 && !canAdvance3)}
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
            {creating ? "Creando..." : form.is_published ? "Crear y publicar" : "Guardar como borrador"}
          </button>
        )}
      </div>
    </div>
  );
}
