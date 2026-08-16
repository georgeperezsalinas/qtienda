import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartItem {
  id: string;
  variant_id?: string;
  variant_label?: string;
  name: string;
  price_cents: number;
  image_url: string;
  quantity: number;
}

// Identidad de una línea de carrito: mismo producto pero variante distinta
// son líneas separadas (no deben mezclarse al sumar cantidad).
function lineKey(i: { id: string; variant_id?: string }) {
  return `${i.id}:${i.variant_id ?? ""}`;
}

interface CartStore {
  storeSlug: string | null;
  items: CartItem[];
  addItem: (item: CartItem, storeSlug: string, qty?: number) => void;
  removeItem: (id: string, variant_id?: string) => void;
  updateQty: (id: string, qty: number, variant_id?: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalCents: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      storeSlug: null,
      items: [],

      addItem(item, storeSlug, qty = 1) {
        set((state) => {
          // Different store — clear cart before adding
          if (state.storeSlug !== null && state.storeSlug !== storeSlug) {
            return { storeSlug, items: [{ ...item, quantity: qty }] };
          }
          const existing = state.items.find((i) => lineKey(i) === lineKey(item));
          if (existing) {
            return {
              storeSlug,
              items: state.items.map((i) =>
                lineKey(i) === lineKey(item) ? { ...i, quantity: i.quantity + qty } : i
              ),
            };
          }
          return { storeSlug, items: [...state.items, { ...item, quantity: qty }] };
        });
      },

      removeItem(id, variant_id) {
        set((state) => ({
          items: state.items.filter((i) => lineKey(i) !== lineKey({ id, variant_id })),
        }));
      },

      updateQty(id, qty, variant_id) {
        if (qty < 1) return get().removeItem(id, variant_id);
        set((state) => ({
          items: state.items.map((i) =>
            lineKey(i) === lineKey({ id, variant_id }) ? { ...i, quantity: qty } : i
          ),
        }));
      },

      clearCart() {
        set({ storeSlug: null, items: [] });
      },

      totalItems: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
      totalCents: () =>
        get().items.reduce((acc, i) => acc + i.price_cents * i.quantity, 0),
    }),
    {
      name: "qtienda-cart",
      partialize: (state) => ({ storeSlug: state.storeSlug, items: state.items }),
    }
  )
);
