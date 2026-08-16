"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus, Trash2, Package, PackagePlus, X,
  Search, Copy, CheckSquare, Square, Percent,
  Star, Eye, EyeOff, Tag, Images, Clock, ChevronDown,
  Download, Check, Store, MoreVertical,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useSaleCountdown } from "@/hooks/useSaleCountdown";
import { useStoreCurrency } from "@/hooks/useStoreCurrency";
import { MultiImageUpload, type FormImage } from "@/components/ui/MultiImageUpload";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ProductCreationWizard } from "@/components/dashboard/ProductCreationWizard";

/* ── Types ── */
interface Category { id: string; name: string; icon?: string }
interface ProductImage { id: string; url: string; is_primary: boolean }
interface ProductVariant { id: string; label: string; sku?: string; price_cents?: number; stock?: number; sort_order?: number }
interface Product {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  compare_price?: number;
  sale_ends_at?: string;
  stock?: number;
  sku?: string;
  status: string;
  is_featured: boolean;
  category_id?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  sold_count?: number;
}

// Debe coincidir con LOW_STOCK_THRESHOLD en backend/app/core/config.py —
// no hay endpoint que lo exponga, y no vale la pena uno para un solo entero.
const LOW_STOCK_THRESHOLD = 3;

/* Fila de variante en el formulario de edición — `id` presente = ya existe
   en el backend (PATCH al guardar), ausente = fila nueva (POST al guardar).
   `key` es solo para el key de React, nunca se envía. */
interface VariantRow {
  key: string;
  id?: string;
  label: string;
  sku: string;
  price_cents: string;
  stock: string;
}

function emptyVariantRow(): VariantRow {
  return { key: crypto.randomUUID(), label: "", sku: "", price_cents: "", stock: "" };
}

