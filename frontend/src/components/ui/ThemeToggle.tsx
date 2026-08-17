"use client";

// Interruptor claro/oscuro para las superficies con tema "panel-calido"
// (landing, /tiendas, panel de vendedor). Un solo atributo global en
// <html> — la variante oscura de cada tema vive en globals.css escopeada
// a [data-color-scheme="dark"] [data-theme="panel-calido"], así que este
// botón sirve para las tres pantallas sin lógica adicional.

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "qtienda-color-scheme";

function useColorScheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-color-scheme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-color-scheme", next ? "dark" : "light");
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  return { dark, toggle };
}

/** Botón circular con ícono — para headers/top bars con espacio angosto. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { dark, toggle } = useColorScheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={dark ? "Tema claro" : "Tema oscuro"}
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 transition-transform active:scale-90 ${className}`}
      style={{
        width: 36,
        height: 36,
        background: "var(--surface-2)",
        color: "var(--ink-2)",
        border: "1px solid var(--line)",
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Fila con label + switch — para pantallas de lista/ajustes (p.ej. "Más"). */
export function ThemeToggleRow({ className = "" }: { className?: string }) {
  const { dark, toggle } = useColorScheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex w-full items-center gap-3 px-3.5 py-3.5 ${className}`}
      style={{ color: "var(--ink-2)" }}
    >
      {dark ? (
        <Moon size={18} strokeWidth={1.7} style={{ color: "var(--ink-3)" }} />
      ) : (
        <Sun size={18} strokeWidth={1.7} style={{ color: "var(--ink-3)" }} />
      )}
      <span className="text-sm font-medium" style={{ flex: 1, textAlign: "left" }}>
        Tema oscuro
      </span>
      <span
        aria-hidden
        className="relative rounded-full transition-colors flex-shrink-0"
        style={{
          width: 40,
          height: 24,
          background: dark ? "var(--accent)" : "var(--line-2)",
        }}
      >
        <span
          className="absolute rounded-full transition-transform"
          style={{
            width: 18,
            height: 18,
            top: 3,
            left: 3,
            background: "#fff",
            transform: dark ? "translateX(16px)" : "translateX(0)",
            boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          }}
        />
      </span>
    </button>
  );
}
