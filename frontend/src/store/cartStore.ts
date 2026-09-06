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
  is_digital?: boolean;
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
  // No se puede mezclar productos digitales y físicos en un mismo pedido
  // (ver backend/app/api/v1/endpoints/public.py create_order) — se valida acá
  // también para avisar ANTES de llegar al checkout, no recién al pagar.
  canAdd: (item: { id: string; is_digital?: boolean }, storeSlug: string) => { ok: boolean; reason?: string };
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

      canAdd(item, storeSlug) {
        const { items, storeSlug: currentSlug } = get();
        if (currentSlug !== null && currentSlug !== storeSlug) return { ok: true }; // carrito de otra tienda: se limpia al agregar
        if (items.length === 0) return { ok: true };
        const cartIsDigital = !!items[0].is_digital;
        if (cartIsDigital === !!item.is_digital) return { ok: true };
        return {
          ok: false,
          reason: cartIsDigital
            ? "Tu carrito tiene productos digitales. Termina o vacía ese pedido antes de agregar productos físicos."
            : "Tu carrito tiene productos físicos. Termina o vacía ese pedido antes de agregar productos digitales.",
        };
      },
    }),
    {
      name: "qtienda-cart",
      partialize: (state) => ({ storeSlug: state.storeSlug, items: state.items }),
    }
  )
);
