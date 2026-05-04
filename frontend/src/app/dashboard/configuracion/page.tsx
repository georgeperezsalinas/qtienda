"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Save, Plus, Trash2, Bike, Eye, EyeOff, UserX } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ImageUpload } from "@/components/ui/ImageUpload";

interface StoreData {
  id: string;
  slug: string;
  name: string;
  description?: string;
  whatsapp?: string;
  primary_color: string;
  logo_url?: string;
  banner_url?: string;
  city?: string;
  meta_title?: string;
  meta_desc?: string;
  settings?: {
    accept_cash: boolean;
    accept_yape: boolean;
    accept_plin: boolean;
    yape_phone?: string;
    plin_phone?: string;
    bank_account?: string;
    delivery_fee_cents: number;
    min_order_cents: number;
    free_delivery_above?: number;
  } | null;
}

interface CategoryForm {
  name: string;
  icon: string;
}

const COLORS = ["#6366f1", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

export default function ConfiguracionPage() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noStore, setNoStore] = useState(false);

  // Store form
  const [info, setInfo] = useState({
    name: "", description: "", whatsapp: "",
    primary_color: "#6366f1", logo_url: "", banner_url: "", city: "",
  });

  // Settings form
  const [settings, setSettings] = useState({
    accept_cash: true, accept_yape: false, accept_plin: false,
    yape_phone: "", plin_phone: "", bank_account: "",
    delivery_fee_cents: "0", min_order_cents: "0", free_delivery_above: "",
  });

  // Create store form
  const [newStore, setNewStore] = useState({ slug: "", name: "", whatsapp: "", city: "" });
  const [creating, setCreating] = useState(false);

  // Categories
  const [categories, setCategories] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [catForm, setCatForm] = useState<CategoryForm>({ name: "", icon: "" });
  const [addingCat, setAddingCat] = useState(false);

  // Delivery staff
  interface StaffMember { id: string; full_name: string; email: string; phone?: string; is_active: boolean }
  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [staffForm,   setStaffForm]   = useState({ full_name: "", email: "", password: "", phone: "" });
  const [showPass,    setShowPass]    = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data: storeData } = await apiClient.get("/stores/me");
        setStore(storeData);
        setInfo({
          name: storeData.name || "",
          description: storeData.description || "",
          whatsapp: storeData.whatsapp || "",
          primary_color: storeData.primary_color || "#6366f1",
          logo_url: storeData.logo_url || "",
          banner_url: storeData.banner_url || "",
          city: storeData.city || "",
        });
        if (storeData.settings) {
          setSettings({
            accept_cash: storeData.settings.accept_cash,
            accept_yape: storeData.settings.accept_yape,
            accept_plin: storeData.settings.accept_plin,
            yape_phone: storeData.settings.yape_phone || "",
            plin_phone: storeData.settings.plin_phone || "",
            bank_account: storeData.settings.bank_account || "",
            delivery_fee_cents: String(storeData.settings.delivery_fee_cents / 100),
            min_order_cents: String(storeData.settings.min_order_cents / 100),
            free_delivery_above: storeData.settings.free_delivery_above
              ? String(storeData.settings.free_delivery_above / 100)
              : "",
          });
        }
        const [{ data: cats }, { data: staffData }] = await Promise.all([
          apiClient.get("/categories/"),
          apiClient.get("/delivery/staff"),
        ]);
        setCategories(cats);
        setStaff(staffData);
      } catch {
        setNoStore(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createStore(e: React.FormEvent) {
    e.preventDefault();
    if (!newStore.slug || !newStore.name) { toast.error("Nombre y URL requeridos"); return; }
    setCreating(true);
    try {
      await apiClient.post("/stores/", newStore);
      toast.success("¡Tienda creada!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al crear tienda");
    } finally {
      setCreating(false);
    }
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch("/stores/me", {
        name: info.name || undefined,
        description: info.description || undefined,
        whatsapp: info.whatsapp || undefined,
        primary_color: info.primary_color,
        logo_url: info.logo_url || undefined,
        banner_url: info.banner_url || undefined,
        city: info.city || undefined,
      });
      toast.success("Tienda actualizada");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch("/stores/me/settings", {
        accept_cash: settings.accept_cash,
        accept_yape: settings.accept_yape,
        accept_plin: settings.accept_plin,
        yape_phone: settings.yape_phone || undefined,
        plin_phone: settings.plin_phone || undefined,
        bank_account: settings.bank_account || undefined,
        delivery_fee_cents: Math.round(parseFloat(settings.delivery_fee_cents || "0") * 100),
        min_order_cents: Math.round(parseFloat(settings.min_order_cents || "0") * 100),
        free_delivery_above: settings.free_delivery_above
          ? Math.round(parseFloat(settings.free_delivery_above) * 100)
          : null,
      });
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error("Nombre requerido"); return; }
    setAddingCat(true);
    try {
      const { data } = await apiClient.post("/categories/", {
        name: catForm.name.trim(),
        icon: catForm.icon.trim() || undefined,
      });
      setCategories((prev) => [...prev, data]);
      setCatForm({ name: "", icon: "" });
      toast.success("Categoría creada");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error");
    } finally {
      setAddingCat(false);
    }
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!staffForm.full_name.trim() || !staffForm.email.trim() || !staffForm.password) {
      toast.error("Nombre, email y contraseña son requeridos");
      return;
    }
    setAddingStaff(true);
    try {
      const { data } = await apiClient.post("/delivery/staff", {
        full_name: staffForm.full_name.trim(),
        email: staffForm.email.trim().toLowerCase(),
        password: staffForm.password,
        phone: staffForm.phone.trim() || undefined,
      });
      setStaff((prev) => [...prev, data]);
      setStaffForm({ full_name: "", email: "", password: "", phone: "" });
      toast.success("Repartidor creado");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al crear repartidor");
    } finally {
      setAddingStaff(false);
    }
  }

  async function removeStaff(id: string) {
    if (!confirm("¿Desactivar este repartidor?")) return;
    try {
      await apiClient.delete(`/delivery/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
      toast.success("Repartidor desactivado");
    } catch {
      toast.error("Error al desactivar");
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("¿Eliminar esta categoría? Los productos quedarán sin categoría.")) return;
    try {
      await apiClient.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Categoría eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div
          className={`w-10 h-6 rounded-full transition-colors relative ${value ? "bg-brand-600" : "bg-gray-200"}`}
          onClick={() => onChange(!value)}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
        </div>
      </label>
    );
  }

  if (loading) {
    return <div className="p-5 space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;
  }

  if (noStore) {
    return (
      <div className="p-5 max-w-sm mx-auto">
        <h1 className="font-display font-bold text-xl text-gray-900 mb-1">Crear tienda</h1>
        <p className="text-sm text-gray-500 mb-5">Configura tu tienda para empezar a recibir pedidos</p>

        <form onSubmit={createStore} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Nombre de tu tienda *</label>
            <input className="input" placeholder="Ej: Postres de Ana" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">URL de tu tienda *</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 whitespace-nowrap">qtienda.shop/tienda/</span>
              <input
                className="input"
                placeholder="anapostres"
                value={newStore.slug}
                onChange={(e) => setNewStore({ ...newStore, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">WhatsApp</label>
            <input className="input" type="tel" placeholder="51987654321" value={newStore.whatsapp} onChange={(e) => setNewStore({ ...newStore, whatsapp: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Ciudad</label>
            <input className="input" placeholder="Lima" value={newStore.city} onChange={(e) => setNewStore({ ...newStore, city: e.target.value })} />
          </div>
          <button type="submit" disabled={creating} className="btn-primary w-full bg-brand-600">
            {creating ? "Creando..." : "Crear tienda"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-gray-900">Configuración</h1>
        {store && (
          <a
            href={`/tienda/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Ver tienda <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Store info */}
      <section className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Información de tienda</h2>
        <form onSubmit={saveInfo} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Nombre</label>
            <input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Descripción</label>
            <textarea className="input resize-none" rows={2} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">WhatsApp</label>
              <input className="input" type="tel" placeholder="51987654321" value={info.whatsapp} onChange={(e) => setInfo({ ...info, whatsapp: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Ciudad</label>
              <input className="input" placeholder="Lima" value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Color principal</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInfo({ ...info, primary_color: c })}
                  className={`w-8 h-8 rounded-full transition-transform ${info.primary_color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-start">
            <ImageUpload
              label="Logo"
              value={info.logo_url}
              onChange={(url) => setInfo((prev) => ({ ...prev, logo_url: url }))}
              hint={"200×200 px · cuadrado\nJPEG, PNG o WebP · máx 5 MB"}
              className="h-28 w-full"
            />
            <ImageUpload
              label="Banner"
              value={info.banner_url}
              onChange={(url) => setInfo((prev) => ({ ...prev, banner_url: url }))}
              hint={"1200×400 px · horizontal\nJPEG, PNG o WebP · máx 5 MB"}
              className="h-28 w-full"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full bg-brand-600">
            <Save size={15} />
            {saving ? "Guardando..." : "Guardar información"}
          </button>
        </form>
      </section>

      {/* Payment & delivery */}
      <section className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Pagos y delivery</h2>
        <form onSubmit={saveSettings} className="space-y-4">
          <Toggle value={settings.accept_cash} onChange={(v) => setSettings({ ...settings, accept_cash: v })} label="Aceptar efectivo" />
          <Toggle value={settings.accept_yape} onChange={(v) => setSettings({ ...settings, accept_yape: v })} label="Aceptar Yape" />
          {settings.accept_yape && (
            <input className="input" placeholder="Número Yape" value={settings.yape_phone} onChange={(e) => setSettings({ ...settings, yape_phone: e.target.value })} />
          )}
          <Toggle value={settings.accept_plin} onChange={(v) => setSettings({ ...settings, accept_plin: v })} label="Aceptar Plin" />
          {settings.accept_plin && (
            <input className="input" placeholder="Número Plin" value={settings.plin_phone} onChange={(e) => setSettings({ ...settings, plin_phone: e.target.value })} />
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Cuenta bancaria / transferencia</label>
            <input className="input" placeholder="BCP 123-456..." value={settings.bank_account} onChange={(e) => setSettings({ ...settings, bank_account: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Costo delivery (S/)</label>
              <input className="input" type="number" min="0" step="0.50" value={settings.delivery_fee_cents} onChange={(e) => setSettings({ ...settings, delivery_fee_cents: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Pedido mínimo (S/)</label>
              <input className="input" type="number" min="0" step="0.50" value={settings.min_order_cents} onChange={(e) => setSettings({ ...settings, min_order_cents: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Delivery gratis desde (S/)</label>
            <input className="input" type="number" min="0" step="0.50" placeholder="0 = sin mínimo" value={settings.free_delivery_above} onChange={(e) => setSettings({ ...settings, free_delivery_above: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full bg-brand-600">
            <Save size={15} />
            {saving ? "Guardando..." : "Guardar pagos y delivery"}
          </button>
        </form>
      </section>

      {/* Categories */}
      <section className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Categorías</h2>
        <div className="space-y-2 mb-4">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm font-medium text-gray-700">
                {c.icon && <span className="mr-1.5">{c.icon}</span>}
                {c.name}
              </span>
              <button
                onClick={() => deleteCategory(c.id)}
                className="text-red-400 hover:text-red-600 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-gray-400">Sin categorías aún</p>
          )}
        </div>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            className="input py-2"
            placeholder="Emoji"
            value={catForm.icon}
            onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
            style={{ width: 70 }}
          />
          <input
            className="input py-2 flex-1"
            placeholder="Nombre de categoría"
            value={catForm.name}
            onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
          />
          <button type="submit" disabled={addingCat} className="btn-primary py-2 px-3 bg-brand-600">
            <Plus size={16} />
          </button>
        </form>
      </section>

      {/* Delivery staff */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bike size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Repartidores</h2>
        </div>

        {/* Staff list */}
        <div className="space-y-2 mb-5">
          {staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                <p className="text-xs text-gray-400 truncate">{s.email}{s.phone ? ` · ${s.phone}` : ""}</p>
              </div>
              <button
                onClick={() => removeStaff(s.id)}
                className="ml-3 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
                title="Desactivar repartidor"
              >
                <UserX size={14} style={{ color: "#DC2626" }} />
              </button>
            </div>
          ))}
          {staff.length === 0 && (
            <p className="text-sm text-gray-400 py-1">Sin repartidores aún</p>
          )}
        </div>

        {/* Add staff form */}
        <form onSubmit={addStaff} className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agregar repartidor</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Nombre completo"
              value={staffForm.full_name}
              onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
            />
            <input
              className="input"
              type="tel"
              placeholder="Teléfono (opcional)"
              value={staffForm.phone}
              onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
            />
          </div>
          <input
            className="input"
            type="email"
            inputMode="email"
            placeholder="Email"
            value={staffForm.email}
            onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
          />
          <div className="relative">
            <input
              className="input pr-11"
              type={showPass ? "text" : "password"}
              placeholder="Contraseña"
              value={staffForm.password}
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-label="Mostrar contraseña"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button type="submit" disabled={addingStaff} className="btn-primary w-full bg-brand-600">
            <Plus size={15} />
            {addingStaff ? "Creando..." : "Agregar repartidor"}
          </button>
        </form>
      </section>
    </div>
  );
}
