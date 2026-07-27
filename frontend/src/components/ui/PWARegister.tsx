"use client";

// src/components/ui/PWARegister.tsx — qtienda v2
// - Registra el Service Worker
// - Captura el evento beforeinstallprompt
// - Muestra un banner nativo de instalación en Android/Chrome
// - En iOS muestra instrucciones manuales (Safari no soporta beforeinstallprompt)

import { useEffect, useState } from "react";
import { Download, X, Share, RefreshCw } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/pwa";

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Registrar Service Worker + detección de nueva versión
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[qtienda] SW registrado:", reg.scope);
          }

          // ¿Ya hay una versión nueva esperando? (la página se abrió con la vieja)
          if (reg.waiting && navigator.serviceWorker.controller) {
            setWaitingWorker(reg.waiting);
          }

          // Versión nueva descargándose en este momento
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(nw);
              }
            });
          });

          // Buscar updates al volver a la app (clave en PWAs instaladas que
          // quedan en memoria en el celular) y cada hora
          const check = () => reg.update().catch(() => {});
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") check();
          });
          setInterval(check, 60 * 60 * 1000);
        })
        .catch((err) => {
          console.warn("[qtienda] SW error:", err);
        });

      // Cuando el SW nuevo toma control, recargar una sola vez
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
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

    // Páginas con su propio banner de instalación (no duplicar aquí):
    // /tienda/* (StorePage), "/" (landing) y /tiendas (Mall, con su propio manifest/icono)
    const hasOwnBanner = () =>
      window.location.pathname.startsWith("/tienda/") ||
      window.location.pathname === "/" ||
      window.location.pathname === "/tiendas";

    // Android / Chrome: capturar evento de instalación
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Esperar 5s antes de mostrar el flotante
      setTimeout(() => {
        if (!hasOwnBanner()) setShowBanner(true);
      }, 5_000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari: mostrar hint manual después de 45s
    if (isIOS()) {
      const timer = setTimeout(() => {
        if (!hasOwnBanner()) setShowIOSHint(true);
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

  // Activar la versión nueva: el SW hace skipWaiting y controllerchange recarga
  function handleUpdate() {
    if (!waitingWorker) return;
    setUpdating(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    // Fallback por si controllerchange no dispara (ej. SW ya activado)
    setTimeout(() => window.location.reload(), 3_000);
  }

  // ── Banner de nueva versión (prioridad sobre todo lo demás) ──
  if (waitingWorker) {
    return (
      <div
        role="banner"
        aria-label="Nueva versión disponible"
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
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          fontFamily: "var(--font-sans)",
          animation: "slideUp 0.3s ease",
        }}
      >
        <span style={{ fontSize: 24, flexShrink: 0 }}>✨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
            Nueva versión de qtienda
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "2px 0 0", lineHeight: 1.3 }}>
            Actualiza para ver las mejoras
          </p>
        </div>
        <button
          onClick={handleUpdate}
          disabled={updating}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: updating ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            opacity: updating ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={updating ? "animate-spin" : undefined} />
          {updating ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
    );
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
