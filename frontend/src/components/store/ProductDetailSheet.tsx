"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Check, ShoppingCart, ZoomIn, Share2, Clock, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, stripHtml } from "@/lib/utils";
import { useSaleCountdown } from "@/hooks/useSaleCountdown";
import toast from "react-hot-toast";
import ProductCard from "./ProductCard";
import { fetchProductViewers } from "@/lib/storeAnalytics";

/** Umbral para no mostrar numeros bajos que se sienten peor que no mostrar nada */
const VIEWERS_THRESHOLD = 3;

interface ProductForSheet {
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

interface Props {
  product: ProductForSheet;
  storeColor: string;
  storeSlug: string;
  onClose: () => void;
  /** Catálogo completo de la tienda, ya cargado en StorePage — sin fetch extra */
  allProducts?: ProductForSheet[];
  /** Navega el sheet a otro producto sin cerrarlo (tap en un cross-sell) */
  onSelectRelated?: (product: ProductForSheet) => void;
  onOpenCart?: () => void;
}

const RELATED_LIMIT = 4;

/** Misma categoría primero; si faltan, completa con otros productos de la tienda.
 *  Nunca inventa relación — solo reordena lo que ya existe en el catálogo. */
function getRelatedProducts(current: ProductForSheet, all: ProductForSheet[]): ProductForSheet[] {
  const others = all.filter((p) => p.id !== current.id);
  const sameCategory = current.category_id
    ? others.filter((p) => p.category_id === current.category_id)
    : [];
  const rest = others.filter((p) => !sameCategory.includes(p));
  return [...sameCategory, ...rest].slice(0, RELATED_LIMIT);
}

function isHTML(str?: string) {
  return !!str?.trim().startsWith("<");
}

export default function ProductDetailSheet({
  product, storeColor, storeSlug, onClose, allProducts, onSelectRelated, onOpenCart,
}: Props) {
  const [current, setCurrent] = useState(
    () => Math.max(0, product.images.findIndex((i) => i.is_primary))
  );
  const [added, setAdded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [qty, setQty] = useState(1);
  const touchStartX = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);

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

  const related = useMemo(
    () => (allProducts ? getRelatedProducts(product, allProducts) : []),
    [product, allProducts]
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setViewers(0);
    fetchProductViewers(storeSlug, product.id).then((n) => {
      if (!cancelled) setViewers(n);
    });
    return () => { cancelled = true; };
  }, [storeSlug, product.id]);

