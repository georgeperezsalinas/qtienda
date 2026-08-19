"use client";

// Campaña de reactivación de onboarding: tiendas creadas que aún no
// terminaron de configurarse (sin logo, sin banner o sin productos).
// Herramienta semi-automática: arma un mensaje de WhatsApp personalizado
// por tienda y abre wa.me con el texto precargado — el equipo solo confirma
// "enviar". No hay envío 100% automático (requeriría WhatsApp Business API).

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircle, RefreshCw, ImageIcon, GalleryHorizontal, Package,
  CheckCircle2, ChevronLeft, ChevronRight as ChevronRightIcon, Filter, Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

interface StoreItem {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  created_at: string;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  products_count: number;
  logo_url: string | null;
  banner_url: string | null;
  whatsapp: string | null;
  campaign_contacted_at: string | null;
}

interface StoresResponse {
  total: number;
  page: number;
  pages: number;
  items: StoreItem[];
}

function missingSteps(s: StoreItem): { key: string; label: string }[] {
  const steps: { key: string; label: string }[] = [];
  if (!s.logo_url) steps.push({ key: "logo", label: "Sin logo" });
  if (!s.banner_url) steps.push({ key: "banner", label: "Sin banner" });
  if (s.products_count === 0) steps.push({ key: "products", label: "Sin productos" });
  return steps;
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/[^\d]/g, "");
  if (phone.length === 9) phone = `51${phone}`;
  return phone;
}

