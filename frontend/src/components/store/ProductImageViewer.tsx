"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  images: { url: string; is_primary: boolean }[];
  productName: string;
  onClose: () => void;
  storeColor: string;
}

export default function ProductImageViewer({ images, productName, onClose, storeColor }: Props) {
  const [current, setCurrent] = useState(
    () => Math.max(0, images.findIndex((i) => i.is_primary))
  );
  const touchStartX = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(images.length - 1, c + 1));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [images.length, onClose]);

  function prev() { setCurrent((c) => Math.max(0, c - 1)); }
  function next() { setCurrent((c) => Math.min(images.length - 1, c + 1)); }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50) next();
    else if (delta < -50) prev();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "rgba(0,0,0,.95)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 flex-shrink-0">
        <p className="text-white font-semibold text-sm truncate flex-1">{productName}</p>
        {images.length > 1 && (
          <span className="text-white/50 text-xs flex-shrink-0">
            {current + 1} / {images.length}
          </span>
        )}
        <button
          onClick={onClose}
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,.15)" }}
          aria-label="Cerrar"
        >
          <X size={18} color="white" />
        </button>
      </div>

      {/* Main image with swipe support */}
      <div
        className="flex-1 relative min-h-0"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-4"
          >
            <Image
              src={images[current].url}
              alt={productName}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </motion.div>
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={current === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full
                         flex items-center justify-center transition-opacity disabled:opacity-20"
              style={{ background: "rgba(255,255,255,.2)" }}
            >
              <ChevronLeft size={22} color="white" />
            </button>
            <button
              onClick={next}
              disabled={current === images.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full
                         flex items-center justify-center transition-opacity disabled:opacity-20"
              style={{ background: "rgba(255,255,255,.2)" }}
            >
              <ChevronRight size={22} color="white" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails (solo si hay más de 1 imagen) */}
      {images.length > 1 && (
        <div className="flex-shrink-0 flex gap-2.5 justify-center px-4 pt-3 pb-8 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="flex-shrink-0 relative w-16 h-16 rounded-xl overflow-hidden transition-all"
              style={{
                border: `2px solid ${i === current ? storeColor : "rgba(255,255,255,.25)"}`,
                opacity: i === current ? 1 : 0.5,
              }}
            >
              <Image src={img.url} alt={`foto ${i + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