type SortKey = "recent" | "best_selling" | "low_stock" | "price_asc" | "price_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "best_selling", label: "Más vendidos" },
  { value: "low_stock", label: "Stock más bajo" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price_cents: "",
  compare_price: "",
  sale_ends_at: "",
  stock: "",
  sku: "",
  category_id: "",
  is_featured: false,
  is_published: false,
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
  product, onEdit, onDelete, onToggleStatus, onDuplicate, duplicating,
  selectMode, selected, onToggleSelect, currency, locale, onQuickUpdate,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  currency: string;
  locale: string;
  onQuickUpdate: (field: "price_cents" | "stock", value: number) => Promise<boolean>;
}) {
  const img = getPrimaryImg(product);
  const discount = discountPct(product.price_cents, product.compare_price);
  const active = product.status === "active";
  const countdown = useSaleCountdown(product.sale_ends_at);
  const [imgError, setImgError] = useState(false);
  const [editingField, setEditingField] = useState<"price" | "stock" | null>(null);
  const [quickValue, setQuickValue] = useState("");
  const [savedFlash, setSavedFlash] = useState<"price" | "stock" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  function startQuickEdit(field: "price" | "stock", e: React.MouseEvent) {
    if (selectMode) return;
    e.stopPropagation();
    setEditingField(field);
    setQuickValue(field === "price" ? String(product.price_cents / 100) : String(product.stock ?? ""));
    setTimeout(() => { quickInputRef.current?.focus(); quickInputRef.current?.select(); }, 0);
  }

  async function commitQuickEdit() {
    if (!editingField) return;
    const field = editingField;
    const raw = quickValue.trim();
    setEditingField(null);
    if (raw === "") return;
    const num = field === "price" ? Math.round(parseFloat(raw) * 100) : parseInt(raw, 10);
    if (isNaN(num) || num < 0) { toast.error("Valor inválido"); return; }
    if (field === "price" && num === product.price_cents) return;
    if (field === "stock" && num === product.stock) return;
    const ok = await onQuickUpdate(field === "price" ? "price_cents" : "stock", num);
    if (ok) {
      setSavedFlash(field);
      setTimeout(() => setSavedFlash(null), 1200);
    }
  }

  function quickEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.currentTarget.blur(); }
    else if (e.key === "Escape") { setEditingField(null); }
  }

  return (
    <div
      onClick={selectMode ? onToggleSelect : onEdit}
      className="rounded-2xl flex items-center gap-3.5 p-3 transition-all active:scale-[.99]"
      style={{
        background: "var(--surface)",
        border: `1.5px solid ${selected ? "var(--brand-600)" : "var(--line-2)"}`,
        boxShadow: "var(--shadow-sm)",
        opacity: active ? 1 : 0.65,
        cursor: "pointer",
      }}
    >
      {/* Checkbox (modo selección) */}
      {selectMode && (
        <div className="flex-shrink-0" style={{ color: selected ? "var(--brand-600)" : "var(--ink-4)" }}>
          {selected ? <CheckSquare size={20} /> : <Square size={20} />}
        </div>
      )}

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
          {editingField === "price" ? (
            <input
              ref={quickInputRef}
              type="number"
              step="0.10"
              min="0.10"
              className="input py-0.5 px-1.5 text-sm font-bold"
              style={{ width: 80, color: "var(--brand-600)" }}
              value={quickValue}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setQuickValue(e.target.value)}
              onBlur={commitQuickEdit}
              onKeyDown={quickEditKeyDown}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => startQuickEdit("price", e)}
              className="font-display font-bold text-sm flex items-center gap-1 rounded transition-colors"
              style={{ color: "var(--brand-600)" }}
              title="Click para editar el precio"
            >
              {formatPrice(product.price_cents, currency, locale)}
              {savedFlash === "price" && <Check size={12} style={{ color: "var(--success)" }} />}
            </button>
          )}
          {product.compare_price && (
            <span className="text-xs line-through" style={{ color: "var(--ink-3)" }}>
              {formatPrice(product.compare_price, currency, locale)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {product.stock != null && (
            editingField === "stock" ? (
              <input
                ref={quickInputRef}
                type="number"
                min="0"
                className="input py-0.5 px-1.5 text-[10px] font-semibold"
                style={{ width: 64 }}
                value={quickValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setQuickValue(e.target.value)}
                onBlur={commitQuickEdit}
                onKeyDown={quickEditKeyDown}
              />
            ) : (
              <button
                type="button"
                onClick={(e) => startQuickEdit("stock", e)}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: product.stock > 0 ? "var(--success-soft)" : "var(--danger-soft)",
                  color: product.stock > 0 ? "var(--success)" : "var(--danger)",
                }}
                title="Click para editar el stock"
              >
                {product.stock > 0 ? `${product.stock} en stock` : "Agotado"}
                {savedFlash === "stock" && <Check size={10} />}
              </button>
            )
          )}
          {product.stock != null && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
            >
              ⚠ Stock bajo
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

      {/* Actions — 2 botones grandes (44px, cómodos para el dedo) en vez de
         4 chicos: tocar la tarjeta ya abre edición, así que el lápiz sobra. */}
      {!selectMode && (
        <div
          className="flex flex-col gap-1.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onToggleStatus}
            title={active ? "Desactivar" : "Activar"}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{
              background: active ? "var(--success-soft)" : "var(--surface-2)",
              color: active ? "var(--success)" : "var(--ink-3)",
              border: "1.5px solid var(--line-2)",
            }}
          >
            {active ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="Más acciones"
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{
                background: menuOpen ? "var(--ink)" : "var(--surface-2)",
                color: menuOpen ? "var(--bg)" : "var(--ink-2)",
                border: "1.5px solid var(--line-2)",
              }}
            >
              <MoreVertical size={17} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden"
                  style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", border: "1px solid var(--line)", minWidth: 168 }}
                >
                  <button
                    onClick={() => { setMenuOpen(false); onDuplicate(); }}
                    disabled={duplicating}
                    className="flex items-center gap-2.5 w-full px-4 py-3.5 text-sm font-medium whitespace-nowrap disabled:opacity-50"
                    style={{ color: "var(--ink-2)" }}
                  >
                    <Copy size={16} /> {duplicating ? "Duplicando..." : "Duplicar"}
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                    className="flex items-center gap-2.5 w-full px-4 py-3.5 text-sm font-medium whitespace-nowrap"
                    style={{ color: "var(--danger)", borderTop: "1px solid var(--line)" }}
                  >
                    <Trash2 size={16} /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmar eliminación — reemplaza el confirm() nativo del navegador */}
      {confirmDelete && (
        <>
          <div
            className="fixed inset-0 z-[70]"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
          />
          <div
            className="fixed z-[71] left-1/2 top-1/2 w-[88vw] max-w-xs rounded-[24px] p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
              ¿Eliminar producto?
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              "{product.name}" se eliminará. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
                style={{ background: "var(--danger)" }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </>
      )}
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
  const { code: currency, locale } = useStoreCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formImages, setFormImages] = useState<FormImage[]>([]);
  const [formVariants, setFormVariants] = useState<VariantRow[]>([]);
  const origVariantsRef = useRef<ProductVariant[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockDelta, setStockDelta] = useState("");
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [exporting, setExporting] = useState(false);
  // Vendedor recién registrado, sin tienda todavía — /products/ responde 404
  // ("No tienes una tienda activa") en vez de una lista vacía.
  const [noStore, setNoStore] = useState(false);

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
      setNoStore(false);
    } catch (err: any) {
      if (err.response?.status === 404) setNoStore(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Filtered + sorted list ── */
  const visible = products
    .filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchFilter =
        filter === "all" ? true :
          filter === "active" ? p.status === "active" :
            p.status !== "active";
      const matchCategory = categoryFilter === "all" || p.category_id === categoryFilter;
      return matchSearch && matchFilter && matchCategory;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "best_selling":
          return (b.sold_count ?? 0) - (a.sold_count ?? 0);
        case "low_stock":
          // Sin límite de stock (null) va al final — no es "poco stock", es infinito.
          if (a.stock == null && b.stock == null) return 0;
          if (a.stock == null) return 1;
          if (b.stock == null) return -1;
          return a.stock - b.stock;
        case "price_asc":
          return a.price_cents - b.price_cents;
        case "price_desc":
          return b.price_cents - a.price_cents;
        default:
          return 0; // "recent" — el orden que ya trae del servidor
      }
    });

  /* ── Edición rápida de precio/stock (sin abrir el modal completo) ── */
  async function quickUpdate(id: string, field: "price_cents" | "stock", value: number): Promise<boolean> {
    try {
      await apiClient.patch(`/products/${id}`, { [field]: value });
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo guardar");
      return false;
    }
  }

  /* ── Exportar CSV ── */
  async function exportCSV() {
    if (visible.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }
    setExporting(true);
    try {
      const header = ["Nombre", "Precio", "Stock", "Categoría", "Estado", "Vendidos"];
      const rows = visible.map((p) => [
        p.name,
        (p.price_cents / 100).toFixed(2),
        p.stock != null ? String(p.stock) : "Ilimitado",
        categories.find((c) => c.id === p.category_id)?.name ?? "",
        p.status === "active" ? "Activo" : "Inactivo",
        String(p.sold_count ?? 0),
      ]);
      const csv = [header, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `productos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  /* ── Open / close form ── */
  function openCreate() {
    setShowWizard(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    origImagesRef.current = p.images;
    /* Orden: primary first, luego por sort_order */
    const sorted = [...p.images].sort((a, b) =>
      a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1
    );
    setFormImages(sorted.map((img) => ({ id: img.id, url: img.url })));
    origVariantsRef.current = p.variants;
    setFormVariants(
      [...p.variants].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((v) => ({
        key: v.id,
        id: v.id,
        label: v.label,
        sku: v.sku ?? "",
        price_cents: v.price_cents != null ? String(v.price_cents / 100) : "",
        stock: v.stock != null ? String(v.stock) : "",
      }))
    );
    setForm({
      name: p.name,
      description: p.description ?? "",
      price_cents: String(p.price_cents / 100),
      compare_price: p.compare_price ? String(p.compare_price / 100) : "",
      sale_ends_at: toDatetimeLocal(p.sale_ends_at),
      stock: p.stock != null ? String(p.stock) : "",
      sku: p.sku ?? "",
      category_id: p.category_id ?? "",
      is_featured: p.is_featured,
      is_published: p.status === "active",
    });
    setShowForm(true);
  }

  /* ── Save ── */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return; // este formulario ahora solo edita — crear pasa por el wizard
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
        sku: form.sku.trim() || undefined,
        category_id: form.category_id || undefined,
        is_featured: form.is_featured,
        status: form.is_published ? "active" : "inactive",
      };

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

      /* Variantes: diff real (no wholesale-replace como las imágenes) — sus
         ids quedan referenciados por OrderItem.variant_id en pedidos
         históricos, recrearlas huerfanaría esa referencia sin necesidad. */
      const keepVariants = formVariants.filter((v) => v.label.trim());
      const toDeleteVariants = origVariantsRef.current.filter(
        (o) => !keepVariants.some((k) => k.id === o.id)
      );
      await Promise.allSettled(
        toDeleteVariants.map((v) => apiClient.delete(`/products/${editId}/variants/${v.id}`))
      );
      for (const v of keepVariants) {
        const body = {
          label: v.label.trim(),
          sku: v.sku.trim() || null,
          price_cents: v.price_cents ? Math.round(parseFloat(v.price_cents) * 100) : null,
          stock: v.stock !== "" ? parseInt(v.stock) : null,
        };
        if (v.id) {
          await apiClient.patch(`/products/${editId}/variants/${v.id}`, body);
        } else {
          await apiClient.post(`/products/${editId}/variants`, body);
        }
      }

      toast.success("Producto actualizado ✓");
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

  /* ── Delete (la confirmación ya se resolvió antes de llegar acá — en el
     menú del producto o en el modal de eliminación masiva) ── */
  async function deleteProduct(id: string) {
    try {
      await apiClient.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Producto eliminado");
    } catch { toast.error("Error al eliminar"); }
  }

  /* ── Duplicate ── */
  async function duplicateProduct(id: string) {
    setDuplicating(id);
    try {
      const { data } = await apiClient.post(`/products/${id}/duplicate`);
      setProducts((prev) => [data, ...prev]);
      toast.success("Producto duplicado como borrador ✓");
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Error al duplicar");
    } finally {
      setDuplicating(null);
    }
  }

  /* ── Selection mode ── */
  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Bulk actions ── */
  async function runBulkAction(
    action: "activate" | "deactivate" | "delete" | "discount_percent" | "adjust_stock",
    extra?: { percent?: number; stockDelta?: number }
  ) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const body: Record<string, any> = {
        product_ids: Array.from(selectedIds),
        action,
      };
      if (extra?.percent != null) body.percent = extra.percent;
      if (extra?.stockDelta != null) body.stock_delta = extra.stockDelta;
      await apiClient.post("/products/bulk-action", body);
      toast.success("Productos actualizados ✓");
      setSelectMode(false);
      setSelectedIds(new Set());
      setShowDiscountModal(false);
      setDiscountPercent("");
      setShowStockModal(false);
      setStockDelta("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "Error al actualizar");
    } finally {
      setBulkBusy(false);
    }
  }

  function applyDiscount() {
    const pct = parseFloat(discountPercent);
    if (!pct || pct === 0 || Math.abs(pct) > 90) {
      toast.error("Ingresa un porcentaje válido (hasta 90%)");
      return;
    }
    runBulkAction("discount_percent", { percent: -Math.abs(pct) });
  }

  function applyStockAdjust() {
    const delta = parseInt(stockDelta, 10);
    if (!delta || delta === 0) {
      toast.error("Ingresa una cantidad distinta de 0");
      return;
    }
    runBulkAction("adjust_stock", { stockDelta: delta });
  }

  /* ── Render ── */
  return (
    <div
      className="max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto pb-8"
      style={{ background: "var(--bg)", minHeight: "100%" }}
    >

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-5 pt-[max(20px,env(safe-area-inset-top))] md:pt-[max(28px,env(safe-area-inset-top))] pb-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
              Productos
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              {products.length} producto{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {products.length > 0 && (
              <button
                onClick={exportCSV}
                disabled={exporting}
                title="Exportar catálogo a CSV"
                className="rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                style={{
                  padding: "10px",
                  background: "var(--surface)",
                  color: "var(--ink-2)",
                  border: "1.5px solid var(--line-2)",
                }}
              >
                <Download size={14} /> <span className="hidden sm:inline">{exporting ? "..." : "CSV"}</span>
              </button>
            )}
            {products.length > 0 && (
              <button
                onClick={toggleSelectMode}
                title={selectMode ? "Cancelar selección" : "Seleccionar productos"}
                className="rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
                style={{
                  padding: "10px",
                  background: selectMode ? "var(--ink)" : "var(--surface)",
                  color: selectMode ? "var(--bg)" : "var(--ink-2)",
                  border: `1.5px solid ${selectMode ? "var(--ink)" : "var(--line-2)"}`,
                }}
              >
                <CheckSquare size={14} /> <span className="hidden sm:inline">{selectMode ? "Cancelar" : "Seleccionar"}</span>
              </button>
            )}
            <button
              onClick={openCreate}
              className="btn-primary flex-shrink-0"
              style={{ width: "auto", padding: "10px 14px" }}
            >
              <Plus size={16} /> Agregar
            </button>
          </div>
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

        {/* Filtro por categoría */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto mt-2 pb-0.5" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setCategoryFilter("all")}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: categoryFilter === "all" ? "var(--accent-soft)" : "var(--surface)",
                color: categoryFilter === "all" ? "var(--accent-ink)" : "var(--ink-3)",
                border: `1.5px solid ${categoryFilter === "all" ? "var(--accent)" : "var(--line-2)"}`,
              }}
            >
              Todas las categorías
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  background: categoryFilter === c.id ? "var(--accent-soft)" : "var(--surface)",
                  color: categoryFilter === c.id ? "var(--accent-ink)" : "var(--ink-3)",
                  border: `1.5px solid ${categoryFilter === c.id ? "var(--accent)" : "var(--line-2)"}`,
                }}
              >
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </button>
            ))}
          </div>
        )}

        {/* Orden */}
        <div className="mt-2">
          <div className="relative inline-block">
            <select
              className="input pr-8 py-2 text-xs font-semibold w-auto"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              style={{ appearance: "none" }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--ink-3)" }}
            />
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="px-5 pt-4 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
        {loading ? (
          [...Array(5)].map((_, i) => <Skel key={i} h={88} />)
        ) : noStore ? (
          <div className="py-20 flex flex-col items-center text-center animate-fade-in lg:col-span-2 xl:col-span-3">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--surface-2)" }}
            >
              <Store size={36} style={{ color: "var(--ink-4)" }} />
            </div>
            <h3 className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              Todavía no tienes una tienda creada
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
              Crea tu tienda primero para poder agregar productos
            </p>
            <Link href="/dashboard/configuracion" className="btn-primary" style={{ width: "auto", padding: "12px 24px" }}>
              Crear tienda
            </Link>
          </div>
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
              onDuplicate={() => duplicateProduct(p.id)}
              duplicating={duplicating === p.id}
              selectMode={selectMode}
              selected={selectedIds.has(p.id)}
              onToggleSelect={() => toggleSelected(p.id)}
              currency={currency}
              locale={locale}
              onQuickUpdate={(field, value) => quickUpdate(p.id, field, value)}
            />
          ))
        )}
      </div>

      {/* ══════════════════════════════════════
          WIZARD DE CREACIÓN (producto nuevo)
      ══════════════════════════════════════ */}
      {showWizard && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowWizard(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 animate-fade-up rounded-t-[28px] lg:inset-0 lg:bottom-auto lg:m-auto lg:h-fit lg:max-h-[85vh] lg:w-[560px] lg:rounded-[24px]"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--shadow-float)",
              maxHeight: "94dvh",
              overflowY: "auto",
            }}
          >
            <div className="flex justify-center pt-3 pb-2 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--ink-4)" }} />
            </div>
            <ProductCreationWizard
              categories={categories}
              onCategoryCreated={(c) => setCategories((prev) => [...prev, c])}
              onCreated={() => { setShowWizard(false); fetchAll(); }}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          BOTTOM SHEET FORM (edición)
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
                  Editar producto
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  Actualiza la información
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
                  <div className="relative">
                    <select
                      className="input pr-8"
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
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--ink-3)" }}
                    />
                  </div>
                </Field>
              </div>

              <Field label="SKU (opcional)">
                <input
                  className="input"
                  placeholder="Código interno"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </Field>

              {/* Variantes */}
              <div>
                <label className="field-label">
                  Variantes
                  <span className="ml-1 font-normal" style={{ color: "var(--ink-3)" }}>(opcional)</span>
                </label>
                <div className="space-y-2 mt-1.5">
                  {formVariants.map((v) => (
                    <div key={v.key} className="rounded-2xl p-3 space-y-2" style={{ border: "1px solid var(--line-2)" }}>
                      <div className="flex items-center gap-2">
                        <input
                          className="input flex-1"
                          placeholder="Ej: Talla M - Azul"
                          value={v.label}
                          onChange={(e) => setFormVariants((prev) => prev.map((x) => x.key === v.key ? { ...x, label: e.target.value } : x))}
                        />
                        <button
                          type="button"
                          onClick={() => setFormVariants((prev) => prev.filter((x) => x.key !== v.key))}
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "var(--danger-soft)" }}
                          aria-label="Quitar variante"
                        >
                          <Trash2 size={14} style={{ color: "var(--danger)" }} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input className="input text-xs" placeholder="SKU" value={v.sku} onChange={(e) => setFormVariants((prev) => prev.map((x) => x.key === v.key ? { ...x, sku: e.target.value } : x))} />
                        <input className="input text-xs" type="number" step="0.10" placeholder="Precio" value={v.price_cents} onChange={(e) => setFormVariants((prev) => prev.map((x) => x.key === v.key ? { ...x, price_cents: e.target.value } : x))} />
                        <input className="input text-xs" type="number" min="0" placeholder="Stock" value={v.stock} onChange={(e) => setFormVariants((prev) => prev.map((x) => x.key === v.key ? { ...x, stock: e.target.value } : x))} />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormVariants((prev) => [...prev, emptyVariantRow()])}
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl text-sm font-bold py-3"
                    style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px dashed var(--line-2)" }}
                  >
                    <Plus size={15} /> Agregar variante
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ borderTop: "1px solid var(--line)" }}>
                <Toggle
                  checked={form.is_published}
                  onChange={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
                  label="Publicar en la tienda"
                  sub={form.is_published ? "Visible para tus clientes" : "Guardado como borrador, no visible aún"}
                />
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
                        {formatPrice(Math.round(parseFloat(form.price_cents) * 100), currency, locale)}
                      </strong>{" "}
                      en lugar de{" "}
                      <s>{formatPrice(Math.round(parseFloat(form.compare_price) * 100), currency, locale)}</s>
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
                ) : "Guardar cambios"}
              </button>

            </form>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          BARRA DE ACCIONES MASIVAS
      ══════════════════════════════════════ */}
      {selectMode && selectedIds.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 animate-fade-up px-4 pb-safe pb-4 pt-3"
          style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", boxShadow: "var(--shadow-float)" }}
        >
          <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto flex items-center gap-2">
            <span className="text-xs font-bold flex-shrink-0" style={{ color: "var(--ink-2)" }}>
              {selectedIds.size} sel.
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => runBulkAction("activate")}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: "var(--success-soft)", color: "var(--success)", border: "1.5px solid var(--line-2)" }}
              >
                <Eye size={13} /> Activar
              </button>
              <button
                onClick={() => runBulkAction("deactivate")}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
              >
                <EyeOff size={13} /> Desactivar
              </button>
              <button
                onClick={() => setShowDiscountModal(true)}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "1.5px solid var(--line-2)" }}
              >
                <Percent size={13} /> Descuento
              </button>
              <button
                onClick={() => setShowStockModal(true)}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
              >
                <PackagePlus size={13} /> Stock
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1.5px solid var(--line-2)" }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODAL: DESCUENTO MASIVO
      ══════════════════════════════════════ */}
      {showDiscountModal && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowDiscountModal(false)}
          />
          <div
            className="fixed z-[70] left-1/2 top-1/2 w-[90vw] max-w-sm rounded-[24px] p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
          >
            <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
              Aplicar descuento
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Reduce el precio de {selectedIds.size} producto(s) seleccionado(s) en un porcentaje.
            </p>
            <Field label="Porcentaje de descuento" required>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: "1.5px solid var(--line-2)", background: "var(--surface-2)" }}
              >
                <input
                  className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                  type="number"
                  min="1"
                  max="90"
                  placeholder="Ej: 10"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  style={{ color: "var(--ink)" }}
                  autoFocus
                />
                <span
                  className="px-3 font-bold text-sm"
                  style={{ color: "var(--ink-2)", borderLeft: "1px solid var(--line-2)" }}
                >
                  %
                </span>
              </div>
            </Field>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
              >
                Cancelar
              </button>
              <button
                onClick={applyDiscount}
                disabled={bulkBusy}
                className="flex-1 btn-primary"
                style={{ padding: "12px" }}
              >
                {bulkBusy ? "Aplicando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          MODAL: AJUSTAR STOCK MASIVO
      ══════════════════════════════════════ */}
      {showStockModal && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowStockModal(false)}
          />
          <div
            className="fixed z-[70] left-1/2 top-1/2 w-[90vw] max-w-sm rounded-[24px] p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
          >
            <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
              Ajustar stock
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Suma o resta unidades al stock de {selectedIds.size} producto(s) seleccionado(s) —
              útil cuando llega mercadería nueva. Los productos con stock ilimitado se saltan.
            </p>
            <Field label="Cantidad (negativo para restar)" required>
              <input
                className="input"
                type="number"
                placeholder="Ej: 10 ó -5"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                autoFocus
              />
            </Field>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
              >
                Cancelar
              </button>
              <button
                onClick={applyStockAdjust}
                disabled={bulkBusy}
                className="flex-1 btn-primary"
                style={{ padding: "12px" }}
              >
                {bulkBusy ? "Aplicando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          MODAL: CONFIRMAR ELIMINACIÓN MASIVA
      ══════════════════════════════════════ */}
      {showBulkDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowBulkDeleteConfirm(false)}
          />
          <div
            className="fixed z-[70] left-1/2 top-1/2 w-[90vw] max-w-sm rounded-[24px] p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
          >
            <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
              ¿Eliminar {selectedIds.size} producto{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowBulkDeleteConfirm(false); runBulkAction("delete"); }}
                disabled={bulkBusy}
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "var(--danger)" }}
              >
                {bulkBusy ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