function buildMessage(s: StoreItem): string {
  const missing = missingSteps(s).map((m) => m.label.replace("Sin ", "").toLowerCase());
  const missingText =
    missing.length === 1
      ? `agregar tu ${missing[0]}`
      : missing.length === 2
        ? `agregar tu ${missing[0]} y tu ${missing[1]}`
        : `agregar tu ${missing[0]}, tu ${missing[1]} y tus ${missing[2]}`;

  const firstName = (s.owner_name ?? "").split(" ")[0] || "";
  const greeting = firstName ? `Hola ${firstName} 👋` : "Hola 👋";
  const storeUrl = `https://${s.slug}.qtienda.shop/`;

  return (
    `${greeting} Soy del equipo de qtienda.shop. Vimos que creaste tu tienda "${s.name}" pero te falta ${missingText} para que quede lista y puedas empezar a vender. ` +
    `¿Te ayudamos? Entra a tu panel: https://qtienda.shop/dashboard\n` +
    `Así se ve tu tienda: ${storeUrl}`
  );
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function Skel({ h = 90 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

export default function AdminCampanaPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hideContacted, setHideContacted] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<StoresResponse>("/admin/stores", {
        params: { onboarding_incomplete: true, page, limit: 20 },
      });
      setStores(data.items);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch {
      toast.error("No se pudieron cargar las tiendas");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  async function sendWhatsApp(s: StoreItem) {
    const rawPhone = s.owner_phone || s.whatsapp;
    if (!rawPhone) {
      toast.error("Esta tienda no tiene un teléfono registrado");
      return;
    }
    const phone = normalizePhone(rawPhone);
    const message = buildMessage(s);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");

    setSending(s.id);
    try {
      await apiClient.post(`/admin/stores/${s.id}/mark-contacted`);
      setStores((prev) =>
        prev.map((st) => (st.id === s.id ? { ...st, campaign_contacted_at: new Date().toISOString() } : st))
      );
    } catch {
      toast.error("Se abrió WhatsApp, pero no se pudo marcar como contactada");
    } finally {
      setSending(null);
    }
  }

  // Fallback para tiendas sin teléfono registrado — mismo mensaje, por correo.
  async function sendCampaignEmail(s: StoreItem) {
    setSending(s.id);
    try {
      await apiClient.post(`/admin/stores/${s.id}/campaign-email`);
      setStores((prev) =>
        prev.map((st) => (st.id === s.id ? { ...st, campaign_contacted_at: new Date().toISOString() } : st))
      );
      toast.success("Correo enviado");
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo enviar el correo");
    } finally {
      setSending(null);
    }
  }

  const visibleStores = hideContacted ? stores.filter((s) => !s.campaign_contacted_at) : stores;

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Retención</p>
          <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
            Campaña de onboarding
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
            {total} tienda{total !== 1 ? "s" : ""} activa{total !== 1 ? "s" : ""} sin terminar de configurarse
          </p>
        </div>
        <button
          onClick={fetchStores}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "var(--surface-0)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div
        className="rounded-2xl p-3 text-xs flex items-start gap-2"
        style={{ background: "var(--brand-50)", color: "var(--brand-700, var(--ink-2))", border: "1.5px solid var(--line-2)" }}
      >
        <MessageCircle size={15} className="flex-shrink-0 mt-0.5" />
        <p>
          Cada tarjeta arma un mensaje personalizado según lo que le falta a la tienda. Al tocar
          &quot;Enviar WhatsApp&quot; se abre la conversación con el texto listo — solo confirmas el envío.
          Si la tienda tiene correo registrado, también se ofrece enviarlo por correo (ese sí se
          envía directo, sin confirmación manual) — útil cuando el teléfono registrado no tiene
          WhatsApp. El mensaje incluye el link al panel y el link directo a la tienda.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
        <Filter size={13} />
        <input
          type="checkbox"
          checked={hideContacted}
          onChange={(e) => setHideContacted(e.target.checked)}
        />
        Ocultar ya contactadas
      </label>

      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <Skel key={i} />)
        ) : visibleStores.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
              {stores.length === 0
                ? "Ninguna tienda pendiente de completar su onboarding"
                : "Ya contactaste a todas las de esta página"}
            </p>
          </div>
        ) : (
          visibleStores.map((s) => {
            const missing = missingSteps(s);
            const contacted = s.campaign_contacted_at;
            return (
              <div
                key={s.id}
                className="rounded-2xl p-4"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                      {s.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                      {s.owner_name ?? "Sin nombre"}
                      {" · "}
                      {[
                        s.owner_phone ? `Tel: ${s.owner_phone}` : null,
                        s.owner_email ? `Correo: ${s.owner_email}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "sin teléfono ni correo"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                      Creada hace {daysAgo(s.created_at)} día{daysAgo(s.created_at) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {contacted && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--success-soft)", color: "var(--success)" }}
                    >
                      Contactada hace {daysAgo(contacted)}d
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {missing.map((m) => (
                    <span
                      key={m.key}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                    >
                      {m.key === "logo" && <ImageIcon size={10} />}
                      {m.key === "banner" && <GalleryHorizontal size={10} />}
                      {m.key === "products" && <Package size={10} />}
                      {m.label}
                    </span>
                  ))}
                </div>

                <div
                  className="mt-3 rounded-xl px-3 py-2 text-xs"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                >
                  {buildMessage(s)}
                </div>

                {s.owner_phone || s.whatsapp || s.owner_email ? (
                  <div className="flex gap-2 mt-3">
                    {(s.owner_phone || s.whatsapp) && (
                      <button
                        disabled={sending === s.id}
                        onClick={() => sendWhatsApp(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
                        style={{ background: "#25D366", color: "#fff" }}
                      >
                        <MessageCircle size={14} />
                        {contacted ? "De nuevo por WhatsApp" : "Enviar por WhatsApp"}
                      </button>
                    )}
                    {s.owner_email && (
                      <button
                        disabled={sending === s.id}
                        onClick={() => sendCampaignEmail(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
                        style={{ background: "var(--ink)", color: "var(--bg)" }}
                      >
                        <Mail size={14} />
                        {sending === s.id
                          ? "Enviando..."
                          : contacted
                          ? "De nuevo por correo"
                          : "Enviar por correo"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className="w-full text-center py-2.5 rounded-xl text-xs font-semibold mt-3"
                    style={{ background: "var(--surface-2)", color: "var(--ink-4)" }}
                  >
                    Sin teléfono ni correo — no se puede contactar
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-2 rounded-xl disabled:opacity-40"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
            Página {page} de {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="p-2 rounded-xl disabled:opacity-40"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
