"use client";

// src/components/ui/PWARegister.tsx — qtienda v2
// - Registra el Service Worker
// - Captura el evento beforeinstallprompt
// - Muestra un banner nativo de instalación en Android/Chrome
// - En iOS muestra instrucciones manuales (Safari no soporta beforeinstallprompt)

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

// Detectar iOS
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Detectar si ya está instalada como PWA
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Registrar Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[qtienda] SW registrado:", reg.scope);
        })
        .catch((err) => {
          console.warn("[qtienda] SW error:", err);
        });
    }

    // Si ya está instalada, no mostrar nada
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    // Verificar si el usuario ya rechazó el banner (localStorage)
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    // Android / Chrome: capturar evento de instalación
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Esperar 5s; en páginas /tienda/* ya hay banner propio en StorePage
      setTimeout(() => {
        if (!window.location.pathname.startsWith("/tienda/")) setShowBanner(true);
      }, 5_000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari: mostrar hint manual después de 45s
    if (isIOS()) {
      const timer = setTimeout(() => {
        if (!window.location.pathname.startsWith("/tienda/")) setShowIOSHint(true);
      }, 45_000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        clearTimeout(timer);
      };
    }

    // Detectar instalación exitosa
    window.addEventListener("appinstalled", () => {
      setShowBanner(false);
      setInstalled(true);
      localStorage.removeItem("pwa-banner-dismissed");
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Disparar el prompt nativo de instalación (Android/Chrome)
  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  }

  function dismissBanner() {
    setShowBanner(false);
    setShowIOSHint(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  }

  if (installed || (!showBanner && !showIOSHint)) return null;

  // ── Banner Android / Chrome ──────────────────────────────
  if (showBanner) {
    return (
      <div
        role="banner"
        aria-label="Instalar qtienda"
        style={{
          position: "fixed",
          bottom: 80,           // por encima del bottom nav
          left: 16,
          right: 16,
          zIndex: 9999,
          background: "var(--ink)",
          color: "var(--bg)",
          borderRadius: 16,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          fontFamily: "var(--font-sans)",
          animation: "slideUp 0.3s ease",
        }}
      >
        <img
          src="/icon/icon-72.png"
          alt="qtienda"
          style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
            Instala qtienda
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "2px 0 0", lineHeight: 1.3 }}>
            Accede desde tu pantalla de inicio, más rápido
          </p>
        </div>
        <button
          onClick={handleInstall}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          Instalar
        </button>
        <button
          onClick={dismissBanner}
          aria-label="Cerrar"
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            opacity: 0.5,
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  // ── Hint iOS Safari ──────────────────────────────────────
  if (showIOSHint) {
    return (
      <div
        role="banner"
        aria-label="Instalar qtienda en iPhone"
        style={{
          position: "fixed",
          bottom: 80,
          left: 16,
          right: 16,
          zIndex: 9999,
          background: "var(--ink)",
          color: "var(--bg)",
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          fontFamily: "var(--font-sans)",
          animation: "slideUp 0.3s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
            Instala qtienda en tu iPhone
          </p>
          <button
            onClick={dismissBanner}
            aria-label="Cerrar"
            style={{ background: "transparent", border: "none", color: "inherit", opacity: 0.5, cursor: "pointer", padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        <ol style={{ fontSize: 12, opacity: 0.85, margin: "8px 0 0", paddingLeft: 16, lineHeight: 1.6 }}>
          <li>Toca el botón <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> <strong>Compartir</strong> en Safari</li>
          <li>Selecciona <strong>"Añadir a pantalla de inicio"</strong></li>
          <li>Toca <strong>Añadir</strong></li>
        </ol>
      </div>
    );
  }

  return null;
}
