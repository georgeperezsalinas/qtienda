"use client";

// Link de instalación dentro del banner de /tiendas — usa el manifest y los
// iconos propios de "Mall Qtienda" (public/manifest-mall.json, /icon-mall/*),
// separado del banner de instalación de qtienda (HomeInstallBanner).

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/pwa";

const DISMISS_KEY = "pwa-mall-banner-dismissed";

export default function MallInstallLink() {
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

  if (showIOSHint) {
    return (
      <p className="text-xs mt-1.5 text-white/90 flex items-center gap-1 flex-wrap">
        Toca <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> Compartir →
        &ldquo;Añadir a pantalla de inicio&rdquo; para instalar
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
        style={{ background: "rgba(255,255,255,.22)", border: "1px solid rgba(255,255,255,.4)" }}
      >
        <Download size={12} /> Instalar Mall Qtienda
      </button>
      <button
        onClick={dismiss}
        className="text-[11px] font-semibold text-white/70"
        aria-label="No mostrar de nuevo"
      >
        Ahora no
      </button>
    </div>
  );
}
