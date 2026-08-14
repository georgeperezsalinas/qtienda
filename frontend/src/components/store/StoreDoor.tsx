"use client";

// Puerta de la tienda — primera pantalla al entrar a slug.qtienda.shop/.
// Logo, letrero de abierto/cerrado, URL vistosa para compartir, ruleta (si
// está activa), instalar/crear cuenta (antes de entrar), y botón para pasar
// al catálogo real (/catalogo).

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, MapPin, Truck, ShieldCheck, Copy, Check, Download, UserPlus, X, Store as StoreIcon, CalendarClock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { getOpenStatus } from "@/lib/storeHours";
import { useAuthStore } from "@/store/authStore";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { apiClient } from "@/lib/api";
import WheelWidget from "./WheelWidget";
import { SocialLinks } from "./SocialLinks";

interface DoorStoreData {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string | null;
  city?: string;
  primary_color: string;
  store_hours?: Record<string, { open: string; close: string }> | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  settings?: {
    accept_cash?: boolean;
    accept_yape?: boolean;
    accept_plin?: boolean;
    accept_transfer?: boolean;
    accept_card?: boolean;
    accept_pickup?: boolean;
  };
}

function joinSpanish(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export default function StoreDoor({ store }: { store: DoorStoreData }) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accountDismissed, setAccountDismissed] = useState(false);
  const [hasServices, setHasServices] = useState(false);
  const color = store.primary_color || "#2563EB";
  const openStatus = getOpenStatus(store.store_hours);
  const storeUrl = `${store.slug}.qtienda.shop`;
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated());
  const { installPrompt, dismissed: installDismissed, install, dismiss: dismissInstall } =
    useInstallPrompt("pwa-banner-dismissed");

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("qtienda_buyer_banner_dismissed") === "1") setAccountDismissed(true);
    apiClient
      .get(`/public/store/${store.slug}/services`)
      .then(({ data }) => setHasServices(Array.isArray(data) && data.length > 0))
      .catch(() => {});
  }, [store.slug]);

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

  function dismissAccount() {
    setAccountDismissed(true);
    localStorage.setItem("qtienda_buyer_banner_dismissed", "1");
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 text-center relative overflow-hidden"
      style={{ background: store.banner_url ? "var(--bg)" : `radial-gradient(ellipse 70% 40% at 50% 0%, ${color}22 0%, transparent 60%), var(--bg)` }}
    >
      {/* Toldo de tienda física — franja a rayas en la parte superior, como el
          borde de un local en la calle, no un fondo web genérico */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-2"
        style={{ background: `repeating-linear-gradient(45deg, ${color} 0 14px, var(--surface) 14px 28px)` }}
      />
      {/* Grilla sutil — mismo lenguaje visual del panel de marca en login */}
      {!store.banner_url && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage: `linear-gradient(${color}FF 1px, transparent 1px), linear-gradient(90deg, ${color}FF 1px, transparent 1px)`,
            backgroundSize: "36px 36px",
          }}
        />
      )}
      {/* Fondo con el banner real de la tienda — desenfocado y oscurecido
          (estilo "portada difuminada") en vez de la foto nítida: así el logo
          y los textos siempre se leen bien, sin importar qué tan clara,
          oscura o cargada sea la imagen que subió el vendedor. Se escala
          115% para que el desenfoque no deje bordes transparentes. */}
      {store.banner_url && (
        <>
          <Image
            src={store.banner_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover scale-[1.15]"
            style={{ filter: "blur(28px) brightness(.5) saturate(1.15)" }}
            aria-hidden
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, ${color}40 0%, rgba(0,0,0,.25) 45%, var(--bg) 88%)` }}
            aria-hidden
          />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm flex flex-col items-center relative"
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
            /* Letrero colgante estilo puerta física: cordón + placa rotada,
               en vez de una píldora web genérica */
            <div className="absolute -bottom-5 left-1/2 flex flex-col items-center" style={{ transform: "translateX(-50%) rotate(-4deg)" }}>
              <span style={{ width: 1.5, height: 9, background: "var(--ink-4)" }} aria-hidden />
              <div
                className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-extrabold uppercase whitespace-nowrap"
                style={{
                  letterSpacing: ".05em",
                  borderRadius: 3,
                  background: openStatus.open ? "var(--success)" : "var(--ink-2)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,.3)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />
                {openStatus.label}
              </div>
            </div>
          )}
        </div>

        <h1
          className="font-display font-extrabold text-2xl mt-3"
          style={{ color: store.banner_url ? "#fff" : "var(--ink)", textShadow: store.banner_url ? "0 2px 12px rgba(0,0,0,.35)" : undefined }}
        >
          {store.name}
        </h1>
        {store.city && (
          <p
            className="flex items-center gap-1 text-xs mt-1"
            style={{ color: store.banner_url ? "rgba(255,255,255,.85)" : "var(--ink-3)", textShadow: store.banner_url ? "0 1px 6px rgba(0,0,0,.35)" : undefined }}
          >
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

        {/* Instalar / crear cuenta — antes de entrar, para no perderse la
            ruleta, el cupón o los datos de la tienda si vuelve más tarde. */}
        <div className="w-full flex flex-col gap-2 mt-2">
          <AnimatePresence>
            {mounted && installPrompt && !installDismissed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-left"
                style={{ background: "var(--surface)", border: `1.5px dashed ${color}55` }}
              >
                <span className="text-lg flex-shrink-0">📲</span>
                <p className="flex-1 text-xs font-medium" style={{ color: "var(--ink-2)" }}>
                  Instala la tienda para acceso rápido
                </p>
                <button
                  onClick={install}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
                  style={{ background: color }}
                >
                  <Download size={11} /> Instalar
                </button>
                <button onClick={dismissInstall} className="flex-shrink-0"><X size={14} style={{ color: "var(--ink-4)" }} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {mounted && !isLoggedIn && !accountDismissed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-left"
                style={{ background: "var(--success-soft)", border: "1.5px dashed var(--line-2)" }}
              >
                <UserPlus size={18} className="flex-shrink-0" style={{ color: "var(--success)" }} />
                <p className="flex-1 text-xs font-medium leading-snug" style={{ color: "var(--success)" }}>
                  ¿Compras aquí seguido? Crea una cuenta para ver tus pedidos
                </p>
                <a href="/registro"
                  className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full text-white whitespace-nowrap"
                  style={{ background: "var(--success)" }}>
                  Crear cuenta
                </a>
                <button onClick={dismissAccount} className="flex-shrink-0"><X size={14} style={{ color: "var(--ink-3)" }} /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info rápida real — solo lo que la tienda realmente ofrece */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {hasServices && (
            <a
              href="/catalogo#tienda-servicios"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full text-white"
              style={{ background: color }}
            >
              <CalendarClock size={12} /> Reserva tu cita
            </a>
          )}
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          >
            <Truck size={12} /> Envío a domicilio
          </span>
          {store.settings?.accept_pickup && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
            >
              <StoreIcon size={12} /> Recojo en tienda
            </span>
          )}
          {paymentMethodsLabel && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
            >
              <ShieldCheck size={12} /> {paymentMethodsLabel}
            </span>
          )}
        </div>

        {/* Acerca de la tienda — descripción real + redes sociales, solo si hay algo que mostrar */}
        {(store.description || store.instagram || store.tiktok || store.facebook) && (
          <div className="w-full max-w-md rounded-2xl p-4 mt-5" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
            <p className="eyebrow mb-2">Acerca de la tienda</p>
            {store.description && (
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-3)" }}>
                {store.description}
              </p>
            )}
            {(store.instagram || store.tiktok || store.facebook) && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <SocialLinks store={store} size={32} />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
