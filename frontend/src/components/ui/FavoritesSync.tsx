"use client";

// Fusiona los favoritos guardados en el navegador (sin sesión) con la cuenta
// del comprador, una vez por sesión de pestaña al detectar login — mismo
// patrón "componente invisible montado en el layout raíz" que PWARegister.
// Nunca borra nada: siempre es unión (local ∪ cuenta), en ambas direcciones.

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { apiClient } from "@/lib/api";

export default function FavoritesSync() {
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated());
  const userId = useAuthStore((s) => s.user?.id);
  const hydrateFromAccount = useFavoritesStore((s) => s.hydrateFromAccount);
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    if (syncedForUser.current === userId) return; // ya corrió para este usuario en esta pestaña
    syncedForUser.current = userId;

    (async () => {
      try {
        // 1. Sube los favoritos locales (guardados antes de iniciar sesión,
        //    o en otro dispositivo) — el backend los une, nunca reemplaza.
        const localIds = useFavoritesStore.getState().ids;
        const productIds = localIds.map((id) => id.split(":")[1]).filter(Boolean);
        if (productIds.length > 0) {
          await apiClient.post("/buyer/favorites/sync", { product_ids: productIds }).catch(() => {});
        }
        // 2. Trae los de la cuenta (de este u otro dispositivo) y los mezcla
        //    con los locales — así tampoco se pierde nada del otro lado.
        const { data } = await apiClient.get("/buyer/favorites");
        hydrateFromAccount(Array.isArray(data) ? data : []);
      } catch {
        // best-effort — favoritos nunca deben romper la navegación
      }
    })();
  }, [isLoggedIn, userId, hydrateFromAccount]);

  return null;
}
