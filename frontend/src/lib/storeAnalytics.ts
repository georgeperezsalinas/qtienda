// Tracking de eventos de la tienda pública (QT-008).
// Best-effort: usa sendBeacon cuando existe (sobrevive a la navegación)
// y nunca lanza errores — el analytics jamás debe romper la compra.

import { getSessionId, getDevice } from "./analyticsSession";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export type StoreEventName = "store_view" | "product_view" | "add_to_cart" | "checkout_start" | "product_favorite";

export function trackStoreEvent(
  storeSlug: string,
  event: StoreEventName,
  productId?: string,
  extra?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      event,
      product_id: productId,
      session_id: getSessionId(),
      device: getDevice(),
      ...extra,
    });
    const url = `${BASE}/public/store/${storeSlug}/events`;
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
    // nunca romper la tienda por analytics
  }
}

/** Cuantas sesiones distintas vieron este producto en los ultimos minutos.
 * Best-effort: si falla, se asume 0 (el badge simplemente no se muestra). */
export async function fetchProductViewers(storeSlug: string, productId: string): Promise<number> {
  try {
    const res = await fetch(`${BASE}/public/store/${storeSlug}/products/${productId}/viewers`);
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.count === "number" ? data.count : 0;
  } catch {
    return 0;
  }
}
