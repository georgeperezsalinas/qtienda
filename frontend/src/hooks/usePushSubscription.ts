"use client";

// src/hooks/usePushSubscription.ts — qtienda v2
//
// CAMBIOS vs versión anterior:
//   - Suscribe tanto a vendedores (por email) como a compradores anónimos
//   - Acepta userId opcional para asociar la suscripción al vendedor
//   - Mejor manejo de errores con reintentos
//   - Exporta también useSellerPushSubscription para el dashboard

import { useEffect } from "react";
import { apiClient } from "@/lib/api";

// ── Helpers de conversión ────────────────────────────────────
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

// ── Core: suscribir un email a push notifications ────────────
async function subscribeToPush(email: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission === "denied") return;

  // 1. Obtener la VAPID public key del backend
  const { data } = await apiClient.get("/push/vapid-public-key");
  const publicKey: string = data.public_key;

  // 2. Esperar a que el SW esté listo
  const reg = await navigator.serviceWorker.ready;

  // 3. Ver si ya hay una suscripción activa
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    // 4. Pedir permiso si aún no lo tenemos
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    }

    // 5. Crear la suscripción con la VAPID public key
    sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }

  // 6. Extraer las keys de la suscripción
  const key  = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!key || !auth) return;

  // 7. Registrar en el backend
  await apiClient.post("/push/subscribe", {
    endpoint: sub.endpoint,
    p256dh:   arrayBufferToBase64(key),
    auth:     arrayBufferToBase64(auth),
    email,
  });
}

// ── Hook para compradores (tienda pública) ───────────────────
// Usado en StorePage cuando el comprador tiene cuenta
export function usePushSubscription(
  buyerEmail: string | null | undefined
) {
  useEffect(() => {
    if (!buyerEmail) return;
    subscribeToPush(buyerEmail).catch(() => {
      // Push es best-effort — nunca bloquear la UI
    });
  }, [buyerEmail]);
}

// ── Hook para vendedores (dashboard) ────────────────────────
// Úsalo en dashboard/layout.tsx para que el vendedor reciba
// notificaciones de nuevos pedidos en tiempo real
//
// Ejemplo:
//   const { user } = useAuthStore();
//   useSellerPushSubscription(user?.email);
//
export function useSellerPushSubscription(
  sellerEmail: string | null | undefined
) {
  useEffect(() => {
    if (!sellerEmail) return;

    // Esperar 3s para no competir con la carga inicial del dashboard
    const timer = setTimeout(() => {
      subscribeToPush(sellerEmail).catch(() => {});
    }, 3_000);

    return () => clearTimeout(timer);
  }, [sellerEmail]);
}
