"use client";

import Image from "next/image";
import { Plus, Check, Images, Heart, Clock, Package } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { formatPrice, stripHtml } from "@/lib/utils";
import { trackStoreEvent } from "@/lib/storeAnalytics";
import { pixelAddToCart } from "@/lib/marketingPixels";
import { useSaleCountdown } from "@/hooks/useSaleCountdown";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

interface Props {
  product: {
    id: string;
    name: string;
    description?: string;
    price_cents: number;
    compare_price?: number;
    sale_ends_at?: string;
    stock?: number;
    sold_count?: number;
    created_at?: string;
    images: { url: string; is_primary: boolean }[];
    variants?: { id: string; label: string; sku?: string; price_cents?: number; stock?: number }[];
  };
  storeColor: string;
  storeSlug: string;
  storeCurrency?: string;
  storeLocale?: string;
  featured?: boolean;
  compact?: boolean;   // list-view mode
  onTap?: () => void;
  onOpenCart?: () => void;
}

const NEW_PRODUCT_DAYS = 14;

/* Imagen con skeleton: shimmer mientras carga, fade-in al terminar.
   `sizes` es obligatorio con `fill` — sin él, Next pide siempre la versión
   a ancho completo de pantalla aunque la tarjeta ocupe una fracción chica
   de la grilla (2-4 columnas), desperdiciando datos en conexiones móviles. */
function CardImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-cover transition-all duration-300 group-hover:scale-[1.04] ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: "linear-gradient(110deg, var(--surface-2) 40%, var(--tint) 50%, var(--surface-2) 60%)" }}
        />
      )}
    </>
  );
}

