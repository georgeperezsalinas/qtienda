"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Check, ShoppingCart, ZoomIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, stripHtml } from "@/lib/utils";
import toast from "react-hot-toast";

interface ProductForSheet {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  compare_price?: number;
  stock?: number;
  images: { url: string; is_primary: boolean }[];
}

interface Props {
  product: ProductForSheet;
  storeColor: string;
  storeSlug: string;
  onClose: () => void;
}

function isHTML(str?: string) {
  return !!str?.trim().startsWith("<");
}

export default function ProductDetailSheet({
  product, storeColor, storeSlug, onClose,
}: Props) {
  const [current, setCurrent] = useState(
    () => Math.max(0, product.images.findIndex((i) => i.is_primary))
  );
  const [added, setAdded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchStartX = useRef(0);
  const addItem = useCartStore((s) => s.addItem);

  const primaryImage =
    product.images.find((i) => i.is_primary)?.url ?? product.images[0]?.url ?? "";
  const outOfStock =
    product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const discount = product.compare_price
    ? Math.round((1 - product.price_cents / product.compare_price) * 100)
    : null;
  const hasImages = product.images.length > 0;
  const hasDescription = !!product.description?.trim();
  const displayName = stripHtml(product.name);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
        image_url: primaryImage, quantity: 1 },
      storeSlug,
    );
    setAdded(true);
    toast.success("Agregado al carrito", { duration: 1500 });
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[59]"
        style={{ background: "rgba(15,23,42,.55)" }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col max-w-xl mx-auto"
        style={{
          background:    "#fff",
          borderRadius:  "24px 24px 0 0",
          maxHeight:     "92dvh",
          boxShadow:     "0 -8px 48px rgba(15,23,42,.22)",
          overflow:      "hidden",
        }}
      >
        {/* ── Galería de imágenes ── */}
        <div
          className="relative w-full flex-shrink-0"
          style={{ height: 280, background: "#F8FAFC" }}
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
              style={{ background: "#EF4444" }}
            >
              -{discount}%
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
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 pt-4 pb-28">

            {/* Nombre */}
            <h2
              className="font-display font-extrabold text-xl leading-tight"
              style={{ color: "#0F172A" }}
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
                <span className="text-sm line-through" style={{ color: "#94A3B8" }}>
                  {formatPrice(product.compare_price)}
                </span>
              )}
              {discount && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#FEE2E2", color: "#B91C1C" }}
                >
                  {discount}% OFF
                </span>
              )}
            </div>

            {/* Agotado */}
            {outOfStock && (
              <span
                className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: "#FEE2E2", color: "#991B1B" }}
              >
                Agotado
              </span>
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
                      border:   `2px solid ${i === current ? storeColor : "#E2E8F0"}`,
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
                  style={{ color: "#94A3B8" }}
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
                    style={{ color: "#475569" }}
                  >
                    {product.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Botón agregar al carrito (fijo al fondo del sheet) ── */}
        <div
          className="absolute bottom-0 left-0 right-0 px-5 pt-3 pb-safe pb-5"
          style={{
            background: "rgba(255,255,255,.97)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            disabled={outOfStock}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4
                       font-display font-bold text-sm transition-colors"
            style={{
              background: outOfStock ? "#E2E8F0" : storeColor,
              color:      outOfStock ? "#94A3B8" : "white",
              boxShadow:  outOfStock ? "none" : `0 6px 20px ${storeColor}44`,
            }}
          >
            {added ? (
              <><Check size={18} /> En el carrito</>
            ) : outOfStock ? (
              "Producto agotado"
            ) : (
              <><ShoppingCart size={18} /> Agregar · {formatPrice(product.price_cents)}</>
            )}
          </motion.button>
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
