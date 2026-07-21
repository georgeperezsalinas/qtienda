"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  /** Si se define, se muestra un textarea y su valor se pasa a onConfirm */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonDefaultValue?: string;
  reasonRequired?: boolean;
  /** Si se define, exige escribir este texto exacto para habilitar el botón */
  typedConfirmText?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  reasonLabel,
  reasonPlaceholder,
  reasonDefaultValue = "",
  reasonRequired,
  typedConfirmText,
  loading,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const [reason, setReason] = useState(reasonDefaultValue);
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const danger = variant === "danger";
  const reasonOk = !reasonRequired || reason.trim().length > 0;
  const typedOk = !typedConfirmText || typed === typedConfirmText;
  const canConfirm = reasonOk && typedOk && !loading;

  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: "rgba(20,19,15,.5)", backdropFilter: "blur(2px)" }}
        onClick={onCancel}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[61] animate-fade-up rounded-t-[28px] sm:inset-0 sm:bottom-auto sm:m-auto sm:h-fit sm:max-w-[420px] sm:rounded-[24px]"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", maxHeight: "90dvh", overflowY: "auto" }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--ink-4)" }} />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: danger ? "var(--danger-soft)" : "var(--accent-soft)" }}
            >
              <AlertTriangle size={18} style={{ color: danger ? "var(--danger)" : "var(--accent-ink)" }} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>{title}</h3>
              <div className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-3)" }}>{message}</div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--surface-2)" }}
            >
              <X size={15} style={{ color: "var(--ink-2)" }} />
            </button>
          </div>

          {reasonLabel && (
            <div>
              <label className="field-label">{reasonLabel}</label>
              <textarea
                className="input"
                style={{ minHeight: 72, resize: "vertical" }}
                placeholder={reasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          {typedConfirmText && (
            <div>
              <label className="field-label">
                Escribe <strong style={{ color: "var(--ink)" }}>{typedConfirmText}</strong> para confirmar
              </label>
              <input
                className="input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={typedConfirmText}
                autoComplete="off"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onCancel} className="btn-secondary flex-1 justify-center" disabled={loading}>
              {cancelLabel}
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={!canConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: danger ? "var(--danger)" : "var(--ink)" }}
            >
              {loading ? "..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
