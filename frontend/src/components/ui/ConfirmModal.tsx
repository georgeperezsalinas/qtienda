"use client";

// Reemplazo del confirm() nativo del navegador para acciones destructivas
// (borrar, desactivar) — antes solo existía inline en productos/page.tsx;
// se extrajo acá para que configuración, servicios y cupones usen la misma
// experiencia en vez del cuadro feo y bloqueante del navegador.

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** false para acciones no destructivas (ej. desactivar en vez de borrar) — botón oscuro en vez de rojo. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-[70]"
        style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
        onClick={onCancel}
      />
      <div
        className="fixed z-[71] left-1/2 top-1/2 w-[88vw] max-w-xs rounded-[24px] p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
          {title}
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
          {message}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-3 text-sm font-bold"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1.5px solid var(--line-2)" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
            style={{ background: danger ? "var(--danger)" : "var(--ink)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
