"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Plus, Pencil, Trash2, Package, X,
  Search,
  Star, Eye, EyeOff, Tag, Images, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useSaleCountdown } from "@/hooks/useSaleCountdown";
import { MultiImageUpload, type FormImage } from "@/components/ui/MultiImageUpload";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

/* ── Types ── */
interface Category { id: string; name: string; icon?: string }
interface ProductImage { id: string; url: string; is_primary: boolean }
interface Product {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  compare_price?: number;
  sale_ends_at?: string;
  stock?: number;
  status: string;
  is_featured: boolean;
  category_id?: string;
  images: ProductImage[];
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price_cents: "",
  compare_price: "",
  sale_ends_at: "",
  stock: "",
  category_id: "",
  is_featured: false,
};

/* datetime-local no acepta segundos/zona — recorta a "YYYY-MM-DDTHH:mm" en hora local */
function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FilterStatus = "all" | "active" | "inactive";

/* ── Tiny helpers ── */
function getPrimaryImg(p: Product) {
  return p.images.find((i) => i.is_primary)?.url ?? p.images[0]?.url ?? "";
}

function discountPct(price: number, compare?: number) {
  if (!compare || compare <= price) return null;
  return Math.round(((compare - price) / compare) * 100);
}

/* ════════════════════════════
   PRODUCT CARD (list item)
════════════════════════════ */
function ProductCard({
  product, onEdit, onDelete, onToggleStatus,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const img = getPrimaryImg(product);
  const discount = discountPct(product.price_cents, product.compare_price);
  const active = product.status === "active";
  const countdown = useSaleCountdown(product.sale_ends_at);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="rounded-2xl flex items-center gap-3.5 p-3 transition-all"
      style={{
        background: "var(--surface)",
        border: "1.5px solid var(--line-2)",
        boxShadow: "var(--shadow-sm)",
        opacity: active ? 1 : 0.65,
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden relative"
        style={{ background: "var(--surface-2)" }}
      >
        {img && !imgError ? (
          <Image
            src={img}
            alt={product.name}
            fill
            sizes="64px"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
        )}
        {discount && (
          <span
            className="absolute top-1 left-1 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--danger)" }}
          >
            -{discount}%
          </span>
        )}
        {product.is_featured && (
          <span
            className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "var(--warn)" }}
          >
            <Star size={8} fill="white" color="white" />
          </span>
        )}
        {product.images.length > 1 && (
          <span
            className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full px-1 py-0.5 text-white text-[8px] font-bold"
            style={{ background: "rgba(0,0,0,.5)" }}
          >
            <Images size={8} />
            {product.images.length}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm truncate" style={{ color: "var(--ink)" }}>
          {product.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-display font-bold text-sm" style={{ color: "var(--brand-600)" }}>
            {formatPrice(product.price_cents)}
          </span>
          {product.compare_price && (
            <span className="text-xs line-through" style={{ color: "var(--ink-3)" }}>
              {formatPrice(product.compare_price)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {product.stock != null && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: product.stock > 0 ? "var(--success-soft)" : "var(--danger-soft)",
                color: product.stock > 0 ? "var(--success)" : "var(--danger)",
              }}
            >
              {product.stock > 0 ? `${product.stock} en stock` : "Agotado"}
            </span>
          )}
          {countdown && (
            <span
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
            >
              <Clock size={10} /> Termina en {countdown}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={onToggleStatus}
          title={active ? "Desactivar" : "Activar"}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: active ? "var(--success-soft)" : "var(--surface-2)",
            color: active ? "var(--success)" : "var(--ink-3)",
            border: `1.5px solid ${active ? "var(--line-2)" : "var(--line-2)"}`,
          }}
        >
          {active ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: "var(--surface-2)",
            color: "var(--ink-2)",
            border: "1.5px solid var(--line-2)",
          }}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: "var(--danger-soft)",
            color: "var(--danger)",
            border: "1.5px solid var(--line-2)",
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════
   TOGGLE SWITCH
════════════════════════════ */
function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: () => void; label: string; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3.5"
      style={{ borderBottom: "1px solid var(--line)" }}>
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
        role="switch"
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

/* ════════════════════════════
   FIELD + LABEL
════════════════════════════ */
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

/* ════════════════════════════
   SKELETON
════════════════════════════ */
function Skel({ h = 80 }: { h?: number }) {
  return <div className="skeleton rounded-2xl" style={{ height: h }} />;
}

/* ════════════════════════════
   PAGE
════════════════════════════ */
export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formImages, setFormImages] = useState<FormImage[]>([]);

  /* IDs de imágenes originales al abrir edición (para saber cuáles borrar) */
  const origImagesRef = useRef<ProductImage[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);

  /* ── Data fetching ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        apiClient.get("/products/?limit=100"),
        apiClient.get("/categories/"),
      ]);
      setProducts(pRes.data.items);
      setCategories(cRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Filtered list ── */
  const visible = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ? true :
        filter === "active" ? p.status === "active" :
          p.status !== "active";
    return matchSearch && matchFilter;
  });

  /* ── Open / close form ── */
  function openCreate() {
    setEditId(null);
    origImagesRef.current = [];
    setFormImages([]);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    origImagesRef.current = p.images;
    /* Orden: primary first, luego por sort_order */
    const sorted = [...p.images].sort((a, b) =>
      a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1
    );
    setFormImages(sorted.map((img) => ({ id: img.id, url: img.url })));
    setForm({
      name: p.name,
      description: p.description ?? "",
      price_cents: String(p.price_cents / 100),
      compare_price: p.compare_price ? String(p.compare_price / 100) : "",
      sale_ends_at: toDatetimeLocal(p.sale_ends_at),
      stock: p.stock != null ? String(p.stock) : "",
      category_id: p.category_id ?? "",
      is_featured: p.is_featured,
    });
    setShowForm(true);
  }

  /* ── Save ── */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    const price = parseFloat(form.price_cents);
    if (!price || price <= 0) { toast.error("Precio inválido"); return; }
    if (form.sale_ends_at && !form.compare_price) {
      toast.error("Para poner fecha de fin de oferta, primero define el precio antes del descuento");
      return;
    }

    setSaving(true);
    try {
      /* Eliminar HTML vacío que deja TipTap ("<p></p>") */
      const cleanDesc = form.description.replace(/<p>\s*<\/p>/g, "").trim();

      const payload: Record<string, any> = {
        name: form.name.trim(),
        description: cleanDesc || undefined,
        price_cents: Math.round(price * 100),
        compare_price: form.compare_price ? Math.round(parseFloat(form.compare_price) * 100) : undefined,
        // null explicito (no undefined) para que se pueda borrar la fecha ya puesta
        sale_ends_at: form.sale_ends_at ? new Date(form.sale_ends_at).toISOString() : null,
        stock: form.stock !== "" ? parseInt(form.stock) : undefined,
        category_id: form.category_id || undefined,
        is_featured: form.is_featured,
      };

      if (editId) {
        /* ── Editar ── */
        await apiClient.patch(`/products/${editId}`, payload);

        /* Borrar todas las imágenes originales del servidor */
        await Promise.allSettled(
          origImagesRef.current.map((img) =>
            apiClient.delete(`/products/${editId}/images/${img.id}`)
          )
        );

        /* Re-publicar todas las imágenes en el orden actual */
        for (let i = 0; i < formImages.length; i++) {
          await apiClient.post(`/products/${editId}/images`, {
            url: formImages[i].url,
            is_primary: i === 0,
          });
        }

        toast.success("Producto actualizado ✓");
      } else {
        /* ── Crear ── */
        const { data } = await apiClient.post("/products/", payload);
        for (let i = 0; i < formImages.length; i++) {
          await apiClient.post(`/products/${data.id}/images`, {
            url: formImages[i].url,
            is_primary: i === 0,
          });
        }
        toast.success("Producto creado ✓");
      }

      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  /* ── Toggle status ── */
  async function toggleStatus(p: Product) {
    const newStatus = p.status === "active" ? "inactive" : "active";
    try {
      await apiClient.patch(`/products/${p.id}`, { status: newStatus });
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: newStatus } : x));
      toast.success(newStatus === "active" ? "Producto activado" : "Producto desactivado");
    } catch { toast.error("Error al actualizar"); }
  }

  /* ── Delete ── */
  async function deleteProduct(id: string) {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    try {
      await apiClient.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Producto eliminado");
    } catch { toast.error("Error al eliminar"); }
  }

  /* ── Render ── */
  return (
    <div
      className="max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto pb-8"
      style={{ background: "var(--bg)", minHeight: "100%" }}
    >

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-5 pt-safe pt-5 md:pt-7 pb-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
              Productos
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              {products.length} producto{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary"
            style={{ width: "auto", padding: "10px 16px" }}
          >
            <Plus size={16} /> Agregar
          </button>
        </div>

        {/* Search + filter — apilados en móvil para no desbordar el ancho */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--ink-3)" }}
            />
            <input
              className="input pl-10 text-sm py-2.5"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["all", "active", "inactive"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: filter === f ? "var(--ink)" : "var(--surface)",
                  color: filter === f ? "var(--bg)" : "var(--ink-3)",
                  border: `1.5px solid ${filter === f ? "var(--ink)" : "var(--line-2)"}`,
                }}
              >
                {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="px-5 pt-4 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
        {loading ? (
          [...Array(5)].map((_, i) => <Skel key={i} h={88} />)
        ) : visible.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center animate-fade-in lg:col-span-2 xl:col-span-3">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--surface-2)" }}
            >
              <Package size={36} style={{ color: "var(--ink-4)" }} />
            </div>
            <h3 className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              {search ? "Sin resultados" : "Aún no tienes productos"}
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
              {search
                ? "Prueba con otro nombre o categoría"
                : "Agrega tu primer producto y empieza a vender"}
            </p>
            {!search && (
              <button onClick={openCreate} className="btn-primary" style={{ width: "auto", padding: "12px 24px" }}>
                <Plus size={16} /> Crear primer producto
              </button>
            )}
          </div>
        ) : (
          visible.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProduct(p.id)}
              onToggleStatus={() => toggleStatus(p)}
            />
          ))
        )}
      </div>

      {/* ══════════════════════════════════════
          BOTTOM SHEET FORM
      ══════════════════════════════════════ */}
      {showForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowForm(false)}
          />

          {/* Sheet (móvil/tablet) / Modal centrado (desktop) */}
          <div
            ref={drawerRef}
            className="fixed bottom-0 left-0 right-0 z-50 animate-fade-up rounded-t-[28px] lg:inset-0 lg:bottom-auto lg:m-auto lg:h-fit lg:max-h-[85vh] lg:w-[560px] lg:rounded-[24px]"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--shadow-float)",
              maxHeight: "94dvh",
              overflowY: "auto",
            }}
          >
            {/* Handle (solo móvil) */}
            <div className="flex justify-center pt-3 pb-2 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--ink-4)" }} />
            </div>

            {/* Sheet header */}
            <div
              className="flex items-center justify-between px-5 pb-4"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <h2 className="font-display font-extrabold text-lg" style={{ color: "var(--ink)" }}>
                  {editId ? "Editar producto" : "Nuevo producto"}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {editId ? "Actualiza la información" : "Completa los datos del producto"}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: "var(--surface-2)", border: "1.5px solid var(--line-2)" }}
              >
                <X size={17} style={{ color: "var(--ink-2)" }} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSave} className="px-5 pt-5 pb-10 space-y-5">

              {/* ── Fotos del producto ── */}
              <div>
                <label className="field-label">
                  Fotos del producto
                  <span className="ml-1 font-normal" style={{ color: "var(--ink-3)" }}>
                    (hasta 6)
                  </span>
                </label>
                <MultiImageUpload
                  images={formImages}
                  onChange={setFormImages}
                  maxImages={6}
                />
              </div>

              {/* Name */}
              <Field label="Nombre del producto" required>
                <input
                  className="input"
                  placeholder="Ej: Polera oversize negra"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>

              {/* Description — editor de texto enriquecido */}
              <div>
                <label className="field-label">
                  Descripción
                  <span className="ml-1 font-normal normal-case tracking-normal" style={{ color: "var(--ink-3)" }}>
                    — soporta copiar desde Word
                  </span>
                </label>
                <RichTextEditor
                  key={editId ?? "new"}
                  value={form.description}
                  onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                  placeholder="Talla, material, colores disponibles..."
                />
              </div>

              {/* Prices */}
              <div>
                <label className="field-label">
                  Precios <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div
                      className="flex items-center rounded-xl overflow-hidden"
                      style={{ border: "1.5px solid var(--line-2)", background: "var(--surface-2)" }}
                    >
                      <span
                        className="px-3 font-bold text-sm"
                        style={{ color: "var(--ink-2)", borderRight: "1px solid var(--line-2)" }}
                      >
                        S/
                      </span>
                      <input
                        className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                        type="number"
                        step="0.10"
                        min="0.10"
                        placeholder="0.00"
                        value={form.price_cents}
                        onChange={(e) => setForm((f) => ({ ...f, price_cents: e.target.value }))}
                        style={{ color: "var(--ink)" }}
                      />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>Precio de venta</p>
                  </div>
                  <div>
                    <div
                      className="flex items-center rounded-xl overflow-hidden"
                      style={{ border: "1.5px solid var(--line-2)", background: "var(--surface-2)" }}
                    >
                      <span
                        className="px-3 font-bold text-sm"
                        style={{ color: "var(--ink-2)", borderRight: "1px solid var(--line-2)" }}
                      >
                        S/
                      </span>
                      <input
                        className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                        type="number"
                        step="0.10"
                        min="0"
                        placeholder="0.00"
                        value={form.compare_price}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            compare_price: e.target.value,
                            // Sin precio de oferta no tiene sentido un countdown
                            sale_ends_at: e.target.value ? f.sale_ends_at : "",
                          }))
                        }
                        style={{ color: "var(--ink)" }}
                      />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>
                      Precio tachado{" "}
                      {form.price_cents && form.compare_price &&
                        parseFloat(form.compare_price) > parseFloat(form.price_cents) ? (
                        <span style={{ color: "var(--danger)", fontWeight: 700 }}>
                          (-{Math.round(
                            ((parseFloat(form.compare_price) - parseFloat(form.price_cents)) /
                              parseFloat(form.compare_price)) * 100
                          )}%)
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>

              {/* Countdown de oferta — solo tiene sentido si hay precio de descuento */}
              {!!form.compare_price && (
                <Field label="Oferta termina (opcional)">
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.sale_ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, sale_ends_at: e.target.value }))}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>
                    {form.sale_ends_at
                      ? "Se muestra un contador real en tu tienda hasta esta fecha."
                      : "Déjalo vacío para un descuento sin fecha de vencimiento."}
                  </p>
                </Field>
              )}

              {/* Stock + Category */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stock">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Sin límite"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  />
                </Field>
                <Field label="Categoría">
                  <select
                    className="input"
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    style={{ appearance: "none" }}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}{c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Toggles */}
              <div style={{ borderTop: "1px solid var(--line)" }}>
                <Toggle
                  checked={form.is_featured}
                  onChange={() => setForm((f) => ({ ...f, is_featured: !f.is_featured }))}
                  label="Producto destacado"
                  sub="Aparece primero en tu tienda"
                />
              </div>

              {/* Discount preview */}
              {form.price_cents && form.compare_price &&
                parseFloat(form.compare_price) > parseFloat(form.price_cents) && (
                  <div
                    className="rounded-2xl p-3 flex items-center gap-3"
                    style={{ background: "var(--warn-soft)", border: "1.5px solid var(--line-2)" }}
                  >
                    <Tag size={16} style={{ color: "var(--warn)", flexShrink: 0 }} />
                    <p className="text-xs font-semibold" style={{ color: "var(--warn)" }}>
                      Descuento activo: clientes verán{" "}
                      <strong style={{ color: "var(--warn)" }}>
                        {formatPrice(Math.round(parseFloat(form.price_cents) * 100))}
                      </strong>{" "}
                      en lugar de{" "}
                      <s>{formatPrice(Math.round(parseFloat(form.compare_price) * 100))}</s>
                    </p>
                  </div>
                )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
                style={{ marginTop: 8 }}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                    </svg>
                    Guardando...
                  </span>
                ) : editId ? "Guardar cambios" : "Crear producto"}
              </button>

            </form>
          </div>
        </>
      )}
    </div>
  );
}
