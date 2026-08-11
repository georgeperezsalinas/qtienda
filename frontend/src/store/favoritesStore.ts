import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackStoreEvent } from "@/lib/storeAnalytics";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

// Favoritos: localStorage es la fuente de verdad inmediata (funciona sin
// login, respuesta instantánea). Clave "{storeSlug}:{productId}" para que
// funcionen entre distintas tiendas sin colisionar ids.
// Cuando hay sesión iniciada, además se sincronizan con la cuenta (best-
// effort, en segundo plano) — así no se pierden al cambiar de dispositivo.
// La fusión inicial (local → cuenta y cuenta → local) la hace
// components/ui/FavoritesSync.tsx una vez por sesión de pestaña.
interface FavoritesStore {
  ids: string[];
  toggle: (storeSlug: string, productId: string) => void;
  isFavorite: (storeSlug: string, productId: string) => boolean;
  countForStore: (storeSlug: string) => number;
  hydrateFromAccount: (pairs: { store_slug: string; product_id: string }[]) => void;
}

const key = (storeSlug: string, productId: string) => `${storeSlug}:${productId}`;

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle(storeSlug, productId) {
        const k = key(storeSlug, productId);
        const wasFavorite = get().ids.includes(k);
        set((state) => ({
          ids: wasFavorite ? state.ids.filter((i) => i !== k) : [...state.ids, k],
        }));
        // Solo al marcar como favorito (no al quitar) — le avisa al vendedor
        // que a alguien le gustó su producto (hito "first_favorite").
        if (!wasFavorite) trackStoreEvent(storeSlug, "product_favorite", productId);

        // Sincroniza con la cuenta si hay sesión — best-effort: el estado
        // local ya cambió arriba y es lo que manda para la UI; si esto
        // falla, el favorito sigue funcionando local, simplemente no viaja
        // a otros dispositivos hasta el próximo toggle o login.
        if (useAuthStore.getState().isAuthenticated()) {
          if (wasFavorite) {
            apiClient.delete(`/buyer/favorites/${productId}`).catch(() => {});
          } else {
            apiClient.post("/buyer/favorites", { product_id: productId }).catch(() => {});
          }
        }
      },
      isFavorite(storeSlug, productId) {
        return get().ids.includes(key(storeSlug, productId));
      },
      countForStore(storeSlug) {
        return get().ids.filter((i) => i.startsWith(`${storeSlug}:`)).length;
      },
      hydrateFromAccount(pairs) {
        set((state) => {
          const merged = new Set(state.ids);
          pairs.forEach((p) => merged.add(key(p.store_slug, p.product_id)));
          return { ids: Array.from(merged) };
        });
      },
    }),
    { name: "qtienda-favorites" }
  )
);
