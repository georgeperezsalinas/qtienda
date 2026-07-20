import { create } from "zustand";
import { persist } from "zustand/middleware";

// Últimos productos comprados por tienda, para el bloque "Comprar de nuevo".
// Guarda como máximo 12 ids por tienda, más recientes primero.
interface RecentPurchasesStore {
  byStore: Record<string, string[]>;
  record: (storeSlug: string, productIds: string[]) => void;
  getRecent: (storeSlug: string) => string[];
}

const MAX_PER_STORE = 12;

export const useRecentPurchasesStore = create<RecentPurchasesStore>()(
  persist(
    (set, get) => ({
      byStore: {},
      record(storeSlug, productIds) {
        set((state) => {
          const prev = state.byStore[storeSlug] || [];
          const merged = [...productIds, ...prev.filter((id) => !productIds.includes(id))].slice(0, MAX_PER_STORE);
          return { byStore: { ...state.byStore, [storeSlug]: merged } };
        });
      },
      getRecent(storeSlug) {
        return get().byStore[storeSlug] || [];
      },
    }),
    { name: "qtienda-recent-purchases" }
  )
);
