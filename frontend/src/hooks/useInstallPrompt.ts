"use client";

// src/hooks/useInstallPrompt.ts — captura el evento nativo de instalación
// (Android/Chrome) para poder ofrecer el botón "Instalar" dentro de una
// tienda. Compartido para no duplicar la lógica en cada lugar que lo usa.

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt(dismissKey: string) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(dismissKey) === "1") setDismissed(true);
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, [dismissKey]);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(dismissKey, "1");
  }

  return { installPrompt, dismissed, install, dismiss };
}
