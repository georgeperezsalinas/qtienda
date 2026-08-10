import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackStoreEvent } from "@/lib/storeAnalytics";

// Favoritos sin login: clave "{storeSlug}:{productId}" para que funcionen
// entre distintas tiendas sin colisionar ids.
interface FavoritesStore {
  ids: string[];
  toggle: (storeSlug: string, productId: string) => void;
  isFavorite: (storeSlug: string, productId: string) => boolean;
  countForStore: (storeSlug: string) => number;
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
      },
      isFavorite(storeSlug, productId) {
        return get().ids.includes(key(storeSlug, productId));
      },
      countForStore(storeSlug) {
        return get().ids.filter((i) => i.startsWith(`${storeSlug}:`)).length;
      },
    }),
    { name: "qtienda-favorites" }
  )
);
