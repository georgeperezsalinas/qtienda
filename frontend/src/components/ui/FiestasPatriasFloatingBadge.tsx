"use client";

// Escarapela flotando muy sutil durante julio (mes de Fiestas Patrias) —
// al hacer clic abre una ventanita con el saludo y se puede cerrar.
// Puramente decorativa el resto del tiempo; se apaga sola en agosto.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function FiestasPatriasFloatingBadge({ country }: { country?: string }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (country && country !== "PE") return;
    setVisible(new Date().getMonth() === 6); // julio
  }, [country]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!visible) return null;

  return (
    <div ref={ref} className="fixed left-3 bottom-24 z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Feliz Fiestas Patrias"
        className="block"
      >
        <img
          src="/escarapela-peru.jpeg"
          alt=""
          aria-hidden
          className="animate-float-soft w-11 h-11 rounded-full object-cover object-top opacity-90"
          style={{ boxShadow: "0 3px 12px rgba(0,0,0,.18)", border: "2px solid rgba(255,255,255,.85)" }}
        />
      </button>

      {open && (
        <div
          className="animate-fade-up absolute left-0 bottom-full mb-2.5 flex items-center gap-2.5 rounded-2xl pl-3 pr-2 py-2.5"
          style={{
            background: "linear-gradient(120deg, #E2434F, #B0121F)",
            boxShadow: "0 8px 24px rgba(176,18,31,.35)",
            width: 240,
          }}
        >
          <span className="flex-1 text-xs font-bold text-white leading-snug">
            ¡Feliz Fiestas Patrias! Viva el Perú 🇵🇪
          </span>
          <button
            onClick={() => setOpen(false)}
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,.2)" }}
            aria-label="Cerrar"
          >
            <X size={13} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}
