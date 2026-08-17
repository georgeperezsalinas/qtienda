// src/lib/phoneVerification.ts — recuerda, por dispositivo, qué teléfonos
// ya pasaron el código de WhatsApp hace poco (CartDrawer, BookingModal).
//
// Sin esto, cada intento de checkout/reserva volvía a pedir un código nuevo
// aunque el comprador ya se hubiera verificado minutos antes (el paso
// "verify" se desmonta/remonta cada vez que se re-entra a él) — eso quema
// rápido el límite de 3 códigos/hora del backend en uso normal (ida y
// vuelta corrigiendo datos, un segundo pedido seguido, etc.), no solo en
// pruebas repetidas.
//
// La ventana de 30 min replica PHONE_VERIFIED_VALID_MINUTES del backend —
// si algún día se desincronizan, esto en el peor caso solo ahorra una
// llamada de más; el backend sigue siendo la fuente de verdad real.

const STORAGE_KEY = "qtienda_phone_verified";
const VALID_MINUTES = 30;

export function isPhoneRecentlyVerified(phone: string): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const expiresAt = map[phone];
    return !!expiresAt && new Date(expiresAt).getTime() > Date.now();
  } catch {
    return false;
  }
}

export function markPhoneVerified(phone: string) {
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    map[phone] = new Date(Date.now() + VALID_MINUTES * 60_000).toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage no disponible (modo privado, etc.) — no es crítico,
    // solo vuelve a pedir el código la próxima vez.
  }
}

export function clearPhoneVerified(phone: string) {
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete map[phone];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}