export default function ProductCard({
  product, storeColor, storeSlug, storeCurrency = "PEN", storeLocale = "es-PE", featured, compact, onTap, onOpenCart,
}: Props) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const isFavorite = useFavoritesStore((s) => s.isFavorite(storeSlug, product.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const countdown = useSaleCountdown(product.sale_ends_at);

  function handleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    toggleFavorite(storeSlug, product.id);
  }

  const favoriteButton = (
    <button
      onClick={handleFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center z-10"
      style={{ background: "rgba(255,255,255,.85)" }}
    >
      <Heart size={14} fill={isFavorite ? "var(--danger)" : "none"} style={{ color: isFavorite ? "var(--danger)" : "var(--ink-3)" }} />
    </button>
  );

  const primaryImage =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;

  const hasVariants = (product.variants?.length ?? 0) > 0;
  const outOfStock =
    product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const lowStock =
    product.stock !== null && product.stock !== undefined && product.stock > 0 && product.stock <= 3;
  const discount = product.compare_price
    ? Math.round((1 - product.price_cents / product.compare_price) * 100)
    : null;
  const multipleImages = (product.images?.length ?? 0) > 1;
  const displayName = stripHtml(product.name);
  const displayDesc = stripHtml(product.description);

  const soldCount = product.sold_count ?? 0;
  const isNew =
    soldCount < 2 &&
    !!product.created_at &&
    Date.now() - new Date(product.created_at).getTime() < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;

  const socialBadge =
    soldCount >= 2 ? (
      <span className="text-[10px] lg:text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--warn)" }}>
        🔥 {soldCount} vendidos
      </span>
    ) : isNew ? (
      <span
        className="text-[9px] lg:text-[10px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: "var(--success-soft)", color: "var(--success)" }}
      >
        NUEVO
      </span>
    ) : null;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (outOfStock) return;
    addItem(
      { id: product.id, name: displayName, price_cents: product.price_cents,
        image_url: primaryImage || "", quantity: 1 },
      storeSlug,
    );
    setAdded(true);
    // Snapshot del carrito actualizado — alimenta la recuperación de
    // carrito abandonado en el backend, sin tracking nuevo del lado cliente.
    const cartItems = useCartStore.getState().items.map((i) => ({
      product_id: i.id, name: i.name, qty: i.quantity, price_cents: i.price_cents,
    }));
    trackStoreEvent(storeSlug, "add_to_cart", product.id, { cart_items: cartItems });
    pixelAddToCart(product, 1);
    toast.custom(
      (t) => (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: "var(--ink)", color: "var(--bg)", boxShadow: "var(--shadow-md)", opacity: t.visible ? 1 : 0 }}
        >
          <span className="text-sm font-semibold">Agregado — sigue comprando</span>
          <button
            onClick={() => { toast.dismiss(t.id); onOpenCart?.(); }}
            className="text-sm font-bold underline flex-shrink-0"
          >
            Ver carrito
          </button>
        </div>
      ),
      { duration: 2000 }
    );
    setTimeout(() => setAdded(false), 2000);
  }

  // Con variantes, el botón de "agregar rápido" no alcanza — el comprador
  // tiene que elegir cuál antes de sumarla al carrito, así que abre el
  // detalle en vez de agregar directo (mismo destino que tocar la tarjeta).
  function handleAddClick(e: React.MouseEvent) {
    if (hasVariants) {
      e.stopPropagation();
      onTap?.();
      return;
    }
    handleAdd(e);
  }

  /* ── Featured card (horizontal carousel) ── */
  if (featured) {
    return (
      <div
        className="flex-shrink-0 w-36 md:w-56 lg:w-64 snap-start cursor-pointer group"
        onClick={onTap}
      >
        <div
          className="rounded-2xl overflow-hidden transition-shadow lg:hover:shadow-lg"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-md), 0 0 0 1px var(--line)" }}
        >
          {/* Más baja en celular (antes h-40=160px) — Destacados + Comprar de
              nuevo juntos ocupaban casi toda la pantalla antes de llegar al
              catálogo real. Desktop queda igual, ahí sobra espacio. */}
          <div className="relative h-28 md:h-40 lg:h-48" style={{ background: "var(--surface-2)" }}>
            {favoriteButton}
            {primaryImage ? (
              <CardImage
                src={primaryImage}
                alt={displayName}
                sizes="(min-width: 1024px) 256px, (min-width: 768px) 224px, 144px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Package size={28} style={{ color: "var(--ink-4)" }} /></div>
            )}
            {discount && (
              <span
                className="absolute top-2 left-2 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-full"
                style={{ background: "var(--danger)" }}
              >
                -{discount}%
              </span>
            )}
            {countdown && (
              <span
                className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                style={{ background: "var(--warn)" }}
              >
                <Clock size={9} /> {countdown}
              </span>
            )}
            {multipleImages && primaryImage && (
              <span
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full
                           px-1.5 py-0.5 text-white text-[10px] font-semibold"
                style={{ background: "rgba(0,0,0,.5)" }}
              >
                <Images size={10} />
                {product.images.length}
              </span>
            )}
            {outOfStock && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.75)" }}>
                <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ color: "var(--ink-2)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
                  Agotado
                </span>
              </div>
            )}
          </div>
          <div className="p-2.5 lg:p-4">
            <p className="font-semibold text-xs md:text-sm lg:text-[15px] leading-tight line-clamp-2" style={{ color: "var(--ink)" }}>
              {displayName}
            </p>
            {socialBadge && <div className="mt-1">{socialBadge}</div>}
            <div className="flex items-center justify-between mt-2">
              <div>
                <span className="font-extrabold text-sm lg:text-base" style={{ color: storeColor }}>
                  {formatPrice(product.price_cents, storeCurrency, storeLocale)}
                </span>
                {product.compare_price && (
                  <span className="block text-[11px] line-through" style={{ color: "var(--ink-4)" }}>
                    {formatPrice(product.compare_price, storeCurrency, storeLocale)}
                  </span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleAddClick}
                disabled={outOfStock}
                className="w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-white"
                style={{ background: outOfStock ? "var(--ink-4)" : storeColor }}
              >
                {added ? <Check size={14} /> : <Plus size={14} />}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Compact / list-view card ── */
  if (compact) {
    return (
      <div
        className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 rounded-2xl transition-all active:scale-[.99] lg:hover:shadow-md cursor-pointer h-full"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-sm)",
        }}
        onClick={onTap}
      >
        {/* Image */}
        <div className="relative w-[76px] h-[76px] lg:w-[92px] lg:h-[92px] rounded-xl overflow-hidden flex-shrink-0" style={{ background: "var(--surface-2)" }}>
          {favoriteButton}
          {primaryImage ? (
            <CardImage
              src={primaryImage}
              alt={displayName}
              sizes="(min-width: 1024px) 92px, 76px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Package size={22} style={{ color: "var(--ink-4)" }} /></div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.75)" }}>
              <span className="text-[9px] font-bold" style={{ color: "var(--ink-4)" }}>Agotado</span>
            </div>
          )}
          {multipleImages && primaryImage && (
            <span
              className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full
                         px-1 py-0.5 text-white text-[9px] font-semibold"
              style={{ background: "rgba(0,0,0,.45)" }}
            >
              <Images size={8} />
              {product.images.length}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm lg:text-[15px] font-bold leading-snug line-clamp-2" style={{ color: "var(--ink)" }}>
            {displayName}
          </p>
          {product.description && (
            <p className="text-xs mt-0.5 line-clamp-1 lg:line-clamp-2" style={{ color: "var(--ink-3)" }}>
              {displayDesc}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-extrabold text-sm lg:text-base" style={{ color: storeColor }}>
              {formatPrice(product.price_cents, storeCurrency, storeLocale)}
            </span>
            {discount && (
              <span
                className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--danger)" }}
              >
                -{discount}%
              </span>
            )}
            {product.compare_price && (
              <span className="text-xs line-through" style={{ color: "var(--ink-4)" }}>
                {formatPrice(product.compare_price, storeCurrency, storeLocale)}
              </span>
            )}
            {countdown && (
              <span
                className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
              >
                <Clock size={9} /> {countdown}
              </span>
            )}
            {socialBadge}
          </div>
        </div>

        {/* Add to cart */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleAddClick}
          disabled={outOfStock}
          className="flex-shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-white transition-colors"
          style={{ background: outOfStock ? "var(--ink-4)" : storeColor }}
        >
          {added ? <Check size={16} /> : <Plus size={16} />}
        </motion.button>
      </div>
    );
  }

  /* ── Grid card (default) ── */
  return (
    <div
      className="group rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all active:scale-[.98] lg:hover:-translate-y-1 lg:hover:shadow-lg"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow-md), 0 0 0 1px var(--line)",
      }}
      onClick={onTap}
    >
      <div className="relative aspect-square" style={{ background: "var(--surface-2)" }}>
        {favoriteButton}
        {primaryImage ? (
          <CardImage
            src={primaryImage}
            alt={displayName}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package size={36} style={{ color: "var(--ink-4)" }} /></div>
        )}
        {discount && (
          <span
            className="absolute top-2 left-2 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-full"
            style={{ background: "var(--danger)" }}
          >
            -{discount}%
          </span>
        )}
        {countdown && (
          <span
            className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
            style={{ background: "var(--warn)" }}
          >
            <Clock size={9} /> {countdown}
          </span>
        )}
        {multipleImages && primaryImage && (
          <span
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full
                       px-2 py-0.5 text-white text-xs font-semibold"
            style={{ background: "rgba(0,0,0,.5)" }}
          >
            <Images size={11} />
            {product.images.length}
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.7)" }}>
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ color: "var(--ink-2)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
              Agotado
            </span>
          </div>
        )}
      </div>
      <div className="p-3 lg:p-4 flex flex-col flex-1">
        <p className="text-sm lg:text-[15px] font-semibold leading-tight line-clamp-2 flex-1" style={{ color: "var(--ink)" }}>
          {displayName}
        </p>
        {socialBadge && <div className="mt-1">{socialBadge}</div>}
        {lowStock && (
          <p className="text-[10px] lg:text-[11px] font-bold mt-1" style={{ color: "var(--warn)" }}>
            ¡Quedan {product.stock}!
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-1">
          <div>
            <span className="font-extrabold text-base lg:text-lg" style={{ color: storeColor }}>
              {formatPrice(product.price_cents, storeCurrency, storeLocale)}
            </span>
            {product.compare_price && (
              <span className="block text-xs line-through" style={{ color: "var(--ink-4)" }}>
                {formatPrice(product.compare_price, storeCurrency, storeLocale)}
              </span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleAddClick}
            disabled={outOfStock}
            className="flex-shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: outOfStock ? "var(--ink-4)" : storeColor }}
          >
            {added ? <Check size={16} /> : <Plus size={16} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
