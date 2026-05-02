"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ShoppingCart, Search, ChevronRight, Zap,
  MapPin, X, MessageCircle,
  Share2, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "./ProductCard";
import ProductImageViewer from "./ProductImageViewer";
import CartDrawer from "./CartDrawer";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";

interface StoreData {
  slug:          string;
  name:          string;
  description?:  string;
  logo_url?:     string;
  banner_url?:   string;
  primary_color: string;
  city?:         string;
  categories?:   { id: string; name: string; icon?: string }[];
  whatsapp?:     string;
  meta_title?:   string;
}

interface ProductData {
  id:            string;
  name:          string;
  description?:  string;
  price_cents:   number;
  compare_price?: number;
  stock?:        number;
  is_featured:   boolean;
  category_id?:  string;
  images:        { url: string; is_primary: boolean }[];
}

interface Props {
  store:           StoreData;
  initialProducts: ProductData[];
}

/* ── Helpers ── */
function getPrimary(p: ProductData) {
  return p.images.find((i) => i.is_primary)?.url ?? p.images[0]?.url ?? "";
}

/* ════════════════════════════════════════
   STORE PAGE
════════════════════════════════════════ */
export default function StorePage({ store, initialProducts }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [cartOpen,       setCartOpen]       = useState(false);
  const [mounted,        setMounted]        = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [viewProduct,    setViewProduct]    = useState<ProductData | null>(null);
  const [installPrompt,  setInstallPrompt]  = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const cartCount = useCartStore((s) => s.totalItems());
  const searchRef = useRef<HTMLInputElement>(null);

  const color = store.primary_color || "#2563EB";

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  useEffect(() => { setMounted(true); }, []);

  /* Capturar evento de instalación PWA */
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  /* Shrink header on scroll */
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Filtered products */
  const filtered = useMemo(() => {
    let items = initialProducts;
    if (activeCategory) items = items.filter((p) => p.category_id === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) ||
               p.description?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [initialProducts, activeCategory, search]);

  const featured = initialProducts.filter((p) => p.is_featured).slice(0, 5);
  const hasCategories = (store.categories?.length ?? 0) > 0;

  return (
    <div
      className="min-h-dvh"
      style={{ background: "#F8FAFC", fontFamily: "var(--font-dm)" }}
    >

      {/* ══════════════════════════════════
          STICKY HEADER
      ══════════════════════════════════ */}
      <header
        className="sticky top-0 z-30 transition-all duration-300"
        style={{
          background:   "rgba(255,255,255,.97)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${color}18`,
          boxShadow:    headerScrolled ? "0 2px 16px rgba(15,23,42,.08)" : "none",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
          {/* Logo / avatar */}
          <div className="flex-shrink-0">
            {store.logo_url ? (
              <Image
                src={store.logo_url}
                alt={store.name}
                width={38}
                height={38}
                className="rounded-[14px] object-cover"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-[14px] flex items-center justify-center
                           font-bold text-sm text-white"
                style={{ background: color }}
              >
                {store.name[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Store name */}
          <div className="flex-1 min-w-0">
            <h1
              className="font-display font-extrabold text-sm leading-tight truncate"
              style={{ color: "#0F172A" }}
            >
              {store.name}
            </h1>
            {store.city && !searchFocused && (
              <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#94A3B8" }}>
                <MapPin size={10} /> {store.city}
              </p>
            )}
          </div>

          {/* Share */}
          <button
            onClick={() => navigator.share?.({ title: store.name, url: location.href })}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: `${color}12` }}
            aria-label="Compartir tienda"
          >
            <Share2 size={16} style={{ color }} />
          </button>

          {/* Cart */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center
                       transition-all active:scale-90"
            style={{ background: color }}
            aria-label="Ver carrito"
          >
            <ShoppingCart size={17} color="white" />
            <AnimatePresence>
              {mounted && cartCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full
                             text-white text-[10px] font-extrabold flex items-center justify-center"
                  style={{ background: "#EF4444", border: "2px solid #fff" }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      {/* Banner de instalación PWA */}
      <AnimatePresence>
        {mounted && installPrompt && !installDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 max-w-xl mx-auto"
            style={{ background: `${color}10`, borderBottom: `1px solid ${color}18` }}
          >
            <span className="text-lg flex-shrink-0">📲</span>
            <p className="flex-1 text-xs font-medium" style={{ color: "#475569" }}>
              Instala la tienda para acceso rápido
            </p>
            <button
              onClick={handleInstall}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
              style={{ background: color }}
            >
              <Download size={11} />
              Instalar
            </button>
            <button onClick={() => setInstallDismissed(true)} aria-label="Cerrar">
              <X size={14} style={{ color: "#94A3B8" }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════
          HERO BANNER
      ══════════════════════════════════ */}
      {store.banner_url ? (
        <div className="relative h-44 overflow-hidden max-w-xl mx-auto">
          <Image
            src={store.banner_url}
            alt={store.name}
            fill
            className="object-cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, ${color}22 0%, rgba(15,23,42,.45) 100%)`,
            }}
          />
          {store.description && (
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
              <p className="text-white text-xs font-medium leading-snug line-clamp-2">
                {store.description}
              </p>
            </div>
          )}
        </div>
      ) : store.description ? (
        <div
          className="px-4 py-3 max-w-xl mx-auto"
          style={{ background: `${color}10`, borderBottom: `1px solid ${color}20` }}
        >
          <p className="text-xs leading-snug" style={{ color: "#475569" }}>
            {store.description}
          </p>
        </div>
      ) : null}

      {/* ══════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════ */}
      <div className="max-w-xl mx-auto">

        {/* Featured strip */}
        {featured.length > 0 && !search && (
          <section className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-1.5 mb-3">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: color }}
              >
                <Zap size={11} color="white" fill="white" />
              </div>
              <span
                className="text-xs font-extrabold uppercase tracking-widest"
                style={{ color }}
              >
                Destacados
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
              {featured.map((p) => (
                <div key={p.id} className="snap-start flex-shrink-0 w-44">
                  <ProductCard
                    product={p}
                    storeColor={color}
                    storeSlug={store.slug}
                    featured
                    onViewImages={p.images?.length > 0 ? () => setViewProduct(p) : undefined}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#94A3B8" }}
            />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar en la tienda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full text-sm rounded-2xl pl-10 pr-10 py-3 outline-none transition-all"
              style={{
                background:  "#F1F5F9",
                border:      `1.5px solid ${searchFocused ? color : "transparent"}`,
                boxShadow:   searchFocused ? `0 0 0 3px ${color}18` : "none",
                color:       "#0F172A",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {hasCategories && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className="flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold
                         transition-all border"
              style={
                !activeCategory
                  ? { background: color, color: "#fff", borderColor: color }
                  : { background: "#fff", color: "#64748B", borderColor: "#E2E8F0" }
              }
            >
              Todo
            </button>
            {store.categories!.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2
                           text-xs font-bold transition-all border"
                style={
                  activeCategory === cat.id
                    ? { background: color, color: "#fff", borderColor: color }
                    : { background: "#fff", color: "#64748B", borderColor: "#E2E8F0" }
                }
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Results header */}
        {(search || activeCategory) && (
          <div className="px-4 mb-2">
            <p className="text-xs font-semibold" style={{ color: "#94A3B8" }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              {search ? ` para "${search}"` : ""}
            </p>
          </div>
        )}

        {/* Product grid */}
        <main className="px-4 pb-36">
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-20 text-center"
              >
                <div className="text-5xl mb-4">🔍</div>
                <p className="font-display font-bold text-base mb-1" style={{ color: "#0F172A" }}>
                  Sin resultados
                </p>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Prueba con otro término o categoría
                </p>
                <button
                  onClick={() => { setSearch(""); setActiveCategory(null); }}
                  className="mt-4 text-xs font-bold px-4 py-2 rounded-full"
                  style={{ background: `${color}15`, color }}
                >
                  Ver todo
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeCategory + search}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3"
              >
                {filtered.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  >
                    <ProductCard
                      product={product}
                      storeColor={color}
                      storeSlug={store.slug}
                      onViewImages={product.images?.length > 0 ? () => setViewProduct(product) : undefined}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

      </div>{/* /max-w-xl */}

      {/* ══════════════════════════════════
          STICKY CART CTA
      ══════════════════════════════════ */}
      <AnimatePresence>
        {mounted && cartCount > 0 && (
          <motion.div
            key="cart-cta"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="fixed bottom-0 left-0 right-0 px-4 pb-safe pb-5 z-20 max-w-xl mx-auto"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between rounded-2xl px-5 py-4
                         text-white font-display font-bold text-sm transition-all
                         active:scale-[.98]"
              style={{
                background: color,
                boxShadow:  `0 8px 24px ${color}55`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-xl flex items-center justify-center
                             text-xs font-extrabold"
                  style={{ background: "rgba(255,255,255,.25)" }}
                >
                  {cartCount}
                </span>
                <span>Ver pedido</span>
              </div>
              <ChevronRight size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp floating button when cart empty */}
      <AnimatePresence>
        {mounted && cartCount === 0 && store.whatsapp && (
          <motion.a
            key="wa-btn"
            href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ delay: 1.5, type: "spring", stiffness: 300 }}
            className="fixed bottom-6 right-5 z-20 w-14 h-14 rounded-full
                       flex items-center justify-center text-white"
            style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,.5)" }}
            aria-label="Contactar por WhatsApp"
          >
            <MessageCircle size={26} fill="white" color="white" />
          </motion.a>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        store={store as any}
      />

      {/* Visor de imágenes del producto */}
      {viewProduct && viewProduct.images?.length > 0 && (
        <ProductImageViewer
          images={viewProduct.images}
          productName={viewProduct.name}
          onClose={() => setViewProduct(null)}
          storeColor={color}
        />
      )}
    </div>
  );
}

/* Tipo para el evento de instalación PWA (no incluido en lib.dom por defecto) */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
