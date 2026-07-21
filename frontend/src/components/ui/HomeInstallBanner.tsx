"use client";

// Banner de instalación dedicado a la landing pública — más visible que el
// flotante genérico de PWARegister.tsx (que se suprime en "/" a propósito
// para no duplicar el mensaje). Aparece solo si la app es instalable y el
// visitante no la instaló ni cerró este banner antes.

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/pwa";

const DISMISS_KEY = "pwa-banner-dismissed";

export default function HomeInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Safari iOS nunca dispara beforeinstallprompt — mostramos instrucciones
    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
    }

    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  }

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  if (!visible) return null;

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: 1152, // alinea con max-w-6xl del resto del landing
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      <div
        className="flex items-center gap-3 md:gap-4"
        style={{
          marginTop: 16,
          padding: "14px 16px",
          borderRadius: 16,
          background: "var(--accent-soft)",
          border: "1px solid rgba(197,97,59,.22)",
        }}
      >
        <img
          src="/icon/icon-72.png"
          alt="qtienda"
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-sm font-bold" style={{ color: "var(--accent-ink)" }}>
            Instala qtienda en tu celular
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
            {showIOSHint
              ? <>Toca <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Compartir → &ldquo;Añadir a pantalla de inicio&rdquo;</>
              : "Acceso directo desde tu pantalla de inicio, sin buscarlo en el navegador"}
          </p>
        </div>
        {!showIOSHint && (
          <button
            onClick={handleInstall}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full text-white"
            style={{ background: "var(--accent)" }}
          >
            <Download size={13} /> Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="flex-shrink-0"
          style={{ color: "var(--ink-3)", opacity: 0.7 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
