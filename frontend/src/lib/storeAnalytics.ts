// Tracking de eventos de la tienda pública (QT-008).
// Best-effort: usa sendBeacon cuando existe (sobrevive a la navegación)
// y nunca lanza errores — el analytics jamás debe romper la compra.

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export type StoreEventName = "store_view" | "product_view" | "add_to_cart" | "checkout_start";

function getSessionId(): string {
  try {
    let id = localStorage.getItem("qtienda_session");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("qtienda_session", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function getDevice(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function trackStoreEvent(
  storeSlug: string,
  event: StoreEventName,
  productId?: string,
) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      event,
      product_id: productId,
      session_id: getSessionId(),
      device: getDevice(),
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
