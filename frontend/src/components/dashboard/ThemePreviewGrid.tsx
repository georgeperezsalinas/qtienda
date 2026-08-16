"use client";

// src/components/dashboard/ThemePreviewGrid.tsx
//
// Picker de tema de vitrina con preview — antes vivía inline en
// dashboard/configuracion/page.tsx, extraído para reusarlo también en el
// wizard de creación de tienda (mismo componente, dos lugares, una sola
// fuente de verdad para los 6 temas).
//
// El preview es un mock abstracto (fondo + barras de color imitando
// header/producto), no un iframe en vivo de la tienda real — sigue siendo
// útil incluso antes de tener productos/logo cargados.

// Temas de vitrina: cambian layout/neutros de la tienda pública. El color de
// marca (primary_color) es independiente y se aplica dentro de cualquier tema.
export type StoreTheme = "clasico" | "elegante" | "vibrante" | "pastel" | "monocromo" | "fresco";

export const THEMES: { value: StoreTheme; label: string; bg: string; text: string }[] = [
  { value: "clasico", label: "Clásico", bg: "#FCFBF7", text: "#14130F" },
  { value: "elegante", label: "Elegante", bg: "#1A1712", text: "#F3ECDD" },
  { value: "vibrante", label: "Vibrante", bg: "#FFFFFF", text: "#3A1F16" },
  { value: "pastel", label: "Pastel", bg: "#FDF6F9", text: "#3A2A33" },
  { value: "monocromo", label: "Monocromo", bg: "#FFFFFF", text: "#0A0A0A" },
  { value: "fresco", label: "Fresco", bg: "#F2FAF8", text: "#12302A" },
];

export function ThemePreviewGrid({
  value,
  onChange,
  primaryColor,
}: {
  value: StoreTheme;
  onChange: (theme: StoreTheme) => void;
  primaryColor: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {THEMES.map((th) => {
        const active = value === th.value;
        return (
          <button
            key={th.value}
            type="button"
            onClick={() => onChange(th.value)}
            className="rounded-2xl overflow-hidden text-left transition-all"
            style={{
              border: `2px solid ${active ? "var(--accent)" : "var(--line-2)"}`,
              boxShadow: active ? "0 0 0 3px var(--accent-soft)" : "none",
            }}
          >
            <div style={{ height: 44, background: th.bg, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ width: "40%", height: 5, borderRadius: 3, background: primaryColor }} />
              <div style={{ display: "flex", gap: 3, flex: 1 }}>
                <div style={{ flex: 1, borderRadius: 3, background: `${th.text}14` }} />
                <div style={{ flex: 1, borderRadius: 3, background: primaryColor }} />
              </div>
            </div>
            <div
              className="text-[11px] font-bold px-2 py-1.5 flex items-center justify-between"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              {th.label}
              {active && <span style={{ color: "var(--accent)" }}>✓</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
