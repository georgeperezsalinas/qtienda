"use client";

// Puerta de la tienda — primera pantalla al entrar a slug.qtienda.shop/.
// Logo, letrero de abierto/cerrado, URL vistosa para compartir, vitrina real
// de fotos (productos/servicios), confianza real (rating/pedidos), ruleta
// (si está activa), instalar/crear cuenta, y botón para pasar al catálogo
// real (/catalogo). En desktop se parte en dos columnas — antes era una
// columna angosta centrada con mucho vacío a los lados, se sentía a medio
// hacer en pantallas grandes.

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ChevronRight, MapPin, Truck, ShieldCheck, Copy, Check, Download, UserPlus, X,
  Store as StoreIcon, CalendarClock, Star, PackageCheck, Home, LayoutGrid, ShoppingCart, User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { getOpenStatus } from "@/lib/storeHours";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { apiClient } from "@/lib/api";
import WheelWidget from "./WheelWidget";
import { SocialLinks } from "./SocialLinks";
import Logo from "@/components/ui/Logo";
import PublicBottomNav from "@/components/ui/PublicBottomNav";

interface DoorStoreData {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string | null;
  city?: string;
  address?: string | null;
  primary_color: string;
  store_hours?: Record<string, { open: string; close: string }> | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  has_products?: boolean;
  has_services?: boolean;
  rating_avg?: number | null;
  rating_count?: number;
  orders_delivered_count?: number;
  settings?: {
    accept_cash?: boolean;
    accept_yape?: boolean;
    accept_plin?: boolean;
    accept_transfer?: boolean;
    accept_card?: boolean;
    accept_pickup?: boolean;
  };
}

interface PreviewPhoto {
  url: string;
  key: string;
}

