/** Helpers de detección PWA — compartidos entre PWARegister y cualquier
 *  banner de instalación propio (ej. landing). Una sola fuente de verdad. */

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/** Numerito en el ícono de la app instalada (Badging API — Chromium
 *  Android/desktop; Safari/iOS no la soporta, la llamada simplemente no hace nada). */
export function syncAppBadge(count: number): void {
  if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
  const nav = navigator as Navigator & { setAppBadge: (n?: number) => Promise<void>; clearAppBadge: () => Promise<void> };
  (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()).catch(() => {});
}
