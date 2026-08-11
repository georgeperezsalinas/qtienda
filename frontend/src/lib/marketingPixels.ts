// Pixels de marketing DEL VENDEDOR (TikTok/Meta/GA) — para que mida sus
// propias campañas de anuncios. Distinto del analytics interno de qtienda
// (storeAnalytics.ts / siteAnalytics.ts), que sigue funcionando igual.
//
// Los scripts base se inyectan una vez por <MarketingPixels> (StorePage);
// estas funciones solo disparan eventos estándar en los momentos clave
// (ver producto, agregar al carrito, iniciar checkout, compra) y son
// no-ops seguros si el vendedor no configuró ese pixel — nunca rompen la
// tienda por un pixel ausente o un adblocker.

declare global {
  interface Window {
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

interface PixelProduct {
  id: string;
  name: string;
  price_cents: number;
}

function toAmount(cents: number) {
  return Math.round(cents) / 100;
}

export function pixelViewContent(product: PixelProduct, currency = "PEN") {
  try {
    window.ttq?.track("ViewContent", {
      content_id: product.id,
      content_name: product.name,
      value: toAmount(product.price_cents),
      currency,
    });
    window.fbq?.("track", "ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value: toAmount(product.price_cents),
      currency,
    });
    window.gtag?.("event", "view_item", {
      currency,
      value: toAmount(product.price_cents),
      items: [{ item_id: product.id, item_name: product.name }],
    });
  } catch {
    /* nunca romper la tienda por un pixel */
  }
}

export function pixelAddToCart(product: PixelProduct, quantity = 1, currency = "PEN") {
  try {
    const value = toAmount(product.price_cents) * quantity;
    window.ttq?.track("AddToCart", {
      content_id: product.id,
      content_name: product.name,
      quantity,
      value,
      currency,
    });
    window.fbq?.("track", "AddToCart", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value,
      currency,
    });
    window.gtag?.("event", "add_to_cart", {
      currency,
      value,
      items: [{ item_id: product.id, item_name: product.name, quantity }],
    });
  } catch {
    /* nunca romper la tienda por un pixel */
  }
}

export function pixelInitiateCheckout(valueCents: number, itemCount: number, currency = "PEN") {
  try {
    const value = toAmount(valueCents);
    window.ttq?.track("InitiateCheckout", { value, currency, quantity: itemCount });
    window.fbq?.("track", "InitiateCheckout", { value, currency, num_items: itemCount });
    window.gtag?.("event", "begin_checkout", { value, currency });
  } catch {
    /* nunca romper la tienda por un pixel */
  }
}

export function pixelPurchase(orderNumber: string, valueCents: number, currency = "PEN") {
  try {
    const value = toAmount(valueCents);
    window.ttq?.track("CompletePayment", { value, currency, content_id: orderNumber });
    window.fbq?.("track", "Purchase", { value, currency });
    window.gtag?.("event", "purchase", { transaction_id: orderNumber, value, currency });
  } catch {
    /* nunca romper la tienda por un pixel */
  }
}
