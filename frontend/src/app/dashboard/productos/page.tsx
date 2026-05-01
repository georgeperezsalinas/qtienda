"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Package, X, Check, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price_cents: number;
  compare_price?: number;
  stock?: number;
  status: string;
  is_featured: boolean;
  category_id?: string;
  images: { url: string; is_primary: boolean }[];
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price_cents: "",
  compare_price: "",
  stock: "",
  category_id: "",
  is_featured: false,
  image_url: "",
};

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get("/products/?limit=100"),
        apiClient.get("/categories/"),
      ]);
      setProducts(prodRes.data.items);
      setCategories(catRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: "",
      price_cents: String(p.price_cents / 100),
      compare_price: p.compare_price ? String(p.compare_price / 100) : "",
      stock: p.stock != null ? String(p.stock) : "",
      category_id: p.category_id || "",
      is_featured: p.is_featured,
      image_url: p.images.find((i) => i.is_primary)?.url || p.images[0]?.url || "",
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    const priceNum = parseFloat(form.price_cents);
    if (!priceNum || priceNum <= 0) { toast.error("Precio inválido"); return; }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price_cents: Math.round(priceNum * 100),
        compare_price: form.compare_price ? Math.round(parseFloat(form.compare_price) * 100) : undefined,
        stock: form.stock !== "" ? parseInt(form.stock) : undefined,
        category_id: form.category_id || undefined,
        is_featured: form.is_featured,
      };

      let productId = editId;

      if (editId) {
        await apiClient.patch(`/products/${editId}`, payload);
        toast.success("Producto actualizado");
      } else {
        const { data } = await apiClient.post("/products/", payload);
        productId = data.id;
        toast.success("Producto creado");
      }

      // Add image if provided and it's a new product or image changed
      if (form.image_url.trim() && productId && !editId) {
        await apiClient.post(`/products/${productId}/images`, {
          url: form.image_url.trim(),
          is_primary: true,
        });
      }

      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(p: Product) {
    const newStatus = p.status === "active" ? "inactive" : "active";
    try {
      await apiClient.patch(`/products/${p.id}`, { status: newStatus });
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: newStatus } : x));
    } catch {
      toast.error("Error al actualizar");
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await apiClient.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Producto eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-bold text-xl text-gray-900">Productos</h1>
        <button onClick={openCreate} className="btn-primary py-2.5 px-4 bg-brand-600">
          <Plus size={16} />
          Agregar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-40" />
          <p className="mb-4">Sin productos aún</p>
          <button onClick={openCreate} className="btn-primary bg-brand-600">
            <Plus size={16} />
            Crear primer producto
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const img = p.images.find((i) => i.is_primary)?.url || p.images[0]?.url;
            return (
              <div key={p.id} className="card p-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden">
                  {img ? (
                    <img src={img} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{p.name}</p>
                  <p className="text-sm font-bold text-brand-600">{formatPrice(p.price_cents)}</p>
                  {p.stock != null && (
                    <p className="text-xs text-gray-400">Stock: {p.stock}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleStatus(p)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      p.status === "active"
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                    title={p.status === "active" ? "Activo — click para desactivar" : "Inactivo — click para activar"}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteProduct(p.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form drawer */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-5 pb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-lg">
                  {editId ? "Editar producto" : "Nuevo producto"}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    Nombre *
                  </label>
                  <input
                    className="input"
                    placeholder="Ej: Torta de chocolate"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    placeholder="Descripción del producto..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                      Precio (S/) *
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.10"
                      min="0.10"
                      placeholder="25.00"
                      value={form.price_cents}
                      onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                      Precio tachado
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.10"
                      min="0"
                      placeholder="35.00"
                      value={form.compare_price}
                      onChange={(e) => setForm({ ...form, compare_price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                      Stock
                    </label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="Sin límite"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                      Categoría
                    </label>
                    <select
                      className="input"
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    URL de imagen
                  </label>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://..."
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  />
                  {form.image_url && (
                    <img
                      src={form.image_url}
                      alt="preview"
                      className="mt-2 w-20 h-20 rounded-xl object-cover bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      form.is_featured ? "bg-brand-600" : "bg-gray-200"
                    }`}
                    onClick={() => setForm({ ...form, is_featured: !form.is_featured })}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        form.is_featured ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Destacar producto</span>
                </label>

                <button type="submit" disabled={saving} className="btn-primary w-full bg-brand-600">
                  {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear producto"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
