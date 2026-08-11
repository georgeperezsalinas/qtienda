"use client";

// Admin: banners rotatorios del Mall (/tiendas). Mismo patrón que los
// banners de tienda en dashboard/configuracion — imagen + link opcional,
// reemplazo completo de la lista al guardar.

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, ImageIcon, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ImageUpload } from "@/components/ui/ImageUpload";

interface BannerForm {
  image_url: string;
  link_url: string;
}

const MAX_BANNERS = 6;

export default function AdminMallBannersPage() {
  const [banners, setBanners] = useState<BannerForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get("/admin/mall-banners")
      .then(({ data }) => {
        setBanners(
          (data.banners ?? []).map((b: any) => ({ image_url: b.image_url, link_url: b.link_url || "" }))
        );
      })
      .catch(() => toast.error("No se pudieron cargar los banners"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    const incomplete = banners.some((b) => !b.image_url.trim());
    if (incomplete) {
      toast.error("Sube una imagen para cada banner, o quítalo");
      return;
    }
    setSaving(true);
    try {
      await apiClient.put("/admin/mall-banners", {
        banners: banners.map((b) => ({ image_url: b.image_url, link_url: b.link_url || null })),
      });
      toast.success("Banners del Mall actualizados");
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
      <div>
        <p className="eyebrow">Mall Qtienda</p>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Banners rotatorios
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          Se muestran en /tiendas, rotando junto al banner de bienvenida. Formato exacto:{" "}
          <strong>1600×400 px</strong> (4:1) — se muestra completo, sin recortar, así que el
          diseño debe llegar hasta los bordes (sin márgenes en blanco). JPEG/PNG/WebP, máx 5 MB.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          {banners.length === 0 && (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
            >
              <ImageIcon size={28} className="mx-auto mb-2" style={{ color: "var(--ink-4)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
                Sin banners configurados — el Mall muestra un slide de texto genérico invitando a crear tienda.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {banners.map((b, i) => (
              <div
                key={i}
                className="rounded-2xl p-3 space-y-2"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <ImageUpload
                      label={`Banner ${i + 1}`}
                      value={b.image_url}
                      onChange={(url) =>
                        setBanners((prev) => prev.map((x, j) => (j === i ? { ...x, image_url: url } : x)))
                      }
                      hint={"1600×400 px exacto (4:1) · diseño hasta el borde, sin márgenes\nJPEG, PNG o WebP · máx 5 MB"}
                      className="h-28 w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setBanners((prev) => prev.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ color: "var(--danger)" }}
                    aria-label="Quitar banner"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="relative">
                  <ExternalLink
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--ink-4)" }}
                  />
                  <input
                    className="input pl-8"
                    type="url"
                    placeholder="Enlace opcional: https://… o /auth/register"
                    value={b.link_url}
                    onChange={(e) =>
                      setBanners((prev) => prev.map((x, j) => (j === i ? { ...x, link_url: e.target.value } : x)))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {banners.length < MAX_BANNERS && (
            <button
              type="button"
              onClick={() => setBanners((prev) => [...prev, { image_url: "", link_url: "" }])}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
              style={{ border: "1.5px dashed var(--line-2)", color: "var(--ink-3)" }}
            >
              <Plus size={15} /> Agregar banner ({banners.length}/{MAX_BANNERS})
            </button>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--brand-600)" }}
          >
            <Save size={15} />
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      )}
    </div>
  );
}
