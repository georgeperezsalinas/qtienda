"use client";

import Image from "next/image";
import { Plus, Check, Images } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, stripHtml } from "@/lib/utils";
import { trackStoreEvent } from "@/lib/storeAnalytics";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

interface Props {
  product: {
    id: string;
    name: string;
    description?: string;
    price_cents: number;
    compare_price?: number;
    stock?: number;
    sold_count?: number;
    created_at?: string;
    images: { url: string; is_primary: boolean }[];
  };
  storeColor: string;
  storeSlug: string;
  featured?: boolean;
  compact?: boolean;   // list-view mode
  onTap?: () => void;
}

const NEW_PRODUCT_DAYS = 14;

/* Imagen con skeleton: shimmer mientras carga, fade-in al terminar */
function CardImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-all duration-300 group-hover:scale-[1.05] ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: "linear-gradient(110deg, #F1F5F9 40%, #E8EEF5 50%, #F1F5F9 60%)" }}
        />
      )}
    </>
  );
}

export default function ProductCard({
  product, storeColor, storeSlug, featured, compact, onTap,
}: Props) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const primaryImage =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;

  const outOfStock =
    product.stock !== null && product.stock !== undefined && product.stock <= 0;
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
      <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: "#EA580C" }}>
        🔥 {soldCount} vendidos
      </span>
    ) : isNew ? (
      <span
        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: "#DCFCE7", color: "#16A34A" }}
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
    trackStoreEvent(storeSlug, "add_to_cart", product.id);
    toast.success("Agregado al carrito", { duration: 1500 });
    setTimeout(() => setAdded(false), 2000);
  }

  /* ── Featured card (horizontal carousel) ── */
  if (featured) {
    return (
      <div
        className="flex-shrink-0 w-48 md:w-56 snap-start cursor-pointer group"
        onClick={onTap}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", boxShadow: "0 2px 12px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.05)" }}
        >
          <div className="relative h-40 bg-gray-50">
            {primaryImage ? (
              <CardImage src={primaryImage} alt={displayName} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
            )}
            {discount && (
              <span
                className="absolute top-2 left-2 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-full"
                style={{ background: "#EF4444" }}
              >
                -{discount}%
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
              <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-500 bg-white rounded-full px-3 py-1 shadow-sm">
                  Agotado
                </span>
              </div>
            )}
          </div>
          <div className="p-3">
            <p className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: "#0F172A" }}>
              {displayName}
            </p>
            {socialBadge && <div className="mt-1">{socialBadge}</div>}
            <div className="flex items-center justify-between mt-2">
              <div>
                <span className="font-extrabold text-sm" style={{ color: storeColor }}>
                  {formatPrice(product.price_cents)}
                </span>
                {product.compare_price && (
                  <span className="block text-[11px] line-through" style={{ color: "#CBD5E1" }}>
                    {formatPrice(product.compare_price)}
                  </span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleAdd}
                disabled={outOfStock}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ background: outOfStock ? "#d1d5db" : storeColor }}
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
        className="flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-[.99] cursor-pointer h-full"
        style={{
          background: "#fff",
          border: "1px solid #F1F5F9",
          boxShadow: "0 1px 4px rgba(15,23,42,.05)",
        }}
        onClick={onTap}
      >
        {/* Image */}
        <div className="relative w-[76px] h-[76px] rounded-xl overflow-hidden flex-shrink-0 bg-gray-50">
          {primaryImage ? (
            <CardImage src={primaryImage} alt={displayName} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
              <span className="text-[9px] font-bold text-gray-400">Agotado</span>
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
          <p className="text-sm font-bold leading-snug line-clamp-2" style={{ color: "#0F172A" }}>
            {displayName}
          </p>
          {product.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#94A3B8" }}>
              {displayDesc}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-extrabold text-sm" style={{ color: storeColor }}>
              {formatPrice(product.price_cents)}
            </span>
            {discount && (
              <span
                className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: "#EF4444" }}
              >
                -{discount}%
              </span>
            )}
            {product.compare_price && (
              <span className="text-xs line-through" style={{ color: "#CBD5E1" }}>
                {formatPrice(product.compare_price)}
              </span>
            )}
            {socialBadge}
          </div>
        </div>

        {/* Add to cart */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleAdd}
          disabled={outOfStock}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors"
          style={{ background: outOfStock ? "#d1d5db" : storeColor }}
        >
          {added ? <Check size={16} /> : <Plus size={16} />}
        </motion.button>
      </div>
    );
  }

  /* ── Grid card (default, 2-col) ── */
  return (
    <div
      className="group rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all active:scale-[.98] lg:hover:-translate-y-1"
      style={{
        background: "#fff",
        boxShadow: "0 2px 12px rgba(15,23,42,.07), 0 0 0 1px rgba(15,23,42,.04)",
      }}
      onClick={onTap}
    >
      <div className="relative bg-gray-50 aspect-square">
        {primaryImage ? (
          <CardImage src={primaryImage} alt={displayName} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🛍️</div>
        )}
        {discount && (
          <span
            className="absolute top-2 left-2 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-full"
            style={{ background: "#EF4444" }}
          >
            -{discount}%
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
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 bg-white rounded-full px-3 py-1 shadow-sm">
              Agotado
            </span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1" style={{ color: "#0F172A" }}>
          {displayName}
        </p>
        {socialBadge && <div className="mt-1">{socialBadge}</div>}
        <div className="mt-2 flex items-center justify-between gap-1">
          <div>
            <span className="font-extrabold text-base" style={{ color: storeColor }}>
              {formatPrice(product.price_cents)}
            </span>
            {product.compare_price && (
              <span className="block text-xs line-through" style={{ color: "#CBD5E1" }}>
                {formatPrice(product.compare_price)}
              </span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: outOfStock ? "#d1d5db" : storeColor }}
          >
            {added ? <Check size={16} /> : <Plus size={16} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
