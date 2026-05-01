"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { ShoppingCart, Search, ChevronRight, Star, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "./ProductCard";
import CartDrawer from "./CartDrawer";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";

interface Props {
  store: any;
  initialProducts: any[];
}

export default function StorePage({ store, initialProducts }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const cartCount = useCartStore((s) => s.totalItems());

  const filteredProducts = useMemo(() => {
    let items = initialProducts;
    if (activeCategory) items = items.filter((p) => p.category_id === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [initialProducts, activeCategory, search]);

  const featured = initialProducts.filter((p) => p.is_featured).slice(0, 3);

  return (
    <div className="min-h-screen bg-surface-50">
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100"
        style={{ borderColor: `${store.primary_color}20` }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {store.logo_url ? (
            <Image
              src={store.logo_url}
              alt={store.name}
              width={36}
              height={36}
              className="rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: store.primary_color }}
            >
              {store.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-gray-900 text-sm leading-tight truncate">
              {store.name}
            </h1>
            {store.city && (
              <p className="text-xs text-gray-400 truncate">{store.city}</p>
            )}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-xl active:scale-90 transition-transform"
            style={{ background: `${store.primary_color}15` }}
          >
            <ShoppingCart size={20} style={{ color: store.primary_color }} />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: store.primary_color }}
              >
                {cartCount}
              </motion.span>
            )}
          </button>
        </div>
      </header>

      {/* ── Banner ─────────────────────────────────────── */}
      {store.banner_url && (
        <div className="relative h-40 overflow-hidden">
          <Image
            src={store.banner_url}
            alt={store.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        </div>
      )}

      {/* ── Featured Carousel ──────────────────────────── */}
      {featured.length > 0 && !search && (
        <section className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 mb-3">
            <Zap size={14} style={{ color: store.primary_color }} />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Destacados
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                storeColor={store.primary_color}
                storeSlug={store.slug}
                featured
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Search ─────────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* ── Category Tabs ──────────────────────────────── */}
      {store.categories?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
              !activeCategory
                ? "text-white shadow-sm"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
            style={!activeCategory ? { background: store.primary_color } : {}}
          >
            Todo
          </button>
          {store.categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? "text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
              style={activeCategory === cat.id ? { background: store.primary_color } : {}}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Products Grid ──────────────────────────────── */}
      <main className="px-4 pb-32">
        <AnimatePresence mode="wait">
          {filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-16 text-center"
            >
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-500 text-sm">No se encontraron productos</p>
            </motion.div>
          ) : (
            <motion.div
              key={activeCategory + search}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3"
            >
              {filteredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <ProductCard
                    product={product}
                    storeColor={store.primary_color}
                    storeSlug={store.slug}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Sticky Cart CTA ────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 pb-safe z-20"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between rounded-2xl px-5 py-4 text-white font-semibold shadow-float"
              style={{ background: store.primary_color }}
            >
              <span className="flex items-center gap-2">
                <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {cartCount}
                </span>
                Ver pedido
              </span>
              <ChevronRight size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer ────────────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        store={store}
      />
    </div>
  );
}
