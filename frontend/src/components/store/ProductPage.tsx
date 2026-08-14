"use client";

// Página completa de producto — complementa el sheet rápido (ProductDetailSheet)
// que se sigue usando desde la grilla del catálogo para vista instantánea.
// Esta página es para cuando el vendedor quiere meter mucho detalle (fotos,
// descripción larga con HTML/tablas, etc.) o para un link compartido/indexado
// por Google, donde una página real de verdad es mejor que un modal.

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronLeft as ChevronLeftSmall, ChevronRight, Check, ShoppingCart,
  ZoomIn, Share2, Clock, Minus, Plus, X, ShoppingBag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, stripHtml, getStoreCurrency } from "@/lib/utils";
import { useSaleCountdown } from "@/hooks/useSaleCountdown";
import { fetchProductViewers, trackStoreEvent } from "@/lib/storeAnalytics";
import { pixelAddToCart, pixelViewContent } from "@/lib/marketingPixels";
import ProductCard from "./ProductCard";

const VIEWERS_THRESHOLD = 3;
const RELATED_LIMIT = 4;

interface FullProduct {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  compare_price?: number;
  sale_ends_at?: string;
  stock?: number;
  category_id?: string;
  sold_count?: number;
  created_at?: string;
  images: { url: string; is_primary: boolean }[];
}

interface StoreLite {
  slug: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  country?: string;
  currency?: string;
}

function isHTML(str?: string) {
  return !!str?.trim().startsWith("<");
}

function getRelatedProducts(current: FullProduct, all: FullProduct[]): FullProduct[] {
  const others = all.filter((p) => p.id !== current.id);
  const sameCategory = current.category_id
    ? others.filter((p) => p.category_id === current.category_id)
    : [];
  const rest = others.filter((p) => !sameCategory.includes(p));
  return [...sameCategory, ...rest].slice(0, RELATED_LIMIT);
}

