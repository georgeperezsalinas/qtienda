"use client";

import Image from "next/image";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
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
    images: { url: string; is_primary: boolean }[];
  };
  storeColor: string;
  storeSlug: string;
  featured?: boolean;
}

export default function ProductCard({ product, storeColor, storeSlug, featured }: Props) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const primaryImage =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;

  const outOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;
  const discount = product.compare_price
    ? Math.round((1 - product.price_cents / product.compare_price) * 100)
    : null;

  function handleAdd() {
    if (outOfStock) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        price_cents: product.price_cents,
        image_url: primaryImage || "",
        quantity: 1,
      },
      storeSlug
    );
    setAdded(true);
    toast.success("Agregado al carrito", { duration: 1500 });
    setTimeout(() => setAdded(false), 2000);
  }

  if (featured) {
    return (
      <div className="flex-shrink-0 w-52 snap-start">
        <div className="card overflow-hidden">
          <div className="relative h-36 bg-gray-50">
            {primaryImage ? (
              <Image src={primaryImage} alt={product.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
            )}
            {discount && (
              <span
                className="absolute top-2 left-2 badge text-white text-xs"
                style={{ background: storeColor }}
              >
                -{discount}%
              </span>
            )}
          </div>
          <div className="p-3">
            <p className="font-semibold text-gray-900 text-sm truncate">{product.name}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="font-bold text-sm" style={{ color: storeColor }}>
                {formatPrice(product.price_cents)}
              </span>
              <button
                onClick={handleAdd}
                disabled={outOfStock}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                style={{ background: outOfStock ? "#d1d5db" : storeColor }}
              >
                {added ? <Check size={14} /> : <Plus size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="relative bg-gray-50 aspect-square">
        {primaryImage ? (
          <Image src={primaryImage} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🛍️</div>
        )}
        {discount && (
          <span
            className="absolute top-2 left-2 badge text-white font-bold"
            style={{ background: "#ef4444" }}
          >
            -{discount}%
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
        <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 flex-1">
          {product.name}
        </p>
        <div className="mt-2 flex items-center justify-between gap-1">
          <div>
            <span className="font-bold text-base" style={{ color: storeColor }}>
              {formatPrice(product.price_cents)}
            </span>
            {product.compare_price && (
              <span className="block text-xs text-gray-400 line-through">
                {formatPrice(product.compare_price)}
              </span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-colors"
            style={{ background: outOfStock ? "#d1d5db" : storeColor }}
          >
            {added ? <Check size={16} /> : <Plus size={16} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
