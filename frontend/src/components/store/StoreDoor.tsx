"use client";

// Puerta de la tienda — primera pantalla al entrar a slug.qtienda.shop/.
// Logo, letrero de abierto/cerrado, URL vistosa para compartir, ruleta (si
// está activa) y botón para entrar al catálogo real (/catalogo).

import { useState } from "react";
import Image from "next/image";
import { ChevronRight, MapPin, Truck, ShieldCheck, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getOpenStatus } from "@/lib/storeHours";
import WheelWidget from "./WheelWidget";

interface DoorStoreData {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  city?: string;
  primary_color: string;
  store_hours?: Record<string, { open: string; close: string }> | null;
  settings?: {
    accept_cash?: boolean;
    accept_yape?: boolean;
    accept_plin?: boolean;
    accept_transfer?: boolean;
    accept_card?: boolean;
  };
}

function joinSpanish(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export default function StoreDoor({ store }: { store: DoorStoreData }) {
  const [copied, setCopied] = useState(false);
  const color = store.primary_color || "#2563EB";
  const openStatus = getOpenStatus(store.store_hours);
  const storeUrl = `${store.slug}.qtienda.shop`;

  const enabledPaymentMethods = [
    store.settings?.accept_yape && "Yape",
    store.settings?.accept_plin && "Plin",
    store.settings?.accept_card && "tarjeta",
    store.settings?.accept_transfer && "transferencia",
    store.settings?.accept_cash && "efectivo",
  ].filter((m): m is string => !!m);
  const paymentMethodsLabel =
    enabledPaymentMethods.length > 0
      ? `Pago seguro por ${joinSpanish(enabledPaymentMethods)}`
      : null;

  function copyUrl() {
    navigator.clipboard?.writeText(`https://${storeUrl}/`);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 text-center"
      style={{ background: `linear-gradient(180deg, ${color}14, var(--bg) 55%)` }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        {/* Logo circular + letrero colgante de abierto/cerrado */}
        <div className="relative mb-4">
          {store.logo_url ? (
            <Image
              src={store.logo_url}
              alt={store.name}
              width={112}
              height={112}
              className="rounded-full object-cover"
              style={{ width: 112, height: 112, border: "4px solid var(--surface)", boxShadow: "var(--shadow-md)" }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-bold text-white"
              style={{ width: 112, height: 112, background: color, fontSize: 40, border: "4px solid var(--surface)", boxShadow: "var(--shadow-md)" }}
            >
              {store.name[0]?.toUpperCase()}
            </div>
          )}
          {openStatus && (
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap"
              style={{
                background: openStatus.open ? "var(--success)" : "var(--ink-3)",
                color: "#fff",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />
              {openStatus.label}
            </div>
          )}
        </div>

        <h1 className="font-display font-extrabold text-2xl mt-3" style={{ color: "var(--ink)" }}>
          {store.name}
        </h1>
        {store.city && (
          <p className="flex items-center gap-1 text-xs mt-1" style={{ color: "var(--ink-3)" }}>
            <MapPin size={11} /> {store.city}
          </p>
        )}

        {/* URL de la tienda — vistosa, pensada para compartir */}
        <button
          onClick={copyUrl}
          className="mono mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-[.97]"
          style={{ background: "var(--surface)", border: `1.5px solid ${color}40`, color: "var(--ink)", boxShadow: "var(--shadow-sm)" }}
        >
          {storeUrl}
          {copied ? <Check size={14} style={{ color: "var(--success)" }} /> : <Copy size={14} style={{ color: "var(--ink-3)" }} />}
        </button>

        <a
          href="/catalogo"
          className="mt-6 flex items-center gap-2 rounded-full px-7 py-3.5 font-bold text-sm text-white transition-all active:scale-[.97]"
          style={{ background: color, boxShadow: `0 8px 24px ${color}40` }}
        >
          Entrar a la tienda
          <ChevronRight size={16} />
        </a>

        {/* Ruleta — solo si el vendedor la activó y aún no se giró en esta sesión */}
        <div className="w-full mt-5">
          <WheelWidget slug={store.slug} accentColor={color} variant="banner" />
        </div>

        {/* Info rápida real — solo lo que la tienda realmente ofrece */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          >
            <Truck size={12} /> Envío a domicilio
          </span>
          {paymentMethodsLabel && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
            >
              <ShieldCheck size={12} /> {paymentMethodsLabel}
            </span>
          )}
        </div>

        {/* Sobre nosotros — solo si el vendedor escribió una descripción real */}
        {store.description && (
          <p className="max-w-md text-xs leading-relaxed mt-5" style={{ color: "var(--ink-3)" }}>
            {store.description}
          </p>
        )}
      </motion.div>
    </div>
  );
}
