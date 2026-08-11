"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Search, ChevronRight, Zap, Heart,
  MapPin, X, MessageCircle, Share2, Download,
  LayoutGrid, List, Clock, Truck, ShieldCheck, PackageSearch,
  HelpCircle, CheckCircle2, Star, Instagram, Facebook,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import ProductCard from "./ProductCard";
import ProductDetailSheet from "./ProductDetailSheet";
import CartDrawer from "./CartDrawer";
import MarketingPixels from "./MarketingPixels";
import { pixelViewContent, pixelAddToCart, pixelInitiateCheckout } from "@/lib/marketingPixels";
import StoreTour, { restartStoreTour } from "./StoreTour";
import { useCartStore } from "@/store/cartStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useAuthStore } from "@/store/authStore";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { trackStoreEvent } from "@/lib/storeAnalytics";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getOpenStatus } from "@/lib/storeHours";
import FiestasPatriasFloatingBadge from "@/components/ui/FiestasPatriasFloatingBadge";

interface StoreData {
  slug:          string;
  name:          string;
  description?:  string;
  logo_url?:     string;
  banner_url?:   string;
  banner_link?:  string;
  banners?:      { url: string; link?: string | null }[];
  store_hours?:  Record<string, { open: string; close: string }> | null;
  primary_color: string;
  city?:         string;
  country?:      string;
  categories?:   { id: string; name: string; icon?: string }[];
  whatsapp?:     string;
  instagram?:    string;
  tiktok?:       string;
  facebook?:     string;
  theme?:        "clasico" | "elegante" | "vibrante" | "pastel" | "monocromo" | "fresco";
  meta_title?:   string;
  orders_delivered_count?: number;
  is_verified?:  boolean;
  rating_avg?:   number | null;
  rating_count?: number;
  settings?: {
    welcome_discount_enabled?: boolean;
    welcome_discount_cents?:   number;
    accept_cash?:     boolean;
    accept_yape?:     boolean;
    accept_plin?:     boolean;
    accept_transfer?: boolean;
    accept_card?:     boolean;
    delivery_zones?:  string[];
    tiktok_pixel_id?:      string | null;
    meta_pixel_id?:        string | null;
    google_analytics_id?:  string | null;
  };
}

// "Yape, Plin y efectivo" — nunca "Yape, Plin, efectivo" (sin "y" final)
function joinSpanish(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

interface ProductData {
  id:             string;
  name:           string;
  description?:   string;
  price_cents:    number;
  compare_price?: number;
  sale_ends_at?:  string;
  stock?:         number;
  is_featured:    boolean;
  category_id?:   string;
  sold_count?:    number;
  created_at?:    string;
  images:         { url: string; is_primary: boolean }[];
}

interface Props {
  store:           StoreData;
  initialProducts: ProductData[];
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* Buscador de la tienda: se renderiza inline en el header desktop y como fila propia en móvil */
function SearchBox({ value, onChange, focused, setFocused, color, inputRef }: {
  value: string;
  onChange: (v: string) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
  color: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="relative">
      <Search
        size={15}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: focused ? color : "var(--ink-4)" }}
      />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        placeholder="Buscar en la tienda…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full text-sm rounded-2xl pl-10 pr-9 py-2.5 outline-none transition-all"
        style={{
          background: focused ? "var(--surface)" : "var(--surface-2)",
          // Borde siempre visible: sin él, el buscador parece texto suelto
          border:     `1.5px solid ${focused ? color : "var(--line-2)"}`,
          boxShadow:  focused ? `0 0 0 3px ${color}18` : "inset 0 1px 2px rgba(20,19,15,.04)",
          color:      "var(--ink)",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X size={14} style={{ color: "var(--ink-4)" }} />
        </button>
      )}
    </div>
  );
}

/* Carrusel de banners (QT-030): swipe + rotación automática cada 5s + puntitos.
   Con un solo banner se comporta como imagen estática. */
function BannerCarousel({ banners, storeName }: {
  banners: { url: string; link?: string | null }[];
  storeName: string;
}) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el || pausedRef.current) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  function onScroll() {
    const el = trackRef.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-2xl"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        {banners.map((b, i) => {
          // Solo http(s) o rutas internas: nunca javascript: en el href
          const link = b.link && /^(https?:\/\/|\/)/.test(b.link) ? b.link : undefined;
          const isExternal = !!link && link.startsWith("http") && !link.includes("qtienda.shop");
          const img = (
            <div className="relative w-full aspect-[3/1] lg:aspect-[3.4/1]">
              <Image
                src={b.url}
                alt={`Banner ${i + 1} de ${storeName}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 1100px"
              />
            </div>
          );
          return (
            <div key={i} className="w-full flex-shrink-0 snap-start">
              {link ? (
                <a
                  href={link}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="block active:scale-[.99] transition-transform"
                  aria-label={`Promoción ${i + 1} de ${storeName}`}
                >
                  {img}
                </a>
              ) : img}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
          {banners.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 14 : 6,
                background: i === idx ? "#fff" : "rgba(255,255,255,.55)",
                boxShadow: "0 1px 3px rgba(0,0,0,.25)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Banner por defecto cuando el vendedor no subió ninguno — degradado con su
   color de marca real, nunca un archivo generado (se actualiza solo si cambia
   su color despues). Mismo criterio que el fallback de logo (iniciales). */
function BannerPlaceholder({ storeName, logoUrl, color }: {
  storeName: string;
  logoUrl?: string;
  color: string;
}) {
  return (
    <div
      className="relative w-full aspect-[3/1] lg:aspect-[3.4/1] rounded-2xl overflow-hidden flex items-center gap-4 px-6 lg:px-10"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 65%, black) 100%)`,
        boxShadow: "var(--shadow-md)",
      }}
    >
      {logoUrl ? (
        <div
          className="relative rounded-2xl overflow-hidden flex-shrink-0"
          style={{ width: "clamp(40px, 12%, 88px)", height: "clamp(40px, 12%, 88px)", border: "2px solid rgba(255,255,255,.6)" }}
        >
          <Image src={logoUrl} alt="" fill sizes="88px" className="object-cover" />
        </div>
      ) : (
        <div
          className="rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-white"
          style={{
            width: "clamp(40px, 12%, 88px)", height: "clamp(40px, 12%, 88px)",
            background: "rgba(255,255,255,.22)", fontSize: "clamp(16px, 4vw, 34px)",
            border: "2px solid rgba(255,255,255,.6)",
          }}
        >
          {storeName[0]?.toUpperCase()}
        </div>
      )}
      <p
        className="font-display font-extrabold text-white truncate"
        style={{ fontSize: "clamp(16px, 3.2vw, 34px)", letterSpacing: "-0.01em" }}
      >
        {storeName}
      </p>
    </div>
  );
}