  // Al saltar a un producto relacionado el sheet no se desmonta (misma
  // instancia) — hay que resetear la galería e ítems de estado por producto.
  useEffect(() => {
    setCurrent(Math.max(0, product.images.findIndex((i) => i.is_primary)));
    setZoomOpen(false);
    setAdded(false);
    setQty(1);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [product.id]);

  function prev() { setCurrent((c) => Math.max(0, c - 1)); }
  function next() { setCurrent((c) => Math.min(product.images.length - 1, c + 1)); }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50) next();
    else if (delta < -50) prev();
  }

  function handleAdd() {
    if (outOfStock) return;
    addItem(
      { id: product.id, name: displayName, price_cents: product.price_cents,
        image_url: primaryImage, quantity: qty },
      storeSlug,
      qty,
    );
    setAdded(true);
    toast.success(qty > 1 ? `${qty} agregados al carrito` : "Agregado al carrito", { duration: 1500 });
    setTimeout(() => setAdded(false), 2000);
    setQty(1);
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[59]"
        style={{ background: "rgba(20,19,15,.55)" }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col max-w-xl mx-auto rounded-t-[24px] lg:inset-0 lg:bottom-auto lg:m-auto lg:h-fit lg:max-w-[520px] lg:rounded-[24px]"
        style={{
          background:    "var(--surface)",
          maxHeight:     "90dvh",
          boxShadow:     "0 -8px 48px rgba(20,19,15,.22)",
          overflow:      "hidden",
        }}
      >
        {/* ── Galería de imágenes ── */}
        <div
          className="relative w-full flex-shrink-0"
          style={{ height: 280, background: "var(--surface-2)" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {hasImages ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <Image
                  src={product.images[current].url}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="576px"
                  priority
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex items-center justify-center h-full text-6xl select-none">🛍️</div>
          )}

          {/* Flechas de navegación */}
          {product.images.length > 1 && (
            <>
              <button
                onClick={prev}
                disabled={current === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full
                           flex items-center justify-center disabled:opacity-20 transition-opacity"
                style={{ background: "rgba(0,0,0,.38)" }}
              >
                <ChevronLeft size={20} color="white" />
              </button>
              <button
                onClick={next}
                disabled={current === product.images.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full
                           flex items-center justify-center disabled:opacity-20 transition-opacity"
                style={{ background: "rgba(0,0,0,.38)" }}
              >
                <ChevronRight size={20} color="white" />
              </button>
            </>
          )}

          {/* Indicadores de puntos */}
          {product.images.length > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {product.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className="rounded-full transition-all"
                  style={{
                    width:      i === current ? 18 : 6,
                    height:     6,
                    background: i === current ? storeColor : "rgba(255,255,255,.65)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Badge de descuento */}
          {discount && (
            <span
              className="absolute top-3 left-3 z-10 text-white text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "var(--danger)" }}
            >
              -{discount}%
            </span>
          )}

          {/* Countdown real de oferta — solo si el vendedor definió fecha de fin */}
          {countdown && (
            <span
              className="absolute bottom-3 left-3 z-10 flex items-center gap-1 text-white text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "var(--warn)" }}
            >
              <Clock size={12} /> Termina en {countdown}
            </span>
          )}

          {/* Botón zoom */}
          {hasImages && (
            <button
              onClick={() => setZoomOpen(true)}
              className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,.48)" }}
              aria-label="Ver imagen completa"
            >
              <ZoomIn size={16} color="white" />
            </button>
          )}

          {/* Botón compartir */}
          {hasImages && (
            <button
              onClick={() => {
                const url = `${location.origin}/tienda/${storeSlug}?p=${product.id}`;
                if (navigator.share) {
                  navigator.share({ title: displayName, text: `Mira ${displayName}`, url });
                } else {
                  navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"));
                }
              }}
              className="absolute top-3 z-10 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(20,19,15,.48)", left: 52 }}
              aria-label="Compartir producto"
            >
              <Share2 size={15} color="white" />
            </button>
          )}

          {/* Botón cerrar */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(15,23,42,.48)" }}
            aria-label="Cerrar"
          >
            <X size={16} color="white" />
          </button>
        </div>

        {/* ── Contenido scrollable ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 pt-4 pb-28">

            {/* Nombre */}
            <h2
              className="font-display font-extrabold text-xl leading-tight"
              style={{ color: "var(--ink)" }}
            >
              {displayName}
            </h2>

            {/* Precio */}
            <div className="flex items-baseline gap-3 mt-2">
              <span
                className="font-display font-extrabold text-2xl"
                style={{ color: storeColor }}
              >
                {formatPrice(product.price_cents)}
              </span>
              {product.compare_price && (
                <span className="text-sm line-through" style={{ color: "var(--ink-4)" }}>
                  {formatPrice(product.compare_price)}
                </span>
              )}
              {discount && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                >
                  {discount}% OFF
                </span>
              )}
            </div>

            {/* Personas viendo esto ahora — solo si supera el umbral, nunca "1 viendo" */}
            {viewers >= VIEWERS_THRESHOLD && (
              <p className="text-xs font-bold mt-2" style={{ color: "var(--accent-ink)" }}>
                🔥 {viewers} personas viendo esto ahora
              </p>
            )}

            {/* Agotado */}
            {outOfStock && (
              <span
                className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                Agotado
              </span>
            )}

            {/* Stock bajo */}
            {lowStock && (
              <p className="text-xs font-bold mt-2" style={{ color: "var(--warn)" }}>
                ⚡ Quedan solo {product.stock} unidades
              </p>
            )}

            {/* Miniaturas de otras imágenes */}
            {product.images.length > 1 && (
              <div className="flex gap-2 mt-4">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all"
                    style={{
                      border:   `2px solid ${i === current ? storeColor : "var(--line-2)"}`,
                      opacity:  i === current ? 1 : 0.6,
                    }}
                  >
                    <Image src={img.url} alt="" fill className="object-cover" sizes="56px" />
                  </button>
                ))}
              </div>
            )}

            {/* Descripción */}
            {hasDescription && (
              <div className="mt-5">
                <p
                  className="text-[11px] font-bold uppercase tracking-wider mb-2.5"
                  style={{ color: "var(--ink-3)" }}
                >
                  Descripción
                </p>
                {isHTML(product.description) ? (
                  <div
                    className="product-description"
                    dangerouslySetInnerHTML={{ __html: product.description! }}
                  />
                ) : (
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {product.description}
                  </p>
                )}
              </div>
            )}

            {/* Cross-sell: mismo catálogo, sin datos inventados */}
            {related.length > 0 && (
              <div className="mt-6">
                <p
                  className="text-[11px] font-bold uppercase tracking-wider mb-2.5"
                  style={{ color: "var(--ink-3)" }}
                >
                  Otros también compraron
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide">
                  {related.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      storeColor={storeColor}
                      storeSlug={storeSlug}
                      featured
                      onTap={() => onSelectRelated?.(p)}
                      onOpenCart={onOpenCart}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Cantidad + agregar al carrito (fijo al fondo del sheet) ── */}
        <div
          className="absolute bottom-0 left-0 right-0 px-5 pt-3 pb-safe pb-5"
          style={{
            background: "color-mix(in srgb, var(--surface) 97%, transparent)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div className="flex items-center gap-2.5">
            {!outOfStock && (
              <div
                className="flex items-center gap-0.5 rounded-2xl flex-shrink-0"
                style={{ background: "var(--surface-2)", height: 52 }}
              >
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Restar cantidad"
                  className="w-10 h-full flex items-center justify-center disabled:opacity-30"
                >
                  <Minus size={15} style={{ color: "var(--ink-2)" }} />
                </button>
                <span className="w-6 text-center font-bold text-sm" style={{ color: "var(--ink)" }}>
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={qty >= maxQty}
                  aria-label="Sumar cantidad"
                  className="w-10 h-full flex items-center justify-center disabled:opacity-30"
                >
                  <Plus size={15} style={{ color: "var(--ink-2)" }} />
                </button>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAdd}
              disabled={outOfStock}
              className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl py-4
                         font-display font-bold text-sm transition-colors"
              style={{
                background: outOfStock ? "var(--line-2)" : storeColor,
                color:      outOfStock ? "var(--ink-3)" : "white",
                boxShadow:  outOfStock ? "none" : `0 6px 20px ${storeColor}44`,
              }}
            >
              {added ? (
                <><Check size={18} /> En el carrito</>
              ) : outOfStock ? (
                "Producto agotado"
              ) : (
                <><ShoppingCart size={18} /> Agregar · {formatPrice(product.price_cents * qty)}</>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
      {/* Lightbox de imagen completa */}
      {zoomOpen && hasImages && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,.95)" }}
          onClick={() => setZoomOpen(false)}
        >
          <img
            src={product.images[current].url}
            alt={displayName}
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: "90dvh" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,.15)" }}
            aria-label="Cerrar"
          >
            <X size={20} color="white" />
          </button>
        </motion.div>
      )}
    </>
  );
}
