"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Save, Plus, Trash2, Bike, Eye, EyeOff, UserX, Store, CreditCard, Tag, Truck } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { track } from "@vercel/analytics";

interface StoreData {
  id: string;
  slug: string;
  name: string;
  description?: string;
  whatsapp?: string;
  primary_color: string;
  logo_url?: string;
  banner_url?: string;
  banner_link?: string;
  city?: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_plate?: string;
  is_active: boolean;
}

interface CategoryForm { name: string; icon: string }

const COLORS = ["#6366f1", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

const WEEK_DAYS = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

type DayHours = { open: string; close: string };

const VEHICLE_TYPES = [
  { value: "moto", label: "Moto" },
  { value: "auto", label: "Auto" },
  { value: "camioneta", label: "Camioneta" },
  { value: "camion", label: "Camión" },
];

type Tab = "tienda" | "pagos" | "categorias" | "repartidores";

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)" }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 24,
          borderRadius: 12,
          background: value ? "var(--ink)" : "var(--line-2)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 20,
            height: 20,
            background: "var(--surface)",
            borderRadius: "50%",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      </div>
    </label>
  );
}

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("tienda");
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noStore, setNoStore] = useState(false);

  const [info, setInfo] = useState({
    name: "", description: "", whatsapp: "",
    primary_color: "#6366f1", logo_url: "", banner_url: "", banner_link: "", city: "",
  });

  const [settings, setSettings] = useState({
    accept_cash: true, accept_yape: false, accept_plin: false,
    accept_transfer: false, accept_card: false, require_prepayment: false,
    yape_phone: "", plin_phone: "", bank_account: "",
    delivery_fee_cents: "0", min_order_cents: "0", free_delivery_above: "",
  });

  const [hours, setHours] = useState<Record<string, DayHours>>({});
  const [banners, setBanners] = useState<{ image_url: string; link_url: string }[]>([]);
  const [planSlug, setPlanSlug] = useState("free");

  const [newStore, setNewStore] = useState({ slug: "", name: "", whatsapp: "", city: "" });
  const [creating, setCreating] = useState(false);

  const [categories, setCategories] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [catForm, setCatForm] = useState<CategoryForm>({ name: "", icon: "" });
  const [addingCat, setAddingCat] = useState(false);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffForm, setStaffForm] = useState({
    full_name: "", email: "", password: "", phone: "",
    vehicle_type: "", vehicle_plate: "",
  });
  const [showPass, setShowPass] = useState(false);
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
          banner_link: storeData.banner_link || "",
          city: storeData.city || "",
        });
        setPlanSlug(storeData.plan_slug || "free");
        setBanners(
          storeData.banners?.length
            ? storeData.banners.map((b: any) => ({ image_url: b.image_url, link_url: b.link_url || "" }))
            : storeData.banner_url
            ? [{ image_url: storeData.banner_url, link_url: storeData.banner_link || "" }]
            : []
        );
        if (storeData.settings) {
          setSettings({
            accept_cash: storeData.settings.accept_cash,
            accept_yape: storeData.settings.accept_yape,
            accept_plin: storeData.settings.accept_plin,
            accept_transfer: storeData.settings.accept_transfer ?? false,
            accept_card: storeData.settings.accept_card ?? false,
            require_prepayment: storeData.settings.require_prepayment ?? false,
            yape_phone: storeData.settings.yape_phone || "",
            plin_phone: storeData.settings.plin_phone || "",
            bank_account: storeData.settings.bank_account || "",
            delivery_fee_cents: String(storeData.settings.delivery_fee_cents / 100),
            min_order_cents: String(storeData.settings.min_order_cents / 100),
            free_delivery_above: storeData.settings.free_delivery_above
              ? String(storeData.settings.free_delivery_above / 100)
              : "",
          });
          if (storeData.settings.store_hours) setHours(storeData.settings.store_hours);
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
      track("store_created", {
        city: newStore.city || "sin_ciudad",
        has_whatsapp: !!newStore.whatsapp,
      });
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
        city: info.city || undefined,
      });
      await apiClient.put("/stores/me/banners", {
        banners: banners
          .filter((b) => b.image_url)
          .map((b) => ({ image_url: b.image_url, link_url: b.link_url.trim() || null })),
      });
      await apiClient.patch("/stores/me/settings", { store_hours: hours });
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
        accept_transfer: settings.accept_transfer,
        accept_card: settings.accept_card,
        require_prepayment: settings.require_prepayment,
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
        vehicle_type: staffForm.vehicle_type || undefined,
        vehicle_plate: staffForm.vehicle_plate.trim() || undefined,
      });
      setStaff((prev) => [...prev, data]);
      setStaffForm({ full_name: "", email: "", password: "", phone: "", vehicle_type: "", vehicle_plate: "" });
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Nombre *</label>
            <input className="input" placeholder="Ej: Postres de Ana" value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">URL *</label>
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
          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.6 : 1,
              transition: "opacity 0.15s",
              fontFamily: "var(--font-sans)",
            }}
          >
            {creating ? "Creando..." : "Crear tienda"}
          </button>
        </form>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "tienda", label: "Tienda", icon: <Store size={15} /> },
    { id: "pagos", label: "Pagos", icon: <CreditCard size={15} /> },
    { id: "categorias", label: "Categorías", icon: <Tag size={15} /> },
    { id: "repartidores", label: "Repartidores", icon: <Truck size={15} /> },
  ];

  return (
    <div className="p-5 max-w-lg lg:max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--surface-2)",
          borderRadius: 14,
          padding: 4,
          marginBottom: 20,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 4px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
              background: activeTab === t.id ? "var(--surface)" : "transparent",
              color: activeTab === t.id ? "var(--ink)" : "var(--ink-3)",
              boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Tienda */}
      {activeTab === "tienda" && (
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
            </div>

            {/* Banners (free: 1, pro/elite: hasta 3 rotando) */}
            {(() => {
              const maxBanners = planSlug === "free" ? 1 : 3;
              return (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    Banners de la tienda ({banners.length}/{maxBanners})
                  </label>
                  <p className="text-[11px] text-gray-400 mb-2">
                    {maxBanners > 1
                      ? "Hasta 3 banners que rotan automáticamente en tu tienda. Cada uno puede tener su enlace."
                      : "Tu plan incluye 1 banner. Mejora a Pro para usar hasta 3 banners rotando."}
                  </p>
                  <div className="space-y-3">
                    {banners.map((b, i) => (
                      <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <ImageUpload
                            label={`Banner ${i + 1}`}
                            value={b.image_url}
                            onChange={(url) =>
                              setBanners((prev) => prev.map((x, j) => (j === i ? { ...x, image_url: url } : x)))
                            }
                            hint={"1200×400 px · horizontal\nJPEG, PNG o WebP · máx 5 MB"}
                            className="h-24 w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setBanners((prev) => prev.filter((_, j) => j !== i))}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 flex-shrink-0"
                            aria-label="Quitar banner"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <input
                          className="input"
                          type="url"
                          placeholder="Enlace opcional: https://… o /tienda/mi-tienda"
                          value={b.link_url}
                          onChange={(e) =>
                            setBanners((prev) => prev.map((x, j) => (j === i ? { ...x, link_url: e.target.value } : x)))
                          }
                        />
                      </div>
                    ))}
                    {banners.length < maxBanners && (
                      <button
                        type="button"
                        onClick={() => setBanners((prev) => [...prev, { image_url: "", link_url: "" }])}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-600"
                      >
                        <Plus size={15} /> Agregar banner
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Horario de atención
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                Tus clientes verán &quot;Abierto&quot; o &quot;Cerrado&quot; en la tienda. Si no marcas ningún día, no se muestra nada.
              </p>
              <div className="space-y-1.5">
                {WEEK_DAYS.map(({ key, label }) => {
                  const day = hours[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`day-${key}`}
                        checked={!!day}
                        onChange={() =>
                          setHours((prev) => {
                            const next = { ...prev };
                            if (next[key]) delete next[key];
                            else next[key] = { open: "09:00", close: "18:00" };
                            return next;
                          })
                        }
                        className="w-4 h-4 accent-gray-900 flex-shrink-0"
                      />
                      <label htmlFor={`day-${key}`} className="text-sm w-20 flex-shrink-0 cursor-pointer" style={{ color: "var(--ink-2)" }}>
                        {label}
                      </label>
                      {day ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            className="input"
                            style={{ width: 105, padding: "6px 8px" }}
                            value={day.open}
                            onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...day, open: e.target.value } }))}
                          />
                          <span className="text-xs text-gray-400">a</span>
                          <input
                            type="time"
                            className="input"
                            style={{ width: 105, padding: "6px 8px" }}
                            value={day.close}
                            onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...day, close: e.target.value } }))}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                background: "var(--ink)",
                color: "var(--bg)",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
                transition: "opacity 0.15s",
                fontFamily: "var(--font-sans)",
              }}
            >
              <Save size={15} />
              {saving ? "Guardando..." : "Guardar información"}
            </button>
          </form>
        </section>
      )}

      {/* Tab: Pagos */}
      {activeTab === "pagos" && (
        <section className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Métodos de pago y delivery</h2>
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
            <Toggle value={settings.accept_transfer} onChange={(v) => setSettings({ ...settings, accept_transfer: v })} label="Aceptar transferencia bancaria" />
            {settings.accept_transfer && (
              <input className="input" placeholder="BCP 123-456789-0-12 / CCI..." value={settings.bank_account} onChange={(e) => setSettings({ ...settings, bank_account: e.target.value })} />
            )}
            <Toggle value={settings.accept_card} onChange={(v) => setSettings({ ...settings, accept_card: v })} label="Aceptar tarjeta (POS en entrega)" />
            <div className="pt-1 border-t border-gray-100">
              <Toggle
                value={settings.require_prepayment}
                onChange={(v) => setSettings({ ...settings, require_prepayment: v })}
                label="Exigir pago anticipado (Yape/Plin/Transfer)"
              />
              {settings.require_prepayment && (
                <p className="text-xs text-amber-600 mt-1.5">El comprador deberá pagar antes de que se prepare el pedido.</p>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Costos de envío</p>
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
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                background: "var(--ink)",
                color: "var(--bg)",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
                transition: "opacity 0.15s",
                fontFamily: "var(--font-sans)",
              }}
            >
              <Save size={15} />
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </form>
        </section>
      )}

      {/* Tab: Categorías */}
      {activeTab === "categorias" && (
        <section className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Categorías de productos</h2>
          <p className="text-xs text-gray-400 mb-4">
            Agrupa tus productos por categoría para que los clientes encuentren más fácil lo que buscan.
          </p>

          {/* Lista existente */}
          <div className="space-y-2 mb-5">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <span className="text-sm font-medium text-gray-700">
                  {c.icon && <span className="mr-2">{c.icon}</span>}
                  {c.name}
                </span>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="ml-3 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
                  title="Eliminar categoría"
                >
                  <Trash2 size={13} style={{ color: "#DC2626" }} />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 py-1">Sin categorías aún</p>
            )}
          </div>

          {/* Formulario nueva categoría */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nueva categoría</p>
            <form onSubmit={addCategory} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  className="input"
                  placeholder="Ej: Postres, Bebidas, Combos…"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Emoji (opcional)
                </label>
                <input
                  className="input"
                  placeholder="🍰"
                  value={catForm.icon}
                  onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                  autoComplete="off"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Copia y pega un emoji para identificar la categoría visualmente.
                </p>
              </div>

              <button
                type="submit"
                disabled={addingCat || !catForm.name.trim()}
                style={{
                  width: "100%",
                  background: "var(--ink)",
                  color: "var(--bg)",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.6 : 1,
                  transition: "opacity 0.15s",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <Plus size={15} />
                {addingCat ? "Creando..." : "Agregar categoría"}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Tab: Repartidores */}
      {activeTab === "repartidores" && (
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bike size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Repartidores</h2>
          </div>

          <div className="space-y-2 mb-5">
            {staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {s.email}
                    {s.phone ? ` · ${s.phone}` : ""}
                    {s.vehicle_type ? ` · ${VEHICLE_TYPES.find(v => v.value === s.vehicle_type)?.label ?? s.vehicle_type}` : ""}
                    {s.vehicle_plate ? ` ${s.vehicle_plate}` : ""}
                  </p>
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
            {staff.length === 0 && <p className="text-sm text-gray-400 py-1">Sin repartidores aún</p>}
          </div>

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Tipo de vehículo</label>
                <select
                  className="input"
                  value={staffForm.vehicle_type}
                  onChange={(e) => setStaffForm({ ...staffForm, vehicle_type: e.target.value })}
                >
                  <option value="">Sin especificar</option>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Placa</label>
                <input
                  className="input uppercase"
                  placeholder="ABC-123"
                  value={staffForm.vehicle_plate}
                  onChange={(e) => setStaffForm({ ...staffForm, vehicle_plate: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addingStaff}
              style={{
                width: "100%",
                background: "var(--ink)",
                color: "var(--bg)",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
                transition: "opacity 0.15s",
                fontFamily: "var(--font-sans)",
              }}
            >
              <Plus size={15} />
              {addingStaff ? "Creando..." : "Agregar repartidor"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