/* Lista de categorías: chips horizontales (móvil/tablet) o rail vertical (desktop) */
function CategoryList({ store, activeCategory, setActiveCategory, color, vertical }: {
  store: StoreData;
  activeCategory: string | null;
  setActiveCategory: (v: string | null) => void;
  color: string;
  vertical?: boolean;
}) {
  if (!store.categories?.length) return null;
  if (vertical) {
    return (
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => setActiveCategory(null)}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
          style={
            !activeCategory
              ? { background: color, color: "#fff" }
              : { background: "transparent", color: "var(--ink-2)" }
          }
        >
          Todo
        </button>
        {store.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
            style={
              activeCategory === cat.id
                ? { background: color, color: "#fff" }
                : { background: "transparent", color: "var(--ink-2)" }
            }
          >
            {cat.icon && <span>{cat.icon}</span>}
            <span className="truncate">{cat.name}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide lg:px-6">
        <button
          onClick={() => setActiveCategory(null)}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
          style={
            !activeCategory
              ? { background: color, color: "#fff" }
              : { background: "var(--surface-2)", color: "var(--ink-2)" }
          }
        >
          Todo
        </button>
        {store.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
            style={
              activeCategory === cat.id
                ? { background: color, color: "#fff" }
                : { background: "var(--surface-2)", color: "var(--ink-2)" }
            }
          >
            {cat.icon && <span>{cat.icon}</span>}
            {cat.name}
          </button>
        ))}
      </div>
      {/* Pista de "hay más categorías" — mismo recurso que la franja de confianza justo debajo */}
      <div
        className="absolute right-0 top-0 bottom-3 w-8 pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, var(--surface))" }}
      />
    </div>
  );
}

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

/* Redes sociales de la tienda — señal que el comprador puede verificar por
   su cuenta (seguidores, historial real), no una garantía de qtienda. */