export default function ProductPage({
  store, product, allProducts,
}: { store: StoreLite; product: FullProduct; allProducts: FullProduct[] }) {
  const router = useRouter();
  const color = store.primary_color || "#2563EB";
  const { code: storeCurrency, locale: storeLocale } = getStoreCurrency(store);
  const addItem = useCartStore((s) => s.addItem);
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  const [current, setCurrent] = useState(
    () => Math.max(0, product.images.findIndex((i) => i.is_primary))
  );
  const [added, setAdded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [qty, setQty] = useState(1);
  const touchStartX = useRef(0);

  const primaryImage =
    product.images.find((i) => i.is_primary)?.url ?? product.images[0]?.url ?? "";
  const outOfStock =
    product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const lowStock =
    product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= 3;
  const discount = product.compare_price
    ? Math.round((1 - product.price_cents / product.compare_price) * 100)
    : null;
  const maxQty = product.stock && product.stock > 0 ? product.stock : 99;
  const countdown = useSaleCountdown(product.sale_ends_at);
  const hasImages = product.images.length > 0;
  const hasDescription = !!product.description?.trim();
  const displayName = stripHtml(product.name);

  const related = useMemo(() => getRelatedProducts(product, allProducts), [product, allProducts]);

  useEffect(() => {
    trackStoreEvent(store.slug, "product_view", product.id);
    pixelViewContent({ id: product.id, name: displayName, price_cents: product.price_cents }, storeCurrency);
    let cancelled = false;
    fetchProductViewers(store.slug, product.id).then((n) => { if (!cancelled) setViewers(n); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  function prev() { setCurrent((c) => Math.max(0, c - 1)); }
  function next() { setCurrent((c) => Math.min(product.images.length - 1, c + 1)); }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50) next();
    else if (delta < -50) prev();
  }

  function handleAdd() {
    if (outOfStock) return;
    addItem(
      { id: product.id, name: displayName, price_cents: product.price_cents, image_url: primaryImage, quantity: qty },
      store.slug,
      qty,
    );
    setAdded(true);
    const cartItems = useCartStore.getState().items.map((i) => ({
      product_id: i.id, name: i.name, qty: i.quantity, price_cents: i.price_cents,
    }));
    trackStoreEvent(store.slug, "add_to_cart", product.id, { cart_items: cartItems });
    pixelAddToCart({ id: product.id, name: displayName, price_cents: product.price_cents }, qty, storeCurrency);
    toast.custom(
      (t) => (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "var(--ink)", color: "var(--bg)", boxShadow: "var(--shadow-md)", opacity: t.visible ? 1 : 0 }}
        >
          <span className="text-sm font-semibold">{qty > 1 ? `${qty} agregados` : "Agregado"} al carrito</span>
          <button
            onClick={() => { toast.dismiss(t.id); router.push("/catalogo"); }}
            className="text-sm font-bold underline flex-shrink-0"
          >
            Ver carrito
          </button>
        </div>
      ),
      { duration: 2500 }
    );
    setTimeout(() => setAdded(false), 2000);
    setQty(1);
  }

  function handleShare() {
    const url = `${location.origin}/producto/${product.id}`;
    if (navigator.share) {
      navigator.share({ title: displayName, text: `Mira ${displayName}`, url });
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"));
    }
  }

  return (
    <div className="min-h-dvh pb-28" style={{ background: "var(--bg)" }}>
      {/* Barra superior */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{
          background: "color-mix(in srgb, var(--surface) 97%, transparent)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <a href="/catalogo" className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}12` }} aria-label="Volver al catálogo">
          <ChevronLeft size={18} style={{ color }} />
        </a>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {store.logo_url ? (
            <Image src={store.logo_url} alt={store.name} width={24} height={24} className="rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0" style={{ background: color }}>
              {store.name[0]?.toUpperCase()}
            </div>
          )}
          <p className="text-xs font-bold truncate" style={{ color: "var(--ink-2)" }}>{store.name}</p>
        </div>
        <a href="/catalogo" className="relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color }} aria-label="Ver carrito">
          <ShoppingBag size={16} color="#fff" />
          {cartCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center"
              style={{ background: "var(--danger)", border: "2px solid var(--surface)" }}
            >
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </a>
      </div>

      <div className="max-w-xl lg:max-w-4xl mx-auto lg:grid lg:grid-cols-2 lg:gap-8 lg:pt-6 lg:px-8">
        {/* ── Galería ── */}
        <div>
          <div
            className="relative w-full lg:rounded-2xl lg:overflow-hidden"
            style={{ height: 360, background: "var(--surface-2)" }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {hasImages ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0"
                >
                  <Image src={product.images[current].url} alt={displayName} fill className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" priority />
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex items-center justify-center h-full"><ShoppingBag size={48} style={{ color: "var(--ink-4)" }} /></div>
            )}

            {product.images.length > 1 && (
              <>
                <button onClick={prev} disabled={current === 0} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20" style={{ background: "rgba(0,0,0,.38)" }}>
                  <ChevronLeftSmall size={20} color="white" />
                </button>
                <button onClick={next} disabled={current === product.images.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20" style={{ background: "rgba(0,0,0,.38)" }}>
                  <ChevronRight size={20} color="white" />
                </button>
              </>
            )}

            {discount && (
              <span className="absolute top-3 left-3 z-10 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--danger)" }}>-{discount}%</span>
            )}
            {countdown && (
              <span className="absolute bottom-3 left-3 z-10 flex items-center gap-1 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--warn)" }}>
                <Clock size={12} /> Termina en {countdown}
              </span>
            )}
            {hasImages && (
              <button onClick={() => setZoomOpen(true)} className="absolute top-3 right-14 z-10 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(15,23,42,.48)" }} aria-label="Ver imagen completa">
                <ZoomIn size={16} color="white" />
              </button>
            )}
            {hasImages && (
              <button onClick={handleShare} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(20,19,15,.48)" }} aria-label="Compartir producto">
                <Share2 size={15} color="white" />
              </button>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3 px-4 lg:px-0">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
                  style={{ border: `2px solid ${i === current ? color : "var(--line-2)"}`, opacity: i === current ? 1 : 0.6 }}
                >
                  <Image src={img.url} alt="" fill className="object-cover" sizes="56px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="px-4 pt-5 lg:px-0 lg:pt-0">
          <h1 className="font-display font-extrabold text-2xl leading-tight" style={{ color: "var(--ink)" }}>
            {displayName}
          </h1>

          <div className="flex items-baseline gap-3 mt-2">
            <span className="font-display font-extrabold text-3xl" style={{ color }}>
              {formatPrice(product.price_cents, storeCurrency, storeLocale)}
            </span>
            {product.compare_price && (
              <span className="text-base line-through" style={{ color: "var(--ink-4)" }}>
                {formatPrice(product.compare_price, storeCurrency, storeLocale)}
              </span>
            )}
            {discount && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                {discount}% OFF
              </span>
            )}
          </div>

          {viewers >= VIEWERS_THRESHOLD && (
            <p className="text-xs font-bold mt-2" style={{ color: "var(--accent-ink)" }}>🔥 {viewers} personas viendo esto ahora</p>
          )}
          {outOfStock && (
            <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>Agotado</span>
          )}
          {lowStock && (
            <p className="text-xs font-bold mt-2" style={{ color: "var(--warn)" }}>⚡ Quedan solo {product.stock} unidades</p>
          )}

          {hasDescription && (
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--ink-3)" }}>Descripción</p>
              {isHTML(product.description) ? (
                <div className="product-description" dangerouslySetInnerHTML={{ __html: product.description! }} />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>{product.description}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="max-w-xl lg:max-w-4xl mx-auto mt-8 lg:px-8">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5 px-4 lg:px-0" style={{ color: "var(--ink-3)" }}>Otros también compraron</p>
          <div className="flex gap-3 overflow-x-auto pb-1 px-4 lg:px-0 snap-x snap-mandatory scrollbar-hide">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                storeColor={color}
                storeSlug={store.slug}
                storeCurrency={storeCurrency}
                storeLocale={storeLocale}
                featured
                onTap={() => router.push(`/producto/${p.id}`)}
                onOpenCart={() => router.push("/catalogo")}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Cantidad + agregar al carrito (fijo abajo) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-safe pb-4"
        style={{ background: "color-mix(in srgb, var(--surface) 97%, transparent)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--line)" }}
      >
        <div className="max-w-xl lg:max-w-4xl mx-auto flex items-center gap-2.5">
          {!outOfStock && (
            <div className="flex items-center gap-0.5 rounded-2xl flex-shrink-0" style={{ background: "var(--surface-2)", height: 52 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Restar cantidad" className="w-10 h-full flex items-center justify-center disabled:opacity-30">
                <Minus size={15} style={{ color: "var(--ink-2)" }} />
              </button>
              <span className="w-6 text-center font-bold text-sm" style={{ color: "var(--ink)" }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Sumar cantidad" className="w-10 h-full flex items-center justify-center disabled:opacity-30">
                <Plus size={15} style={{ color: "var(--ink-2)" }} />
              </button>
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl py-4 font-display font-bold text-sm transition-colors"
            style={{ background: outOfStock ? "var(--line-2)" : color, color: outOfStock ? "var(--ink-3)" : "white", boxShadow: outOfStock ? "none" : `0 6px 20px ${color}44` }}
          >
            {added ? (<><Check size={18} /> En el carrito</>) : outOfStock ? "Producto agotado" : (<><ShoppingCart size={18} /> Agregar · {formatPrice(product.price_cents * qty, storeCurrency, storeLocale)}</>)}
          </motion.button>
        </div>
      </div>

      {/* Lightbox */}
      {zoomOpen && hasImages && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,.95)" }}
          onClick={() => setZoomOpen(false)}
        >
          <img src={product.images[current].url} alt={displayName} className="max-w-full max-h-full object-contain" style={{ maxHeight: "90dvh" }} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setZoomOpen(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.15)" }} aria-label="Cerrar">
            <X size={20} color="white" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
