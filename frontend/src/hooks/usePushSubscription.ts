"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api";

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

export function usePushSubscription(buyerEmail: string | null | undefined) {
  useEffect(() => {
    if (!buyerEmail) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    async function subscribe() {
      try {
        const { data } = await apiClient.get("/push/vapid-public-key");
        const publicKey: string = data.public_key;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          if (Notification.permission === "default") {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly:      true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
          });
        }

        const key = sub.getKey("p256dh");
        const auth = sub.getKey("auth");
        if (!key || !auth) return;

        await apiClient.post("/push/subscribe", {
          endpoint: sub.endpoint,
          p256dh:   arrayBufferToBase64(key),
          auth:     arrayBufferToBase64(auth),
          email:    buyerEmail,
        });
      } catch {
        // Push subscription is best-effort — never block UI
      }
    }

    subscribe();
  }, [buyerEmail]);
}
