// Tracking de trafico a nivel dominio (landing, /tiendas) — separado de
// storeAnalytics.ts porque esas paginas no tienen slug de tienda.
// Best-effort: nunca lanza errores, nunca bloquea la navegacion.

import { getSessionId, getDevice } from "./analyticsSession";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      event: "page_view",
      path,
      referrer: document.referrer || undefined,
      session_id: getSessionId(),
      device: getDevice(),
    });
    const url = `${BASE}/public/events`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // nunca romper la pagina por analytics
  }
}
