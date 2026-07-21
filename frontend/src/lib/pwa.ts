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
