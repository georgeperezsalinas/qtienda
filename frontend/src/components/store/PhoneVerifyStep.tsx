"use client";

// Paso compartido de verificación de teléfono por código de WhatsApp —
// usado en BookingModal (reserva de cita) y CartDrawer (checkout). Pide el
// código, lo valida, y avisa al padre vía onVerified() para que continúe.

import { useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

const RESEND_COOLDOWN_S = 45;

export default function PhoneVerifyStep({
  phone, accentColor, onVerified, onBack,
}: {
  phone: string;
  accentColor: string;
  onVerified: () => void;
  onBack?: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_S);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function sendCode() {
    setSending(true);
    try {
      await apiClient.post("/public/phone/send-code", { phone });
      setSent(true);
      startCooldown();
      toast.success("Te mandamos un código por WhatsApp");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudo enviar el código, intenta de nuevo");
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    if (code.trim().length !== 6) {
      toast.error("Ingresa el código de 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      await apiClient.post("/public/phone/verify-code", { phone, code: code.trim() });
      onVerified();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Código incorrecto");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      {onBack && (
        <button onClick={onBack} className="text-xs font-bold mb-3" style={{ color: accentColor }}>
          ← Volver
        </button>
      )}

      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}18` }}
        >
          <ShieldCheck size={15} style={{ color: accentColor }} />
        </div>
        <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Verifica tu teléfono</p>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
        Para evitar reservas falsas, te mandamos un código de 6 dígitos por WhatsApp al{" "}
        <strong style={{ color: "var(--ink-2)" }}>{phone}</strong>.
      </p>

      {!sent ? (
        <button
          onClick={sendCode}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-bold text-sm text-white disabled:opacity-60"
          style={{ background: accentColor }}
        >
          <MessageCircle size={15} />
          {sending ? "Enviando…" : "Enviar código por WhatsApp"}
        </button>
      ) : (
        <div className="space-y-2">
          <input
            className="input text-sm text-center tracking-[0.3em] font-bold"
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button
            onClick={verify}
            disabled={verifying}
            className="w-full rounded-2xl py-3 font-bold text-sm text-white disabled:opacity-60"
            style={{ background: accentColor }}
          >
            {verifying ? "Verificando…" : "Verificar código"}
          </button>
          <button
            onClick={sendCode}
            disabled={cooldown > 0 || sending}
            className="w-full text-xs font-bold py-1 disabled:opacity-50"
            style={{ color: accentColor }}
          >
            {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "Reenviar código"}
          </button>
        </div>
      )}
    </div>
  );
}
