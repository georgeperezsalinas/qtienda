"use client";

// Modal flotante de categorías — selección múltiple, compartido entre el
// Mall (departamentos) y cada tienda pública (categorías de productos).
// Antes el filtro de categoría era de a una; esto reemplaza esa limitación
// sin que el componente sepa nada de Mall ni de tienda.

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

export interface CategoryOption {
  key: string;
  label: string;
  icon?: string | null;
}

export default function CategoryFilterModal({
  title = "Categorías",
  options,
  selected,
  onApply,
  onClose,
  accentColor = "var(--accent)",
}: {
  title?: string;
  options: CategoryOption[];
  selected: string[];
  onApply: (selected: string[]) => void;
  onClose: () => void;
  accentColor?: string;
}) {
  // Selección local — "Aplicar" confirma, cerrar sin aplicar no cambia nada.
  const [staged, setStaged] = useState<string[]>(selected);

  function toggle(key: string) {
    setStaged((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[92] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(20,19,15,.55)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-sm max-h-[75vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 className="font-display font-extrabold text-base" style={{ color: "var(--ink)" }}>
            {title}
          </h3>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={18} style={{ color: "var(--ink-3)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {options.map((opt) => {
            const active = staged.includes(opt.key);
            return (
              <button
                key={opt.key}
                onClick={() => toggle(opt.key)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                style={{ background: active ? `${accentColor}14` : "transparent" }}
              >
                {opt.icon && <span className="text-lg flex-shrink-0">{opt.icon}</span>}
                <span className="flex-1 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {opt.label}
                </span>
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: active ? accentColor : "transparent",
                    border: active ? "none" : "1.5px solid var(--line-2)",
                  }}
                >
                  {active && <Check size={13} color="#fff" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--line)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => setStaged([])}
            disabled={staged.length === 0}
            className="text-xs font-bold px-3 py-2.5 disabled:opacity-40"
            style={{ color: "var(--ink-3)" }}
          >
            Limpiar
          </button>
          <button
            onClick={() => onApply(staged)}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white"
            style={{ background: accentColor }}
          >
            {staged.length > 0 ? `Aplicar (${staged.length})` : "Ver todas"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
