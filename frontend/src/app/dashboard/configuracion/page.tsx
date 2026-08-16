"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Save, Plus, Trash2, Bike, Eye, EyeOff, UserX, Store, CreditCard, Tag, Truck, QrCode, Download, Megaphone, Copy, ListChecks } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { COUNTRIES } from "@/lib/countries";
import { ThemePreviewGrid, type StoreTheme } from "@/components/dashboard/ThemePreviewGrid";
import { StoreCreationWizard } from "@/components/dashboard/StoreCreationWizard";
import { useStore, QK } from "@/hooks/useDashboardQueries";
import { useQueryClient } from "@tanstack/react-query";
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
  theme?: StoreTheme;
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

// Departamentos fijos del Mall Qtienda — distinto de las categorías internas
// de productos (esas siguen siendo libres, se editan en la pestaña Categorías).
const COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6",
  "#F59E0B", "#FB7185", "#64748B", "#84CC16",
];

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

type Tab = "tienda" | "pagos" | "categorias" | "repartidores" | "marketing";

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
          background: value ? "var(--accent)" : "var(--line-2)",
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
  const [saving, setSaving] = useState(false);
  // /stores/me ahora pasa por el caché compartido de React Query (useStore)
  // en vez de un fetch propio — antes esta página, /dashboard/pedidos y el
  // hook lo pedían cada uno por su cuenta, triplicando el request al montar.
  const { data: storeData, isLoading: loading, isError: noStore } = useStore();
  const qc = useQueryClient();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  function downloadQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas || !store) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${store.slug}.png`;
    a.click();
  }

  const [info, setInfo] = useState({
    name: "", description: "", whatsapp: "",
    instagram: "", tiktok: "", facebook: "", mall_category: "",
    primary_color: "#6366f1", logo_url: "", banner_url: "", banner_link: "", city: "", address: "",
    country: "PE", theme: "clasico" as StoreTheme,
  });

  const [settings, setSettings] = useState({
    accept_cash: true, accept_yape: false, accept_plin: false,
    accept_transfer: false, accept_card: false, require_prepayment: false,
    yape_phone: "", plin_phone: "", yape_qr_url: "", plin_qr_url: "", bank_account: "",
    delivery_fee_cents: "0", min_order_cents: "0", free_delivery_above: "",
    welcome_discount_enabled: false, welcome_discount_cents: "5",
    delivery_zones: [] as string[],
    tiktok_pixel_id: "", meta_pixel_id: "", google_analytics_id: "",
    accept_pickup: false, pickup_instructions: "",
  });
  const [newZone, setNewZone] = useState("");

  const [hours, setHours] = useState<Record<string, DayHours>>({});
  const [banners, setBanners] = useState<{ image_url: string; link_url: string }[]>([]);
  const [planSlug, setPlanSlug] = useState("free");

  const [creating, setCreating] = useState(false);

  // Categorías del Mall — antes una lista hardcodeada acá (desincronizada
  // del backend, le faltaban "servicios", "comida" y "otros"). Ahora viene
  // del mismo endpoint público que ya usa el wizard de creación.
  const [mallCategories, setMallCategories] = useState<{ slug: string; label: string; icon?: string }[]>([]);
  useEffect(() => {
    apiClient.get("/public/mall-categories")
      .then(({ data }) => setMallCategories(Array.isArray(data) ? data : []))
      .catch(() => setMallCategories([]));
  }, []);

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

  // Sincroniza el form editable local desde el store cacheado por
  // useStore() — separado del fetch en sí, porque acá los campos se editan
  // en su propio estado (info/settings/hours), no se leen directo del query.
  useEffect(() => {
    if (!storeData) return;
    setStore(storeData);
    setInfo({
      name: storeData.name || "",
      description: storeData.description || "",
      whatsapp: storeData.whatsapp || "",
      instagram: storeData.instagram || "",
      tiktok: storeData.tiktok || "",
      facebook: storeData.facebook || "",
      mall_category: storeData.mall_category || "",
      primary_color: storeData.primary_color || "#6366f1",
      logo_url: storeData.logo_url || "",
      banner_url: storeData.banner_url || "",
      banner_link: storeData.banner_link || "",
      city: storeData.city || "",
      address: storeData.address || "",
      country: storeData.country || "PE",
      theme: storeData.theme || "clasico",
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
        yape_qr_url: storeData.settings.yape_qr_url || "",
        plin_qr_url: storeData.settings.plin_qr_url || "",
        bank_account: storeData.settings.bank_account || "",
        delivery_fee_cents: String(storeData.settings.delivery_fee_cents / 100),
        min_order_cents: String(storeData.settings.min_order_cents / 100),
        free_delivery_above: storeData.settings.free_delivery_above
          ? String(storeData.settings.free_delivery_above / 100)
          : "",
        welcome_discount_enabled: storeData.settings.welcome_discount_enabled ?? false,
        welcome_discount_cents: storeData.settings.welcome_discount_cents
          ? String(storeData.settings.welcome_discount_cents / 100)
          : "5",
        accept_pickup: storeData.settings.accept_pickup ?? false,
        pickup_instructions: storeData.settings.pickup_instructions || "",
        delivery_zones: Array.isArray(storeData.settings.delivery_zones)
          ? storeData.settings.delivery_zones
          : [],
        tiktok_pixel_id: storeData.settings.tiktok_pixel_id || "",
        meta_pixel_id: storeData.settings.meta_pixel_id || "",
        google_analytics_id: storeData.settings.google_analytics_id || "",
      });
      if (storeData.settings.store_hours) setHours(storeData.settings.store_hours);
    }
  }, [storeData]);

  // Categorías/repartidores — independientes del store en sí, solo tiene
  // sentido pedirlos una vez confirmado que la tienda existe.
  useEffect(() => {
    if (!storeData) return;
    Promise.all([
      apiClient.get("/categories/"),
      apiClient.get("/delivery/staff"),
    ]).then(([{ data: cats }, { data: staffData }]) => {
      setCategories(cats);
      setStaff(staffData);
    }).catch(() => {});
  }, [storeData]);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch("/stores/me", {
        name: info.name || undefined,
        description: info.description || undefined,
        whatsapp: info.whatsapp || undefined,
        instagram: info.instagram,
        tiktok: info.tiktok,
        facebook: info.facebook,
        mall_category: info.mall_category,
        primary_color: info.primary_color,
        logo_url: info.logo_url || undefined,
        city: info.city || undefined,
        address: info.address || undefined,
        country: info.country || undefined,
        theme: info.theme,
      });
      await apiClient.put("/stores/me/banners", {
        banners: banners
          .filter((b) => b.image_url)
          .map((b) => ({ image_url: b.image_url, link_url: b.link_url.trim() || null })),
      });
      await apiClient.patch("/stores/me/settings", { store_hours: hours });
      qc.invalidateQueries({ queryKey: QK.store });
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
        yape_qr_url: settings.yape_qr_url || undefined,
        plin_qr_url: settings.plin_qr_url || undefined,
        bank_account: settings.bank_account || undefined,
        delivery_fee_cents: Math.round(parseFloat(settings.delivery_fee_cents || "0") * 100),
        min_order_cents: Math.round(parseFloat(settings.min_order_cents || "0") * 100),
        free_delivery_above: settings.free_delivery_above
          ? Math.round(parseFloat(settings.free_delivery_above) * 100)
          : null,
        welcome_discount_enabled: settings.welcome_discount_enabled,
        welcome_discount_cents: Math.round(parseFloat(settings.welcome_discount_cents || "0") * 100),
        delivery_zones: settings.delivery_zones,
        accept_pickup: settings.accept_pickup,
        pickup_instructions: settings.pickup_instructions.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: QK.store });
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function saveMarketing(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch("/stores/me/settings", {
        tiktok_pixel_id: settings.tiktok_pixel_id.trim() || null,
        meta_pixel_id: settings.meta_pixel_id.trim() || null,
        google_analytics_id: settings.google_analytics_id.trim() || null,
      });
      qc.invalidateQueries({ queryKey: QK.store });
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
      <StoreCreationWizard
        onCreated={(redirectTo) => {
          // Reload completo (no solo router.push): el layout del dashboard
          // necesita releer /stores/me para dejar de mostrar "sin tienda"
          // en el nav y en el resto de pantallas.
          window.location.href = redirectTo;
        }}
      />
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "tienda", label: "Tienda", icon: <Store size={15} /> },
    { id: "pagos", label: "Pagos", icon: <CreditCard size={15} /> },
    { id: "categorias", label: "Categorías", icon: <Tag size={15} /> },
    { id: "repartidores", label: "Repartidores", icon: <Truck size={15} /> },
    { id: "marketing", label: "Marketing", icon: <Megaphone size={15} /> },
  ];

  return (
    <div className="p-5 md:p-8 max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-xl" style={{ color: "var(--ink)" }}>Configuración</h1>
        {store && (
          <a
            href={`https://${store.slug}.qtienda.shop/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold"
            style={{ color: "var(--accent)" }}
          >
            Ver tienda <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Tabs — fila de pills en móvil/tablet: activo = capsula solida de color,
          inactivo = con borde propio para que se lea como boton, no como texto suelto */}
      <div
        className="flex md:hidden"
        style={{
          gap: 6,
          marginBottom: 20,
        }}
      >
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "9px 4px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                border: active ? "none" : "1.5px solid var(--line-2)",
                cursor: "pointer",
                transition: "all 0.15s",
                background: active ? "var(--accent)" : "var(--surface)",
                color: active ? "#fff" : "var(--ink-2)",
                boxShadow: active ? "0 3px 10px rgba(197,97,59,.35)" : "none",
              }}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="md:flex md:gap-8 md:items-start">

      {/* Tabs — rail vertical en desktop: activo = capsula solida de color con
          sombra; inactivo = con borde propio para que se lea como boton */}
      <nav className="hidden md:flex md:flex-col md:gap-1.5 md:w-52 md:flex-shrink-0 md:sticky md:top-6">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-left transition-all"
              style={{
                background: active ? "var(--accent)" : "var(--surface)",
                color: active ? "#fff" : "var(--ink-2)",
                border: active ? "none" : "1.5px solid var(--line-2)",
                boxShadow: active ? "0 4px 14px rgba(197,97,59,.3)" : "none",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="md:flex-1 md:min-w-0">

      {/* Tab: Tienda */}
      {activeTab === "tienda" && (
        <section className="card p-5">
          <h2 className="font-semibold text-[var(--ink)] mb-4">Información de tienda</h2>
          <form onSubmit={saveInfo} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Nombre</label>
              <input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Descripción</label>
              <textarea className="input resize-none" rows={2} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">WhatsApp</label>
                <input className="input" type="tel" placeholder="51987654321" value={info.whatsapp} onChange={(e) => setInfo({ ...info, whatsapp: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Ciudad</label>
                <input className="input" placeholder="Lima" value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Dirección</label>
              <input
                className="input"
                placeholder="Av. Grau 456, cerca al mercado central"
                value={info.address}
                onChange={(e) => setInfo({ ...info, address: e.target.value })}
              />
              <p className="text-[11px] mt-1 text-[var(--ink-4)]">
                Para negocios con local físico — se muestra a quien reserva una cita o recoge su pedido.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                Categoría en el Mall Qtienda
              </label>
              <p className="text-[11px] mb-2" style={{ color: "var(--ink-4)" }}>
                Para que los compradores te encuentren navegando por rubro en el Mall.
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {mallCategories.map((c) => {
                  const active = info.mall_category === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setInfo({ ...info, mall_category: active ? "" : c.slug })}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
                      style={{
                        background: active ? "var(--accent-soft)" : "var(--bg)",
                        border: `1.5px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{c.icon}</span>
                      <span className="text-[10px] font-bold text-center leading-tight" style={{ color: active ? "var(--accent-ink)" : "var(--ink-3)" }}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide mb-1">Redes sociales</p>
              <p className="text-[11px] mb-2" style={{ color: "var(--ink-4)" }}>
                Que tus compradores puedan ver tu cuenta real (seguidores, historial) genera confianza — es opcional.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Instagram</label>
                  <input className="input" placeholder="tu_usuario" value={info.instagram} onChange={(e) => setInfo({ ...info, instagram: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">TikTok</label>
                  <input className="input" placeholder="tu_usuario" value={info.tiktok} onChange={(e) => setInfo({ ...info, tiktok: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Facebook</label>
                  <input className="input" placeholder="tu.pagina" value={info.facebook} onChange={(e) => setInfo({ ...info, facebook: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">País</label>
              <select
                className="input"
                value={info.country}
                onChange={(e) => setInfo({ ...info, country: e.target.value })}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <p className="text-[11px] mt-1 text-[var(--ink-4)]">
                Define los campos de dirección y documento que se piden al comprar
                {info.country === "PE" ? " (DNI, departamento, provincia y distrito)" : " (documento, región y ciudad)"}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Color principal</label>
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
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                Tema de tu vitrina
              </label>
              <p className="text-[11px] text-[var(--ink-4)] mb-2">
                Cambia la disposición y los neutros de tu tienda pública. Tu color de marca se mantiene en cualquier tema.
              </p>
              <ThemePreviewGrid
                value={info.theme}
                onChange={(theme) => setInfo({ ...info, theme })}
                primaryColor={info.primary_color}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-start">
              <ImageUpload
                label="Logo"
                value={info.logo_url}
                onChange={(url) => setInfo((prev) => ({ ...prev, logo_url: url }))}
                hint={"200×200 px · cuadrado\nJPEG, PNG o WebP · máx 5 MB"}
                className="h-28 w-full"
                maxDimension={512}
              />
            </div>

            {/* Banners (free: 1, pro/elite: hasta 3 rotando) */}
            {(() => {
              const maxBanners = planSlug === "free" ? 1 : 3;
              return (
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                    Banners de la tienda ({banners.length}/{maxBanners})
                  </label>
                  <p className="text-[11px] text-[var(--ink-4)] mb-2">
                    {maxBanners > 1
                      ? "Hasta 3 banners que rotan automáticamente en tu tienda. Cada uno puede tener su enlace."
                      : "Tu plan incluye 1 banner. Mejora a Pro para usar hasta 3 banners rotando."}
                  </p>
                  <div className="space-y-3">
                    {banners.map((b, i) => (
                      <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <ImageUpload
                              label={`Banner ${i + 1}`}
                              value={b.image_url}
                              onChange={(url) =>
                                setBanners((prev) => prev.map((x, j) => (j === i ? { ...x, image_url: url } : x)))
                              }
                              hint={"1600×400 px exacto (4:1)\nJPEG, PNG o WebP · máx 5 MB"}
                              className="h-24 w-full"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setBanners((prev) => prev.filter((_, j) => j !== i))}
                            className="p-2 rounded-lg text-[var(--danger)] hover:bg-red-50 flex-shrink-0"
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
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-[var(--ink-3)] hover:border-gray-400 hover:text-[var(--ink-2)]"
                      >
                        <Plus size={15} /> Agregar banner
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                Horario de atención
              </label>
              <p className="text-[11px] text-[var(--ink-4)] mb-2">
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
                          <span className="text-xs text-[var(--ink-4)]">a</span>
                          <input
                            type="time"
                            className="input"
                            style={{ width: 105, padding: "6px 8px" }}
                            value={day.close}
                            onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...day, close: e.target.value } }))}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--ink-4)]">Cerrado</span>
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
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
                boxShadow: "0 4px 14px rgba(197,97,59,.3)",
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

      {activeTab === "tienda" && store && (
        <section className="card p-5 mt-4 text-center">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 mx-auto"
            style={{ background: "var(--accent-soft)" }}
          >
            <QrCode size={20} style={{ color: "var(--accent)" }} />
          </div>
          <h2 className="font-semibold text-[var(--ink)] mb-1">Código QR de tu tienda</h2>
          <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
            Imprímelo y pégalo en tus paquetes de envío, empaques o volantes — tus clientes lo
            escanean y llegan directo a tu tienda.
          </p>
          <div
            className="inline-flex p-4 rounded-2xl mb-4"
            style={{ background: "#fff", border: "1px solid var(--line-2)" }}
          >
            <QRCodeCanvas ref={qrCanvasRef} value={`https://${store.slug}.qtienda.shop/`} size={180} marginSize={0} />
          </div>
          <button
            type="button"
            onClick={downloadQr}
            className="mx-auto flex items-center justify-center gap-2 rounded-2xl py-3 px-6 font-bold text-sm text-white transition-all active:scale-[.98]"
            style={{ background: "var(--accent)" }}
          >
            <Download size={15} /> Descargar QR
          </button>
        </section>
      )}

      {/* Tab: Pagos */}
      {activeTab === "pagos" && (
        <section className="card p-5">
          <h2 className="font-semibold text-[var(--ink)] mb-4">Métodos de pago y delivery</h2>
          {!(settings.accept_cash || settings.accept_yape || settings.accept_plin || settings.accept_transfer || settings.accept_card) && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-xs font-semibold"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              ⚠️ No tienes ningún método de pago activo — tus clientes no podrán completar un pedido. Activa al menos uno.
            </div>
          )}
          <form onSubmit={saveSettings} className="space-y-4">
            <Toggle value={settings.accept_cash} onChange={(v) => setSettings({ ...settings, accept_cash: v })} label="Aceptar efectivo" />
            <Toggle value={settings.accept_yape} onChange={(v) => setSettings({ ...settings, accept_yape: v })} label="Aceptar Yape" />
            {settings.accept_yape && (
              <div className="space-y-2">
                <input className="input" placeholder="Número Yape" value={settings.yape_phone} onChange={(e) => setSettings({ ...settings, yape_phone: e.target.value })} />
                {!settings.yape_phone.trim() && (
                  <p className="text-[11px] font-semibold" style={{ color: "var(--warn)" }}>
                    ⚠️ Sin número, tus clientes no verán a dónde yapear — tendrás que enviárselo tú por WhatsApp en cada pedido.
                  </p>
                )}
                <ImageUpload
                  label="QR de Yape (opcional)"
                  value={settings.yape_qr_url}
                  onChange={(url) => setSettings({ ...settings, yape_qr_url: url })}
                  hint="Captura del QR de tu app Yape\nEl comprador lo escanea al pagar"
                  className="h-40 w-40"
                  maxDimension={800}
                />
              </div>
            )}
            <Toggle value={settings.accept_plin} onChange={(v) => setSettings({ ...settings, accept_plin: v })} label="Aceptar Plin" />
            {settings.accept_plin && (
              <div className="space-y-2">
                <input className="input" placeholder="Número Plin" value={settings.plin_phone} onChange={(e) => setSettings({ ...settings, plin_phone: e.target.value })} />
                {!settings.plin_phone.trim() && (
                  <p className="text-[11px] font-semibold" style={{ color: "var(--warn)" }}>
                    ⚠️ Sin número, tus clientes no verán a dónde plinear — tendrás que enviárselo tú por WhatsApp en cada pedido.
                  </p>
                )}
                <ImageUpload
                  label="QR de Plin (opcional)"
                  value={settings.plin_qr_url}
                  onChange={(url) => setSettings({ ...settings, plin_qr_url: url })}
                  hint="Captura del QR de tu app Plin\nEl comprador lo escanea al pagar"
                  className="h-40 w-40"
                  maxDimension={800}
                />
              </div>
            )}
            <Toggle value={settings.accept_transfer} onChange={(v) => setSettings({ ...settings, accept_transfer: v })} label="Aceptar transferencia bancaria" />
            {settings.accept_transfer && (
              <div className="space-y-2">
                <input className="input" placeholder="BCP 123-456789-0-12 / CCI..." value={settings.bank_account} onChange={(e) => setSettings({ ...settings, bank_account: e.target.value })} />
                {!settings.bank_account.trim() && (
                  <p className="text-[11px] font-semibold" style={{ color: "var(--warn)" }}>
                    ⚠️ Sin datos bancarios, tus clientes no sabrán a dónde transferir.
                  </p>
                )}
              </div>
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
              <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide">Costos de envío</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Costo delivery (S/)</label>
                  <input className="input" type="number" min="0" step="0.50" value={settings.delivery_fee_cents} onChange={(e) => setSettings({ ...settings, delivery_fee_cents: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Pedido mínimo (S/)</label>
                  <input className="input" type="number" min="0" step="0.50" value={settings.min_order_cents} onChange={(e) => setSettings({ ...settings, min_order_cents: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Delivery gratis desde (S/)</label>
                <input className="input" type="number" min="0" step="0.50" placeholder="0 = sin mínimo" value={settings.free_delivery_above} onChange={(e) => setSettings({ ...settings, free_delivery_above: e.target.value })} />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <Toggle
                value={settings.accept_pickup}
                onChange={(v) => setSettings({ ...settings, accept_pickup: v })}
                label="Ofrezco recojo en tienda"
              />
              {settings.accept_pickup && (
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                    Dirección e instrucciones de recojo
                  </label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    placeholder="Ej: Av. Los Olivos 123, tienda al lado de la farmacia. Horario de recojo: 9am-7pm."
                    value={settings.pickup_instructions}
                    onChange={(e) => setSettings({ ...settings, pickup_instructions: e.target.value })}
                  />
                  {!settings.pickup_instructions.trim() && (
                    <p className="text-[11px] font-semibold mt-1.5" style={{ color: "var(--warn)" }}>
                      ⚠️ Sin esto, el comprador no sabrá dónde recoger su pedido.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide">Zonas de entrega</p>
              <p className="text-[11px] text-[var(--ink-4)]">
                Distritos donde entregas. Se muestran a tus clientes antes de que llenen su dirección,
                para que no lleguen hasta el final del pedido y recién ahí se enteren de que no llegas a su zona.
                Déjalo vacío si entregas a cualquier zona o coordinas caso por caso.
              </p>
              {settings.delivery_zones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {settings.delivery_zones.map((zone) => (
                    <span
                      key={zone}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full"
                      style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                    >
                      {zone}
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({ ...s, delivery_zones: s.delivery_zones.filter((z) => z !== zone) }))
                        }
                        aria-label={`Quitar ${zone}`}
                        className="flex items-center justify-center rounded-full"
                        style={{ width: 16, height: 16, color: "var(--ink-4)" }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Ej: Comas"
                  value={newZone}
                  onChange={(e) => setNewZone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const z = newZone.trim();
                    if (!z) return;
                    if (settings.delivery_zones.some((d) => d.toLowerCase() === z.toLowerCase())) {
                      toast.error("Esa zona ya está en la lista");
                      return;
                    }
                    setSettings((s) => ({ ...s, delivery_zones: [...s.delivery_zones, z] }));
                    setNewZone("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const z = newZone.trim();
                    if (!z) return;
                    if (settings.delivery_zones.some((d) => d.toLowerCase() === z.toLowerCase())) {
                      toast.error("Esa zona ya está en la lista");
                      return;
                    }
                    setSettings((s) => ({ ...s, delivery_zones: [...s.delivery_zones, z] }));
                    setNewZone("");
                  }}
                  className="px-3 rounded-xl flex-shrink-0"
                  style={{ border: "1.5px solid var(--line-2)", color: "var(--ink-2)" }}
                  aria-label="Agregar zona"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide">Descuento de bienvenida</p>
              <Toggle
                value={settings.welcome_discount_enabled}
                onChange={(v) => setSettings({ ...settings, welcome_discount_enabled: v })}
                label="Descuento automático en el primer pedido"
              />
              {settings.welcome_discount_enabled && (
                <div>
                  <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Monto del descuento (S/)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.50"
                    value={settings.welcome_discount_cents}
                    onChange={(e) => setSettings({ ...settings, welcome_discount_cents: e.target.value })}
                  />
                  <p className="text-xs mt-1.5" style={{ color: "var(--ink-3)" }}>
                    Se aplica solo si el número de WhatsApp del comprador nunca hizo un pedido en tu tienda. Sin código — se descuenta automático al confirmar.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
                boxShadow: "0 4px 14px rgba(197,97,59,.3)",
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
          <div className="flex items-center gap-2 mb-1">
            <Tag size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-semibold" style={{ color: "var(--ink)" }}>Categorías de productos</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
            Agrupa tus productos por categoría para que los clientes encuentren más fácil lo que buscan.
          </p>

          {/* Lista existente */}
          <div className="space-y-2 mb-5">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "var(--bg)", border: "1px solid var(--line-2)" }}
              >
                <div
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 32, height: 32, background: "var(--accent-soft)", fontSize: 15 }}
                >
                  {c.icon || <Tag size={14} style={{ color: "var(--accent-ink)" }} />}
                </div>
                <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: "var(--ink-2)" }}>
                  {c.name}
                </span>
                <button
                  onClick={() => deleteCategory(c.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--danger-soft)", border: "1.5px solid var(--line-2)" }}
                  title="Eliminar categoría"
                >
                  <Trash2 size={13} style={{ color: "var(--danger)" }} />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm py-1" style={{ color: "var(--ink-3)" }}>Sin categorías aún</p>
            )}
          </div>

          {/* Formulario nueva categoría */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--bg)", border: "1px solid var(--line-2)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>Nueva categoría</p>
            <form onSubmit={addCategory} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                  Nombre <span className="text-[var(--danger)]">*</span>
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
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                  Emoji (opcional)
                </label>
                <input
                  className="input"
                  placeholder="🍰"
                  value={catForm.icon}
                  onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                  autoComplete="off"
                />
                <p className="text-[11px] text-[var(--ink-4)] mt-1">
                  Copia y pega un emoji para identificar la categoría visualmente.
                </p>
              </div>

              <button
                type="submit"
                disabled={addingCat || !catForm.name.trim()}
                style={{
                  width: "100%",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.6 : 1,
                  boxShadow: "0 4px 14px rgba(197,97,59,.3)",
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
            <Bike size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-semibold" style={{ color: "var(--ink)" }}>Repartidores</h2>
          </div>

          <div className="space-y-2 mb-5">
            {staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "var(--bg)", border: "1px solid var(--line-2)" }}
              >
                <div
                  className="flex items-center justify-center rounded-full flex-shrink-0 font-bold"
                  style={{ width: 32, height: 32, background: "var(--accent)", color: "#fff", fontSize: 12 }}
                >
                  {s.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{s.full_name}</p>
                  <p className="text-xs truncate" style={{ color: "var(--ink-3)" }}>
                    {s.email}
                    {s.phone ? ` · ${s.phone}` : ""}
                    {s.vehicle_type ? ` · ${VEHICLE_TYPES.find(v => v.value === s.vehicle_type)?.label ?? s.vehicle_type}` : ""}
                    {s.vehicle_plate ? ` ${s.vehicle_plate}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeStaff(s.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--danger-soft)", border: "1.5px solid var(--line-2)" }}
                  title="Desactivar repartidor"
                >
                  <UserX size={14} style={{ color: "var(--danger)" }} />
                </button>
              </div>
            ))}
            {staff.length === 0 && <p className="text-sm py-1" style={{ color: "var(--ink-3)" }}>Sin repartidores aún</p>}
          </div>

          <form onSubmit={addStaff} className="space-y-3">
            <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide">Agregar repartidor</p>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-4)]"
                aria-label="Mostrar contraseña"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Tipo de vehículo</label>
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
                <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">Placa</label>
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
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
                boxShadow: "0 4px 14px rgba(197,97,59,.3)",
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

      {/* Tab: Marketing */}
      {activeTab === "marketing" && (
        <>
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-semibold" style={{ color: "var(--ink)" }}>Pixels de marketing</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
            Solo si <strong>pagas anuncios</strong> en TikTok, Meta o Google y quieres medir cuántas
            ventas te generaron — es distinto de las estadísticas de qtienda, es exclusivamente tuyo.
            Si buscas mostrar tu perfil de redes a tus compradores, eso va en la pestaña{" "}
            <button type="button" onClick={() => setActiveTab("tienda")} className="font-bold underline" style={{ color: "var(--accent)" }}>
              Tienda
            </button>, no aquí.
          </p>

          <form onSubmit={saveMarketing} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                TikTok Pixel ID
              </label>
              <input
                className="input"
                placeholder="Ej: C4A1B2C3D4E5F6G7H8I9"
                value={settings.tiktok_pixel_id}
                onChange={(e) => setSettings({ ...settings, tiktok_pixel_id: e.target.value })}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>
                No es tu usuario de TikTok — es un código de TikTok Ads Manager → Activos →
                Eventos → Administrar → tu pixel. Déjalo vacío si no pautas anuncios ahí.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                Meta Pixel ID (Facebook/Instagram)
              </label>
              <input
                className="input"
                placeholder="Ej: 1234567890123456"
                value={settings.meta_pixel_id}
                onChange={(e) => setSettings({ ...settings, meta_pixel_id: e.target.value })}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>
                Administrador de eventos de Meta → Orígenes de datos → tu pixel
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wide block mb-1.5">
                Google Analytics (GA4)
              </label>
              <input
                className="input"
                placeholder="Ej: G-XXXXXXXXXX"
                value={settings.google_analytics_id}
                onChange={(e) => setSettings({ ...settings, google_analytics_id: e.target.value })}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--ink-4)" }}>
                Google Analytics → Administrar → Flujos de datos → ID de medición
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 px-6 font-bold text-sm text-white transition-all active:scale-[.98]"
              style={{ background: "var(--accent)", opacity: saving ? 0.6 : 1 }}
            >
              <Save size={15} /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </form>
        </section>

        {store && (
          <section className="card p-5 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <ListChecks size={18} style={{ color: "var(--accent)" }} />
              <h2 className="font-semibold" style={{ color: "var(--ink)" }}>Catálogo para TikTok Ads</h2>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--ink-3)" }}>
              Link con tus productos actualizados en tiempo real, listo para subir a{" "}
              <strong>TikTok Ads Manager → Catálogo → Crear catálogo → Feed de datos (URL programada)</strong>{" "}
              y correr anuncios de shopping con tus productos reales. Se actualiza solo, no hay que
              volver a subirlo cada vez que cambias algo.
            </p>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "var(--surface-2)", border: "1.5px solid var(--line-2)" }}
            >
              <input
                readOnly
                className="flex-1 bg-transparent text-xs outline-none truncate"
                style={{ color: "var(--ink-2)" }}
                value={`${process.env.NEXT_PUBLIC_API_URL ?? "https://qtienda.shop/api/v1"}/public/store/${store.slug}/catalog.xml`}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={() => {
                  const url = `${process.env.NEXT_PUBLIC_API_URL ?? "https://qtienda.shop/api/v1"}/public/store/${store.slug}/catalog.xml`;
                  navigator.clipboard.writeText(url);
                  toast.success("Link copiado");
                }}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: "var(--ink)", color: "var(--bg)" }}
              >
                <Copy size={12} /> Copiar
              </button>
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--ink-4)" }}>
              Solo incluye productos publicados y con al menos una foto — TikTok no acepta productos sin imagen.
            </p>
          </section>
        )}
        </>
      )}
      </div>{/* /contenido */}
      </div>{/* /md:flex */}
    </div>
  );
}