function SocialLinks({ store, size = 32 }: { store: StoreData; size?: number }) {
  const links = [
    store.instagram && { key: "instagram", href: `https://instagram.com/${store.instagram}`, icon: Instagram },
    store.tiktok && { key: "tiktok", href: `https://tiktok.com/@${store.tiktok}`, icon: TikTokIcon },
    store.facebook && { key: "facebook", href: `https://facebook.com/${store.facebook}`, icon: Facebook },
  ].filter(Boolean) as { key: string; href: string; icon: React.ElementType }[];

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {links.map(({ key, href, icon: Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-full flex-shrink-0 transition-transform active:scale-90"
          style={{ width: size, height: size, background: "var(--surface-2)", color: "var(--ink-2)" }}
          aria-label={key}
        >
          <Icon size={Math.round(size * 0.45)} />
        </a>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   STORE PAGE
════════════════════════════════════════ */
export default function StorePage({ store, initialProducts }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cartOpen,       setCartOpen]       = useState(false);
  const [mounted,        setMounted]        = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [viewProduct,    setViewProduct]    = useState<ProductData | null>(null);
  const [listView,       setListView]       = useState(true);
  const [accountOpen,    setAccountOpen]    = useState(false);
  const [installPrompt,       setInstallPrompt]       = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed,    setInstallDismissed]    = useState(false);
  const [buyerBannerDismissed,setBuyerBannerDismissed]= useState(false);
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const [isOwner,             setIsOwner]             = useState(false);
  const [trackOpen,           setTrackOpen]           = useState(false);
  const [qrOpen,              setQrOpen]              = useState(false);
  const [trackNum,            setTrackNum]            = useState("");
  const [showFavorites,       setShowFavorites]       = useState(false);
  const [reviews, setReviews] = useState<{ rating: number; comment?: string; buyer_name: string; created_at: string }[]>([]);

  const router = useRouter();

  const cartCount     = useCartStore((s) => s.totalItems());
  const cartTotalCents = useCartStore((s) => s.totalCents());
  const favoriteIds    = useFavoritesStore((s) => s.ids);
  const favoritesCount = useFavoritesStore((s) => s.countForStore(store.slug));
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated());
  const user       = useAuthStore((s) => s.user);
  const logout     = useAuthStore((s) => s.logout);

  usePushSubscription(user?.email);
  const searchRef  = useRef<HTMLInputElement>(null);
  const color      = store.primary_color || "#2563EB";
  const openStatus = getOpenStatus(store.store_hours);
  const storeUrl   = `https://qtienda.shop/tienda/${store.slug}`;

  // Métodos de pago reales de la tienda — antes decía "Yape, Plin o efectivo"
  // fijo aunque el vendedor no los hubiera activado; ahora refleja lo que de
  // verdad va a ofrecer en el checkout.
  const enabledPaymentMethods = [
    store.settings?.accept_yape && "Yape",
    store.settings?.accept_plin && "Plin",
    store.settings?.accept_card && "tarjeta",
    store.settings?.accept_transfer && "transferencia",
    store.settings?.accept_cash && "efectivo",
  ].filter((m): m is string => !!m);
  const paymentMethodsLabel = enabledPaymentMethods.length > 0
    ? `Pago seguro por ${joinSpanish(enabledPaymentMethods)}`
    : "Pago seguro y directo con el vendedor";

  // Carrusel nuevo con fallback al banner único (compatibilidad con API vieja)
  const effectiveBanners = store.banners?.length
    ? store.banners
    : store.banner_url
    ? [{ url: store.banner_url, link: store.banner_link ?? null }]
    : [];

  /* Banner: parallax sutil al hacer scroll (estilo TEMU) */
  const { scrollY }   = useScroll();
  const bannerY       = useTransform(scrollY, [0, 200], [0, -28]);
  const bannerOpacity = useTransform(scrollY, [0, 180], [1, 0]);
  const bannerScale   = useTransform(scrollY, [0, 200], [1, 0.96]);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function dismissBuyerBanner() {
    setBuyerBannerDismissed(true);
    localStorage.setItem("qtienda_buyer_banner_dismissed", "1");
  }

  function dismissWelcomeBanner() {
    setWelcomeBannerDismissed(true);
    localStorage.setItem(`qtienda_welcome_banner_dismissed_${store.slug}`, "1");
  }

  function goTrack(e: React.FormEvent) {
    e.preventDefault();
    let num = trackNum.trim().toUpperCase();
    if (!num) return;
    // Acepta "42", "00042" o "QT-00042" — normaliza al formato QT-#####
    if (/^\d+$/.test(num)) num = `QT-${num.padStart(5, "0")}`;
    setTrackOpen(false);
    router.push(`/tienda/${store.slug}/pedido/${num}`);
  }

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("qtienda_buyer_banner_dismissed") === "1")
      setBuyerBannerDismissed(true);
    if (localStorage.getItem(`qtienda_welcome_banner_dismissed_${store.slug}`) === "1")
      setWelcomeBannerDismissed(true);
    // En pantallas grandes la grilla aprovecha mejor el espacio que la lista
    if (window.innerWidth >= 1024) setListView(false);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ¿El usuario logueado es el dueño de esta tienda? → barra de regreso al panel */
  useEffect(() => {
    if (!isLoggedIn || !user || (user.role !== "vendor" && user.role !== "admin")) return;
    apiClient
      .get("/stores/me")
      .then(({ data }) => setIsOwner(data?.slug === store.slug))
      .catch(() => {});
  }, [isLoggedIn, user, store.slug]);

  /* Analytics (QT-008) */
  useEffect(() => {
    trackStoreEvent(store.slug, "store_view");
  }, [store.slug]);

  useEffect(() => {
    if (viewProduct) {
      trackStoreEvent(store.slug, "product_view", viewProduct.id);
      pixelViewContent(viewProduct);
    }
  }, [viewProduct, store.slug]);

  // Abre la ficha directo si llegan por un link compartido (?p=productId)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("p");
    if (id) {
      const p = initialProducts.find((pr) => pr.id === id);
      if (p) setViewProduct(p);
    }
  }, [initialProducts]);

  useEffect(() => {
    if (cartOpen) {
      trackStoreEvent(store.slug, "checkout_start");
      pixelInitiateCheckout(cartTotalCents, cartCount);
    }
  }, [cartOpen, store.slug]);

  // Reseñas reales — solo se pide si la tienda ya tiene al menos una
  // (evita una llamada de red que siempre volvería vacía).
  useEffect(() => {
    if (!store.rating_count || store.rating_count === 0) return;
    apiClient
      .get(`/public/store/${store.slug}/reviews`)
      .then(({ data }) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [store.slug, store.rating_count]);

  // La grilla se re-anima entera en cada cambio de `search` (ver key del
  // AnimatePresence más abajo) — sin debounce, cada tecla tipeada dispara un
  // re-render/re-animación completa, se ve entrecortado en celulares lentos.
  // El input sigue leyendo `search` (respuesta instantánea al tipear); solo
  // el filtrado/animación esperan a que el usuario haga una pausa.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    let items = initialProducts;
    if (showFavorites) {
      items = items.filter((p) => favoriteIds.includes(`${store.slug}:${p.id}`));
    }
    if (activeCategory) items = items.filter((p) => p.category_id === activeCategory);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [initialProducts, activeCategory, debouncedSearch, showFavorites, favoriteIds, store.slug]);

  const featured        = initialProducts.filter((p) => p.is_featured).slice(0, 8);
  const hasCategories    = (store.categories?.length ?? 0) > 0;
  const isFiltering      = !!debouncedSearch || !!activeCategory || showFavorites;

  // Paginación de renderizado (no del fetch): el catálogo completo ya está en
  // memoria para que el filtro siga siendo instantáneo, pero una tienda con
  // cientos de productos no necesita pintar/cargar imágenes de todos a la vez.
  // Se resetea al lote inicial cada vez que cambia el filtro activo.
  const PRODUCTS_PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PRODUCTS_PAGE_SIZE);
  }, [activeCategory, debouncedSearch, showFavorites]);
  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMoreProducts = filtered.length > visibleCount;

  return (
    <div className="min-h-dvh" data-theme={store.theme || "clasico"} style={{ background: "var(--bg)" }}>

      {/* Franja de marca (color del vendedor) */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }}
      />

      <MarketingPixels
        tiktokPixelId={store.settings?.tiktok_pixel_id}
        metaPixelId={store.settings?.meta_pixel_id}
        googleAnalyticsId={store.settings?.google_analytics_id}
      />

      <FiestasPatriasFloatingBadge country={store.country} />

      {/* Barra de dueño: así el vendedor no se pierde al ver su tienda pública */}
      {mounted && isOwner && (
        <div style={{ background: "var(--ink)", color: "var(--bg)" }}>
          <div className="max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto flex items-center gap-3 px-4 py-2 lg:px-8">
            <span className="text-[11px] lg:text-xs font-medium flex-1 min-w-0 truncate">
              👀 Estás viendo tu tienda como la ven tus clientes
            </span>
            <a
              href="/dashboard/productos"
              className="flex-shrink-0 text-[11px] lg:text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,.16)", color: "var(--bg)" }}
            >
              + Productos
            </a>
            <a
              href="/dashboard"
              className="flex-shrink-0 text-[11px] lg:text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: "var(--bg)", color: "var(--ink)" }}
            >
              ← Volver al panel
            </a>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          STICKY HEADER (logo + search + categorías)
      ══════════════════════════════════ */}
      <header
        className="sticky top-0 z-30 transition-all duration-300"
        style={{
          background:           "color-mix(in srgb, var(--surface) 97%, transparent)",
          backdropFilter:       "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom:         `1px solid ${headerScrolled ? "var(--line)" : "transparent"}`,
          boxShadow:            headerScrolled ? "var(--shadow-md)" : "none",
        }}
      >
        <div className="max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto">

          {/* Row 1: logo + name (+ búsqueda inline en desktop) + actions */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-2 lg:px-8 lg:py-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              {store.logo_url ? (
                <Image src={store.logo_url} alt={store.name} width={36} height={36}
                  className="rounded-[12px] object-cover lg:w-11 lg:h-11" />
              ) : (
                <div
                  className="w-9 h-9 lg:w-11 lg:h-11 rounded-[12px] flex items-center justify-center font-bold text-sm lg:text-base text-white"
                  style={{ background: color }}
                >
                  {store.name[0]?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Store name */}
            <div className="flex-1 min-w-0 lg:flex-none lg:max-w-[280px]">
              <p className="font-bold text-sm lg:text-lg leading-tight truncate" style={{ color: "var(--ink)" }}>
                {store.name}
              </p>
              {(store.city || (mounted && openStatus)) && (
                <p className="flex items-center gap-1 text-[11px] lg:text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
                  {store.city && (
                    <>
                      <MapPin size={9} className="flex-shrink-0" /> {store.city}
                    </>
                  )}
                  {mounted && openStatus && (
                    <>
                      {store.city && <span>·</span>}
                      <span
                        className="flex items-center gap-1 font-bold flex-shrink-0"
                        style={{ color: openStatus.open ? "var(--success)" : "var(--ink-3)" }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: openStatus.open ? "var(--success)" : "var(--ink-4)" }}
                        />
                        {openStatus.label}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Búsqueda inline (solo desktop) */}
            <div className="hidden lg:block flex-1 max-w-xl mx-auto px-6">
              <SearchBox
                value={search}
                onChange={setSearch}
                focused={searchFocused}
                setFocused={setSearchFocused}
                color={color}
              />
            </div>

            {/* Ayuda: relanza el tour guiado de la tienda */}
            <button
              onClick={() => restartStoreTour()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}12` }}
              aria-label="Ver guía de la tienda"
            >
              <HelpCircle size={16} style={{ color }} />
            </button>

            {/* Compartir — abre el modal con el link y el QR de la tienda */}
            <button
              onClick={() => setQrOpen(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}12` }}
              aria-label="Compartir"
            >
              <Share2 size={16} style={{ color }} />
            </button>

            {/* Favoritos */}
            <button
              onClick={() => setShowFavorites((v) => !v)}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: showFavorites ? "var(--danger-soft)" : `${color}12` }}
              aria-label="Favoritos"
            >
              <Heart size={16} fill={showFavorites ? "var(--danger)" : "none"} style={{ color: showFavorites ? "var(--danger)" : color }} />
              {mounted && favoritesCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center"
                  style={{ background: "var(--danger)", border: "2px solid var(--surface)" }}
                >
                  {favoritesCount > 9 ? "9+" : favoritesCount}
                </span>
              )}
            </button>

            {/* Cuenta comprador */}
            {mounted && isLoggedIn && user && (
              <button
                onClick={() => setAccountOpen(true)}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white overflow-hidden flex-shrink-0"
                style={{ background: `${color}cc` }}
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt="" fill sizes="40px" className="object-cover" />
                ) : (
                  (user.full_name?.[0] ?? user.email[0]).toUpperCase()
                )}
              </button>
            )}

            {/* Cart */}
            <button
              id="tour-cart"
              onClick={() => setCartOpen(true)}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
              style={{ background: color }}
              aria-label="Ver carrito"
            >
              <ShoppingCart size={17} color="white" />
              <AnimatePresence>
                {mounted && cartCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full
                               text-white text-[10px] font-extrabold flex items-center justify-center"
                    style={{ background: "var(--danger)", border: "2px solid var(--surface)" }}
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Row 2: Search bar — solo móvil/tablet (en desktop va inline arriba) */}
          <div className="px-4 pb-2 lg:hidden">
            <SearchBox
              value={search}
              onChange={setSearch}
              focused={searchFocused}
              setFocused={setSearchFocused}
              color={color}
              inputRef={searchRef}
            />
          </div>

          {/* Row 3: Category chips — solo móvil/tablet (en desktop van al rail lateral) */}
          {hasCategories && (
            <div id="tour-categories" className="lg:hidden">
              <CategoryList store={store} activeCategory={activeCategory} setActiveCategory={setActiveCategory} color={color} />
            </div>
          )}
        </div>
      </header>

      {/* Franja de confianza */}
      <div className="border-b relative" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto flex items-center gap-5 overflow-x-auto scrollbar-hide px-4 py-2 lg:px-8">
          <button
            onClick={() => setTrackOpen(true)}
            className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full transition-all active:scale-95"
            style={{ background: `${color}10` }}
          >
            <PackageSearch size={13} style={{ color }} />
            <span className="text-[11px] font-bold whitespace-nowrap" style={{ color }}>
              Sigue tu pedido
            </span>
          </button>
          {[
            // Señales de confianza reales — nunca inventadas, y nunca se
            // muestran en "0"/sin dato (una tienda sin pedidos entregados o
            // sin reseñas aún no gana nada mostrando un cero). Van primero
            // y con más peso visual (pill de color) que los datos de
            // logística de abajo — son la prueba de que no es una estafa.
            ...(store.is_verified
              ? [{
                  key: "verified",
                  icon: ShieldCheck,
                  label: "Tienda verificada por Qtienda",
                  short: "Verificada",
                  bg: "var(--success-soft)", fg: "var(--success)",
                }]
              : []),
            ...(store.rating_count && store.rating_count > 0
              ? [{
                  key: "rating",
                  icon: Star,
                  label: `${store.rating_avg?.toFixed(1)} de calificación (${store.rating_count} reseña${store.rating_count !== 1 ? "s" : ""})`,
                  short: `${store.rating_avg?.toFixed(1)} ★ (${store.rating_count})`,
                  bg: "var(--warn-soft)", fg: "var(--warn)",
                }]
              : []),
            ...(store.orders_delivered_count && store.orders_delivered_count > 0
              ? [{
                  key: "trust",
                  icon: CheckCircle2,
                  label: `${store.orders_delivered_count} pedido${store.orders_delivered_count !== 1 ? "s" : ""} entregado${store.orders_delivered_count !== 1 ? "s" : ""}`,
                  short: `${store.orders_delivered_count} entregados`,
                  bg: `${color}14`, fg: color,
                }]
              : []),
            { key: "delivery", icon: Truck, label: "Coordinas la entrega con el vendedor", short: "Entrega coordinada" },
            { key: "payment", icon: ShieldCheck, label: paymentMethodsLabel, short: "Pago seguro" },
            { key: "whatsapp", icon: MessageCircle, label: "Atención directa por WhatsApp", short: "Atención por WhatsApp" },
          ].map(({ key, icon: Icon, label, short, bg, fg }) => (
            <div
              key={key}
              id={key === "payment" ? "tour-payment" : undefined}
              className="flex items-center gap-1.5 flex-shrink-0"
              style={bg ? { background: bg, borderRadius: 999, padding: "4px 10px" } : undefined}
            >
              <Icon size={13} style={{ color: fg ?? "var(--ink-3)" }} />
              <span className={`text-[11px] whitespace-nowrap lg:hidden ${bg ? "font-bold" : "font-medium"}`} style={{ color: fg ?? "var(--ink-3)" }}>{short}</span>
              <span className={`text-[11px] whitespace-nowrap hidden lg:inline ${bg ? "font-bold" : "font-medium"}`} style={{ color: fg ?? "var(--ink-3)" }}>{label}</span>
            </div>
          ))}
        </div>
        <div
          className="lg:hidden absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, var(--surface))" }}
        />
      </div>

      {/* ══════════════════════════════════
          BANNERS (PWA + buyer)
      ══════════════════════════════════ */}
      <AnimatePresence>
        {mounted && store.settings?.welcome_discount_enabled && !!store.settings?.welcome_discount_cents && !welcomeBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto lg:px-8"
            style={{ background: `${color}12`, borderBottom: `1px solid ${color}22` }}
          >
            <span className="text-lg flex-shrink-0">🎁</span>
            <p className="flex-1 text-xs font-bold leading-snug" style={{ color: "var(--ink)" }}>
              {formatPrice(store.settings.welcome_discount_cents)} de descuento en tu primera compra aquí
            </p>
            <button onClick={dismissWelcomeBanner}><X size={14} style={{ color: "var(--ink-4)" }} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mounted && installPrompt && !installDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto lg:px-8"
            style={{ background: `${color}10`, borderBottom: `1px solid ${color}18` }}
          >
            <span className="text-lg flex-shrink-0">📲</span>
            <p className="flex-1 text-xs font-medium" style={{ color: "var(--ink-2)" }}>
              Instala la tienda para acceso rápido
            </p>
            <button
              onClick={handleInstall}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
              style={{ background: color }}
            >
              <Download size={11} /> Instalar
            </button>
            <button onClick={() => { setInstallDismissed(true); localStorage.setItem("pwa-banner-dismissed", "1"); }}><X size={14} style={{ color: "var(--ink-4)" }} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mounted && !isLoggedIn && !buyerBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto lg:px-8"
            style={{ background: "var(--success-soft)", borderBottom: "1px solid var(--line-2)" }}
          >
            <span className="text-lg flex-shrink-0">🛍️</span>
            <p className="flex-1 text-xs font-medium leading-snug" style={{ color: "var(--success)" }}>
              ¿Compras aquí seguido? Crea una cuenta para ver tus pedidos
            </p>
            <a href="/registro"
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full text-white whitespace-nowrap"
              style={{ background: "var(--success)" }}>
              Crear cuenta
            </a>
            <button onClick={dismissBuyerBanner}><X size={14} style={{ color: "var(--ink-3)" }} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════
          LAYOUT: rail lateral (desktop) + contenido
      ══════════════════════════════════ */}
      <div className="max-w-xl md:max-w-3xl lg:max-w-[1360px] mx-auto lg:flex lg:items-start lg:gap-8 lg:px-8 lg:pt-6">

        {/* ── Rail lateral (solo desktop) ── */}
        <aside className="hidden lg:block flex-shrink-0 sticky top-[104px]" style={{ width: 264 }}>
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              {store.logo_url ? (
                <Image src={store.logo_url} alt={store.name} width={48} height={48} className="rounded-xl object-cover" />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg"
                  style={{ background: color }}
                >
                  {store.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight truncate" style={{ color: "var(--ink)" }}>{store.name}</p>
                {store.city && (
                  <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    <MapPin size={10} /> {store.city}
                  </p>
                )}
              </div>
            </div>
            {store.description && (
              <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--ink-2)" }}>
                {store.description}
              </p>
            )}
            {mounted && openStatus && (
              <div className="flex items-center gap-1.5 text-xs font-bold mb-3" style={{ color: openStatus.open ? "var(--success)" : "var(--ink-3)" }}>
                <Clock size={12} />
                {openStatus.label}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {store.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl"
                  style={{ background: "var(--success-soft)", color: "var(--success)" }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              )}
              <button
                onClick={() => setQrOpen(true)}
                className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
              >
                <Share2 size={13} /> Compartir tienda
              </button>
            </div>
            {(store.instagram || store.tiktok || store.facebook) && (
              <div className="pt-3 mt-3" style={{ borderTop: "1px solid var(--line)" }}>
                <SocialLinks store={store} size={30} />
              </div>
            )}
          </div>

          {hasCategories && (
            <div className="rounded-2xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <p className="eyebrow px-3 pt-1 pb-2">Categorías</p>
              <CategoryList store={store} activeCategory={activeCategory} setActiveCategory={setActiveCategory} color={color} vertical />
            </div>
          )}
        </aside>

        {/* ── Contenido principal ── */}
        <div className="flex-1 min-w-0">

          {/* Banners del vendedor (carrusel, se desliza al hacer scroll) — si no subió ninguno, degradado con su color real */}
          <motion.div
            className="px-4 pt-3 pb-1 lg:px-0 lg:pt-0"
            style={{ y: bannerY, opacity: bannerOpacity, scale: bannerScale }}
          >
            {effectiveBanners.length > 0 ? (
              <BannerCarousel banners={effectiveBanners} storeName={store.name} />
            ) : (
              <BannerPlaceholder storeName={store.name} logoUrl={store.logo_url} color={color} />
            )}
          </motion.div>

          {/* Descripción de la tienda (solo móvil/tablet — en desktop va en el rail) */}
          {store.description && (
            <div
              className="lg:hidden px-4 py-3 mt-1"
              style={{ background: `${color}07`, borderRadius: 16 }}
            >
              <p className="text-xs leading-snug" style={{ color: "var(--ink-2)" }}>
                {store.description}
              </p>
            </div>
          )}

          {/* Featured carousel */}
          <AnimatePresence>
            {featured.length > 0 && !isFiltering && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pt-3 pb-3 md:pb-5 lg:rounded-2xl lg:mt-5"
                style={{ background: `${color}07` }}
              >
                <div className="flex items-center gap-2 px-4 mb-2 lg:px-6">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: color }}
                  >
                    <Zap size={13} color="white" fill="white" />
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color }}>
                    Destacados
                  </span>
                </div>

                <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide lg:px-6">
                  {featured.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      storeColor={color}
                      storeSlug={store.slug}
                      featured
                      onTap={() => setViewProduct(p)}
                      onOpenCart={() => setCartOpen(true)}
                    />
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:px-0 lg:pt-6 lg:pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm lg:text-xl font-bold" style={{ color: "var(--ink)" }}>
                {showFavorites ? "Favoritos" : isFiltering ? "Resultados" : "Productos"}
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${color}15`, color }}
              >
                {filtered.length}
              </span>
            </div>

            {/* Layout toggle */}
            <div
              className="flex items-center rounded-xl p-0.5"
              style={{ background: "var(--surface-2)" }}
            >
              <button
                onClick={() => setListView(true)}
                className="flex items-center justify-center w-8 h-7 rounded-lg transition-all"
                style={{
                  background: listView ? "var(--surface)" : "transparent",
                  boxShadow:  listView ? "var(--shadow-sm)" : "none",
                  color:      listView ? "var(--ink)" : "var(--ink-3)",
                }}
                aria-label="Vista lista"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setListView(false)}
                className="flex items-center justify-center w-8 h-7 rounded-lg transition-all"
                style={{
                  background: !listView ? "var(--surface)" : "transparent",
                  boxShadow:  !listView ? "var(--shadow-sm)" : "none",
                  color:      !listView ? "var(--ink)" : "var(--ink-3)",
                }}
                aria-label="Vista cuadrícula"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>

          {/* Products */}
          <main className="px-4 pb-40 lg:px-0">
            <AnimatePresence mode="wait">
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-20 text-center"
                >
                  <div className="text-5xl mb-4">🔍</div>
                  <p className="font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
                    Sin resultados
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink-3)" }}>
                    Prueba con otro término o categoría
                  </p>
                  <button
                    onClick={() => { setSearch(""); setActiveCategory(null); }}
                    className="mt-4 text-xs font-bold px-4 py-2 rounded-full"
                    style={{ background: `${color}15`, color }}
                  >
                    Ver todo
                  </button>
                </motion.div>
              ) : listView ? (
                /* ── LISTA ── */
                <motion.div
                  key={`list-${activeCategory}-${debouncedSearch}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-2 xl:grid-cols-3"
                >
                  {visibleProducts.map((product, i) => (
                    <motion.div
                      key={product.id}
                      id={i === 0 ? "tour-product-1" : undefined}
                      className="h-full"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    >
                      <ProductCard
                        product={product}
                        storeColor={color}
                        storeSlug={store.slug}
                        compact
                        onTap={() => setViewProduct(product)}
                        onOpenCart={() => setCartOpen(true)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                /* ── GRID ── */
                <motion.div
                  key={`grid-${activeCategory}-${debouncedSearch}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4 xl:gap-5"
                >
                  {visibleProducts.map((product, i) => (
                    <motion.div
                      key={product.id}
                      id={i === 0 ? "tour-product-1" : undefined}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    >
                      <ProductCard
                        product={product}
                        storeColor={color}
                        storeSlug={store.slug}
                        onTap={() => setViewProduct(product)}
                        onOpenCart={() => setCartOpen(true)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {hasMoreProducts && (
              <div className="flex justify-center mt-5">
                <button
                  onClick={() => setVisibleCount((c) => c + PRODUCTS_PAGE_SIZE)}
                  className="text-sm font-bold px-5 py-2.5 rounded-full transition-all active:scale-95"
                  style={{ background: `${color}12`, color }}
                >
                  Ver más productos ({filtered.length - visibleCount} más)
                </button>
              </div>
            )}
          </main>

          {/* Reseñas reales de compradores — solo se muestra si hay al menos una */}
          {reviews.length > 0 && (
            <section className="px-4 pt-2 pb-6 lg:px-0">
              <div className="flex items-center gap-2 mb-3">
                <Star size={15} fill={color} style={{ color }} />
                <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                  {store.rating_avg?.toFixed(1)} · {store.rating_count} reseña{store.rating_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-2.5">
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-3.5"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold" style={{ color: "var(--ink)" }}>{r.buyer_name}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star
                            key={s}
                            size={11}
                            fill={s < r.rating ? "var(--warn)" : "none"}
                            style={{ color: s < r.rating ? "var(--warn)" : "var(--line-2)" }}
                          />
                        ))}
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-xs" style={{ color: "var(--ink-3)" }}>{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer con identidad de la tienda */}
          <footer className="px-4 pt-8 pb-6 lg:px-0" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="flex items-center gap-3 mb-4">
              {store.logo_url ? (
                <Image src={store.logo_url} alt={store.name} width={40} height={40}
                  className="rounded-xl object-cover" />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                  style={{ background: color }}
                >
                  {store.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm" style={{ color: "var(--ink)" }}>{store.name}</p>
                <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                  {[store.city, mounted && openStatus ? openStatus.label : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <button
                  id="tour-orderstatus"
                  onClick={() => setTrackOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full"
                  style={{ background: `${color}12`, color }}
                >
                  <PackageSearch size={13} /> Mi pedido
                </button>
                {store.whatsapp && (
                  <a
                    id="tour-whatsapp"
                    href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full"
                    style={{ background: "var(--success-soft)", color: "var(--success)" }}
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
              </div>
            </div>
            {(store.instagram || store.tiktok || store.facebook) && (
              <div className="flex justify-center pb-4">
                <SocialLinks store={store} />
              </div>
            )}
            <div className="flex justify-center items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>Powered by</span>
              <a href="https://qtienda.shop" target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/qtienda-wordmark.svg" alt="qtienda" style={{ height: 16, width: "auto", opacity: 0.4 }} />
              </a>
            </div>
          </footer>
        </div>
      </div>

      {/* ══════════════════════════════════
          STICKY CART CTA
      ══════════════════════════════════ */}
      <AnimatePresence>
        {mounted && cartCount > 0 && (
          <motion.div
            key="cart-cta"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="fixed bottom-0 left-0 right-0 px-4 z-20 max-w-xl mx-auto lg:max-w-sm lg:left-auto lg:right-8 lg:bottom-6"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between rounded-2xl px-5 py-4
                         text-white font-bold text-sm transition-all active:scale-[.98]"
              style={{ background: color, boxShadow: `0 8px 24px ${color}55` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold"
                  style={{ background: "rgba(255,255,255,.25)" }}
                >
                  {cartCount}
                </span>
                <span>Ver pedido</span>
              </div>
              <ChevronRight size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp flotante */}
      <AnimatePresence>
        {mounted && cartCount === 0 && store.whatsapp && (
          <motion.a
            key="wa-btn"
            href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ delay: 1.2, type: "spring", stiffness: 300 }}
            className="fixed bottom-6 right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,.5)" }}
            aria-label="Contactar por WhatsApp"
          >
            <MessageCircle size={26} fill="white" color="white" />
          </motion.a>
        )}
      </AnimatePresence>

      {/* Modal: seguimiento de pedido por número */}
      <AnimatePresence>
        {trackOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[59] flex items-center justify-center p-4"
            style={{ background: "rgba(20,19,15,.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setTrackOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl p-6 overflow-y-auto"
              style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", maxHeight: "85vh" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${color}12` }}
              >
                <PackageSearch size={22} style={{ color }} />
              </div>
              <h3 className="font-extrabold text-lg" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Sigue tu pedido
              </h3>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--ink-3)" }}>
                Ingresa el número que recibiste al confirmar tu compra (también está en el WhatsApp de la tienda).
              </p>
              <form onSubmit={goTrack}>
                <input
                  className="input"
                  placeholder="Ej: QT-00042"
                  value={trackNum}
                  onChange={(e) => setTrackNum(e.target.value)}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={!trackNum.trim()}
                  className="w-full mt-3 rounded-2xl py-3.5 font-bold text-sm text-white transition-all active:scale-[.98] disabled:opacity-40"
                  style={{ background: color }}
                >
                  Ver seguimiento
                </button>
              </form>
              <button
                onClick={() => setTrackOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-2)" }}
                aria-label="Cerrar"
              >
                <X size={15} style={{ color: "var(--ink-2)" }} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: compartir tienda (link + QR) */}
      <AnimatePresence>
        {qrOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[59] flex items-center justify-center p-4"
            style={{ background: "rgba(20,19,15,.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setQrOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl p-6 text-center overflow-y-auto"
              style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", maxHeight: "85vh" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                style={{ background: `${color}12` }}
              >
                <Share2 size={20} style={{ color }} />
              </div>
              <h3 className="font-extrabold text-lg" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Comparte {store.name}
              </h3>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--ink-3)" }}>
                Envía el link o comparte el QR para que te encuentren fácil.
              </p>
              <div
                className="inline-flex p-4 rounded-2xl mb-4"
                style={{ background: "#fff", border: "1px solid var(--line-2)" }}
              >
                <QRCodeCanvas value={storeUrl} size={180} marginSize={0} />
              </div>
              <button
                onClick={() => navigator.share?.({ title: store.name, url: storeUrl })}
                className="w-full rounded-2xl py-3.5 font-bold text-sm text-white transition-all active:scale-[.98] flex items-center justify-center gap-2"
                style={{ background: color }}
              >
                <Share2 size={15} /> Compartir link
              </button>
              <button
                onClick={() => setQrOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-2)" }}
                aria-label="Cerrar"
              >
                <X size={15} style={{ color: "var(--ink-2)" }} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} store={store as any} />

      {/* Tour de bienvenida para compradores */}
      <StoreTour storeSlug={store.slug} storeName={store.name} />

      {/* Panel cuenta comprador */}
      <AnimatePresence>
        {accountOpen && user && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[59]"
              style={{ background: "rgba(20,19,15,.45)" }}
              onClick={() => setAccountOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[60] max-w-xl mx-auto"
              style={{ background: "var(--surface)", borderRadius: "24px 24px 0 0", boxShadow: "var(--shadow-float)" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: "var(--line-2)" }} />
              </div>
              <div className="px-5 pt-3 pb-8" style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="relative w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0 overflow-hidden"
                    style={{ background: color }}
                  >
                    {user.avatar_url ? (
                      <Image src={user.avatar_url} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      (user.full_name?.[0] ?? user.email[0]).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight truncate" style={{ color: "var(--ink)" }}>
                      {user.full_name}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-3)" }}>{user.email}</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <a
                    href="/mis-pedidos"
                    className="flex items-center gap-3 w-full rounded-2xl px-4 py-3.5"
                    style={{ background: `${color}10`, border: `1.5px solid ${color}22` }}
                  >
                    <span className="text-xl">📦</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Mis pedidos</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>Ver historial en todas las tiendas</p>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--ink-4)" }} />
                  </a>
                  <button
                    onClick={() => { logout(); setAccountOpen(false); }}
                    className="flex items-center gap-3 w-full rounded-2xl px-4 py-3.5"
                    style={{ background: "var(--danger-soft)", border: "1.5px solid var(--line-2)" }}
                  >
                    <span className="text-xl">👋</span>
                    <p className="text-sm font-bold" style={{ color: "var(--danger)" }}>Cerrar sesión</p>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Ficha de producto */}
      <AnimatePresence>
        {viewProduct && (
          <ProductDetailSheet
            product={viewProduct}
            storeColor={color}
            storeSlug={store.slug}
            onClose={() => setViewProduct(null)}
            allProducts={initialProducts}
            onSelectRelated={(p) => setViewProduct(p as ProductData)}
            onOpenCart={() => setCartOpen(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
