// src/app/tienda/[slug]/opengraph-image.tsx
//
// Genera la imagen que se ve al compartir el link de una tienda por
// WhatsApp/Facebook/LinkedIn. Necesario porque esas plataformas no
// renderizan SVG como og:image — antes cualquier tienda sin banner/logo
// (o el fallback de marca) no mostraba ninguna imagen al compartir.
//
// Prioridad de contenido: banner real de la tienda > logo real > iniciales
// con el color de marca de la tienda. Nunca inventa una foto que no exista.

import { ImageResponse } from "next/og";
import { apiPublicStore } from "@/lib/api-server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "qtienda";

interface Props {
  params: { slug: string };
}

export default async function Image({ params }: Props) {
  let store: any = null;
  try {
    store = await apiPublicStore(params.slug);
  } catch {
    store = null;
  }

  const name = store?.name ?? "qtienda";
  const brandColor = store?.primary_color || "#C5613B";
  const initial = name.charAt(0).toUpperCase();

  // ── Tiene banner real: foto de la tienda a pantalla completa ──
  if (store?.banner_url) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={store.banner_url}
            alt=""
            width={1200}
            height={630}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              background: "linear-gradient(to top, rgba(20,19,15,.82) 0%, rgba(20,19,15,0) 45%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "48px 56px" }}>
              {store.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logo_url}
                  alt=""
                  width={84}
                  height={84}
                  style={{ borderRadius: 20, objectFit: "cover", border: "3px solid #fff" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 84,
                    height: 84,
                    borderRadius: 20,
                    background: brandColor,
                    color: "#fff",
                    fontSize: 40,
                    fontWeight: 700,
                    border: "3px solid #fff",
                  }}
                >
                  {initial}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 54, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{name}</div>
                <div style={{ fontSize: 26, color: "rgba(255,255,255,.85)", marginTop: 6 }}>
                  qtienda.shop/{params.slug}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // ── Sin banner: tarjeta de marca con logo o iniciales ──
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: brandColor,
        }}
      >
        {store?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.logo_url}
            alt=""
            width={180}
            height={180}
            style={{ borderRadius: 40, objectFit: "cover", border: "6px solid rgba(255,255,255,.9)" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 180,
              height: 180,
              borderRadius: 40,
              background: "rgba(255,255,255,.18)",
              color: "#fff",
              fontSize: 90,
              fontWeight: 700,
              border: "6px solid rgba(255,255,255,.9)",
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: "#fff", marginTop: 36 }}>{name}</div>
        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,.85)", marginTop: 10 }}>
          qtienda.shop/{params.slug}
        </div>
      </div>
    ),
    { ...size }
  );
}