function joinSpanish(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

// Rotaciones fijas para el efecto "fotos pegadas en la vitrina" — no aleatorio
// (evita hydration mismatch server/cliente), solo alternado prolijo.
const TILTS = [-6, 4, -3, 5, -5];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function StoreDoor({ store }: { store: DoorStoreData }) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasServices, setHasServices] = useState(false);
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>([]);
  const color = store.primary_color || "#2563EB";
  const openStatus = getOpenStatus(store.store_hours);
  const storeUrl = `${store.slug}.qtienda.shop`;
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated());
  const cartCount = useCartStore((s) => s.totalItems());
  const { installPrompt, dismissed: installDismissed, install, dismiss: dismissInstall } =
    useInstallPrompt("pwa-banner-dismissed");

  useEffect(() => {
    setMounted(true);

    // Vitrina real: primeras fotos de productos y/o servicios — nunca un
    // placeholder. Sin esto la puerta es solo texto e íconos, se siente
    // como una ficha vacía en vez de una tienda de verdad.
    Promise.all([
      apiClient.get(`/public/store/${store.slug}/products`).catch(() => ({ data: [] })),
      apiClient.get(`/public/store/${store.slug}/services`).catch(() => ({ data: [] })),
    ]).then(([prodRes, svcRes]) => {
      const services = Array.isArray(svcRes.data) ? svcRes.data : [];
      setHasServices(services.length > 0);

      const products = Array.isArray(prodRes.data) ? prodRes.data : [];
      const productPhotos: PreviewPhoto[] = products
        .map((p: any) => {
          const img = p.images?.find((i: any) => i.is_primary)?.url ?? p.images?.[0]?.url;
          return img ? { url: img, key: `p-${p.id}` } : null;
        })
        .filter(Boolean) as PreviewPhoto[];
      const servicePhotos: PreviewPhoto[] = services
        .map((s: any) => (s.image_url ? { url: s.image_url, key: `s-${s.id}` } : null))
        .filter(Boolean) as PreviewPhoto[];

      setPreviewPhotos([...productPhotos, ...servicePhotos].slice(0, 5));
    });
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

  const hasTrustSignal = (store.rating_count ?? 0) > 0 || (store.orders_delivered_count ?? 0) > 0;

  // Vitrina — fotos reales "pegadas" tipo vidriera, tilteadas, se reutiliza
  // igual en mobile (chica, arriba del CTA) y en el panel derecho de desktop
  // (grande). Sin fotos reales, no se renderiza nada (nunca un placeholder).
  function Vitrina({ size }: { size: number }) {
    if (previewPhotos.length === 0) return null;
    return (
      <div className="flex items-center justify-center" style={{ minHeight: size + 24 }}>
        {previewPhotos.map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, scale: 0.85, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: TILTS[i % TILTS.length] }}
            transition={{ delay: 0.25 + i * 0.06, type: "spring", stiffness: 220, damping: 18 }}
            whileHover={{ rotate: 0, scale: 1.06, zIndex: 10 }}
            className="relative flex-shrink-0 rounded-2xl overflow-hidden"
            style={{
              width: size,
              height: size,
              marginLeft: i === 0 ? 0 : -size * 0.28,
              border: "3px solid var(--surface)",
              boxShadow: "var(--shadow-md)",
              zIndex: i,
            }}
          >
            <Image src={p.url} alt="" fill sizes={`${size}px`} className="object-cover" />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col px-4 py-10 pb-24 md:pb-10 relative overflow-hidden"
      style={{ background: store.banner_url ? "var(--bg)" : `radial-gradient(ellipse 70% 40% at 50% 0%, ${color}22 0%, transparent 60%), var(--bg)` }}
    >
      {/* Toldo de tienda física — franja a rayas en la parte superior, como el
          borde de un local en la calle, no un fondo web genérico */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-2"
        style={{ background: `repeating-linear-gradient(45deg, ${color} 0 14px, var(--surface) 14px 28px)` }}
      />
      {/* Resplandor cálido de marca — mismo lenguaje que el hero de la
          landing, en vez del cuadriculado plano que había antes cuando la
          tienda no subió un banner propio. */}
      {!store.banner_url && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 45% at 15% 0%, ${color}22 0%, transparent 60%), radial-gradient(ellipse 55% 40% at 90% 10%, ${color}18 0%, transparent 65%)`,
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

      {/* ══════════════════════════════════════════════════════════
          Layout: una columna centrada en mobile, dos columnas en
          desktop (identidad+acciones a la izquierda, vitrina/banner
          grande a la derecha) — antes era la misma columna angosta
          sin importar el tamaño de pantalla, se veía a medio hacer.
      ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center relative">
        <div className="w-full max-w-sm lg:max-w-5xl lg:grid lg:grid-cols-[1fr_1fr] lg:gap-14 lg:items-center">

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="w-full flex flex-col items-center text-center lg:items-start lg:text-left relative"
          >
            {/* Logo circular + letrero colgante de abierto/cerrado */}
            <motion.div variants={item} className="relative mb-4">
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
            </motion.div>

            <motion.h1
              variants={item}
              className="font-display font-extrabold mt-3"
              style={{
                fontSize: "clamp(26px, 4vw, 34px)",
                lineHeight: 1.1,
                color: store.banner_url ? "#fff" : "var(--ink)",
                textShadow: store.banner_url ? "0 2px 12px rgba(0,0,0,.35)" : undefined,
              }}
            >
              {store.name}
            </motion.h1>

            {/* Fila de confianza real — rating y pedidos entregados, solo si
                existen de verdad (nunca "0.0" ni "0 pedidos" inventado) */}
            {(store.city || store.address || hasTrustSignal) && (
              <motion.div
                variants={item}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1 mt-1.5 text-xs"
                style={{ color: store.banner_url ? "rgba(255,255,255,.9)" : "var(--ink-3)", textShadow: store.banner_url ? "0 1px 6px rgba(0,0,0,.35)" : undefined }}
              >
                {(store.city || store.address) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {store.city}
                    {store.city && store.address && " · "}
                    {store.address}
                  </span>
                )}
                {(store.rating_count ?? 0) > 0 && store.rating_avg != null && (
                  <span className="flex items-center gap-1 font-bold">
                    <Star size={11} fill="currentColor" style={{ color: "#F5B400" }} />
                    <span style={{ color: store.banner_url ? "#fff" : "var(--ink)" }}>{store.rating_avg.toFixed(1)}</span>
                    <span>({store.rating_count})</span>
                  </span>
                )}
                {(store.orders_delivered_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <PackageCheck size={11} /> {store.orders_delivered_count} entregados
                  </span>
                )}
              </motion.div>
            )}

            {/* URL de la tienda — vistosa, pensada para compartir */}
            <motion.button
              variants={item}
              onClick={copyUrl}
              className="mono mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-[.97]"
              style={{ background: "var(--surface)", border: `1.5px solid ${color}40`, color: "var(--ink)", boxShadow: "var(--shadow-sm)" }}
            >
              {storeUrl}
              {copied ? <Check size={14} style={{ color: "var(--success)" }} /> : <Copy size={14} style={{ color: "var(--ink-3)" }} />}
            </motion.button>

            <motion.a
              variants={item}
              href="/catalogo"
              className="mt-6 flex items-center gap-2 rounded-full px-7 py-3.5 font-bold text-sm text-white transition-all active:scale-[.97]"
              style={{ background: color, boxShadow: `0 8px 24px ${color}40` }}
            >
              {/* Una tienda de solo servicios (ej. un odontólogo) no tiene
                  productos que "entrar a ver" — el copy se adapta a lo que
                  realmente ofrece. */}
              {store.has_products === false && store.has_services
                ? "Ver servicios y reservar"
                : "Entrar a la tienda"}
              <ChevronRight size={16} />
            </motion.a>

            {/* Vitrina chica — solo en mobile/tablet, en desktop se muestra
                grande en el panel derecho en su lugar. */}
            {mounted && previewPhotos.length > 0 && (
              <motion.div variants={item} className="lg:hidden mt-6">
                <Vitrina size={72} />
              </motion.div>
            )}

            {/* Ruleta — solo si el vendedor la activó y aún no se giró en esta sesión */}
            <motion.div variants={item} className="w-full mt-5">
              <WheelWidget slug={store.slug} accentColor={color} variant="banner" />
            </motion.div>

            {/* Instalar / crear cuenta — antes de entrar, para no perderse la
                ruleta, el cupón o los datos de la tienda si vuelve más tarde. */}
            <motion.div variants={item} className="w-full flex flex-col gap-2 mt-2">
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

              {/* Cuenta comprador — link de texto simple, no un banner de
                  color: es una opción disponible, no algo que compita por
                  atención con entrar a la tienda. */}
              {mounted && !isLoggedIn && (
                <a
                  href="/registro"
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold py-1"
                  style={{ color: "var(--ink-3)" }}
                >
                  <UserPlus size={12} />
                  Crear cuenta para ver tu historial de pedidos
                </a>
              )}
            </motion.div>

            {/* Info rápida real — solo lo que la tienda realmente ofrece */}
            <motion.div variants={item} className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-5">
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
            </motion.div>

            {/* Acerca de la tienda — descripción real + redes sociales, solo si hay algo que mostrar.
                Fondo tibio del color de la tienda + comilla decorativa + texto en itálica: se lee
                como una nota personal del dueño, no como una ficha de datos. */}
            {(store.description || store.instagram || store.tiktok || store.facebook) && (
              <motion.div
                variants={item}
                className="relative w-full max-w-md rounded-[28px] p-6 mt-5 text-left overflow-hidden"
                style={{ background: `linear-gradient(155deg, ${color}14, ${color}06)`, boxShadow: "var(--shadow-sm)" }}
              >
                <span
                  aria-hidden
                  className="absolute font-display select-none leading-none"
                  style={{ top: -6, left: 14, fontSize: 76, color, opacity: 0.13 }}
                >
                  &ldquo;
                </span>

                <div className="relative flex items-center gap-2 mb-2.5">
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: 26, height: 26, background: `${color}1f` }}
                  >
                    <StoreIcon size={13} style={{ color }} />
                  </div>
                  <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                    Sobre {store.name}
                  </p>
                </div>
                {store.description && (
                  <p className="relative text-sm leading-relaxed italic" style={{ color: "var(--ink-2)" }}>
                    {store.description}
                  </p>
                )}
                {(store.instagram || store.tiktok || store.facebook) && (
                  <div className="relative flex items-center gap-2 mt-4">
                    <SocialLinks store={store} size={32} />
                  </div>
                )}
              </motion.div>
            )}

            <motion.a
              variants={item}
              href="https://qtienda.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-6"
            >
              <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>Powered by</span>
              <span style={{ opacity: 0.55 }}>
                <Logo size="sm" href={null} />
              </span>
            </motion.a>
          </motion.div>

          {/* Panel derecho — solo desktop. Vitrina grande si hay fotos reales;
              si no hay fotos, un panel decorativo con el color de marca en vez
              de dejar la mitad de la pantalla vacía. */}
          <div className="hidden lg:flex items-center justify-center h-full">
            {mounted && previewPhotos.length > 0 ? (
              <Vitrina size={168} />
            ) : (
              <div
                className="w-full aspect-square rounded-[40px] flex items-center justify-center"
                style={{ background: `linear-gradient(155deg, ${color}20, ${color}06)`, border: `1.5px dashed ${color}40` }}
              >
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{ width: 96, height: 96, background: `${color}18` }}
                >
                  <StoreIcon size={40} style={{ color }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra inferior — misma que en el catálogo, para no perder el
          acceso rápido apenas se entra a la tienda. Sin cuenta/carrito
          propios acá (es la puerta, todavía no hay catálogo abierto):
          "Categorías" y "Carrito" navegan directo a /catalogo. */}
      {mounted && (
        <PublicBottomNav
          accentColor={color}
          items={[
            {
              key: "inicio",
              icon: Home,
              label: "Inicio",
              active: true,
              onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
            },
            { key: "categorias", icon: LayoutGrid, label: "Categorías", href: "/catalogo#tour-categories" },
            {
              key: "carrito",
              icon: ShoppingCart,
              label: "Carrito",
              badge: cartCount > 0 ? cartCount : undefined,
              href: "/catalogo",
            },
            { key: "cuenta", icon: User, label: "Cuenta", href: "/mis-pedidos" },
          ]}
        />
      )}
    </div>
  );
}
