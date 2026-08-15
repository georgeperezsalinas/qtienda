"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Search, ChevronRight, Zap, Heart,
  MapPin, X, MessageCircle, Share2,
  LayoutGrid, List, Clock, Truck, ShieldCheck, PackageSearch,
  HelpCircle, CheckCircle2, Star, SlidersHorizontal, DoorOpen, Package, LogOut,
  Home, User,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import ProductCard from "./ProductCard";
import ProductDetailSheet from "./ProductDetailSheet";
import CartDrawer from "./CartDrawer";
import { SocialLinks } from "./SocialLinks";
import MarketingPixels from "./MarketingPixels";
import { pixelViewContent, pixelAddToCart, pixelInitiateCheckout } from "@/lib/marketingPixels";
import StoreTour, { restartStoreTour } from "./StoreTour";
import { useCartStore } from "@/store/cartStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useAuthStore } from "@/store/authStore";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { trackStoreEvent } from "@/lib/storeAnalytics";
import { apiClient } from "@/lib/api";
import { formatPrice, getStoreCurrency } from "@/lib/utils";
import { getOpenStatus } from "@/lib/storeHours";
import FiestasPatriasFloatingBadge from "@/components/ui/FiestasPatriasFloatingBadge";
import WheelWidget from "./WheelWidget";
import ClaimsModal from "./ClaimsModal";
import ServicesSection from "./ServicesSection";
import IdleRedirectOverlay from "./IdleRedirectOverlay";
import { useIdleRedirect } from "@/hooks/useIdleRedirect";
import Logo from "@/components/ui/Logo";
import PublicBottomNav from "@/components/ui/PublicBottomNav";
import CategoryFilterModal from "@/components/ui/CategoryFilterModal";

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

/* Lista de categorías: chips horizontales (móvil/tablet) o rail vertical
   (desktop) — multi-select: se puede filtrar por más de una a la vez. */
function CategoryList({ store, activeCategory, setActiveCategory, color, vertical }: {
  store: StoreData;
  activeCategory: string[];
  setActiveCategory: (v: string[]) => void;
  color: string;
  vertical?: boolean;
}) {
  if (!store.categories?.length) return null;
  function toggle(id: string) {
    setActiveCategory(activeCategory.includes(id) ? activeCategory.filter((c) => c !== id) : [...activeCategory, id]);
  }
  if (vertical) {
    return (
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => setActiveCategory([])}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
          style={
            activeCategory.length === 0
              ? { background: color, color: "#fff" }
              : { background: "transparent", color: "var(--ink-2)" }
          }
        >
          Todo
        </button>
        {store.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => toggle(cat.id)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
            style={
              activeCategory.includes(cat.id)
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
          onClick={() => setActiveCategory([])}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
          style={
            activeCategory.length === 0
              ? { background: color, color: "#fff" }
              : { background: "var(--surface-2)", color: "var(--ink-2)" }
          }
        >
          Todo
        </button>
        {store.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => toggle(cat.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
            style={
              activeCategory.includes(cat.id)
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

/* ════════════════════════════════════════
   STORE PAGE
════════════════════════════════════════ */
export default function StorePage({ store, initialProducts }: Props) {
  const { code: storeCurrency, locale: storeLocale } = getStoreCurrency(store);
  const [activeCategory, setActiveCategory] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [search,         setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cartOpen,       setCartOpen]       = useState(false);
  const [mounted,        setMounted]        = useState(false);
  const [searchFocused,  setSearchFocused]  = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [viewProduct,    setViewProduct]    = useState<ProductData | null>(null);
  const [listView,       setListView]       = useState(true);
  const [accountOpen,    setAccountOpen]    = useState(false);
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const [isOwner,             setIsOwner]             = useState(false);
  const [trackOpen,           setTrackOpen]           = useState(false);
  const [qrOpen,              setQrOpen]              = useState(false);
  const [trackNum,            setTrackNum]            = useState("");
  const [showFavorites,       setShowFavorites]       = useState(false);
  const [reviews, setReviews] = useState<{ rating: number; comment?: string; photo_urls?: string[]; buyer_name: string; created_at: string }[]>([]);
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState<string | null>(null);

  // Orden + rango de precio — filtrado 100% en cliente, igual que categoría/
  // búsqueda: el catálogo completo ya vive en memoria (ver comentario en
  // PRODUCTS_PAGE_SIZE más abajo), así que no hace falta ida y vuelta al
  // backend para reordenar o acotar un rango.
  const [sortBy,         setSortBy]         = useState<"default" | "price_asc" | "price_desc">("default");
  const [priceFilterOpen,setPriceFilterOpen] = useState(false);
  const [priceMinInput,  setPriceMinInput]  = useState("");
  const [priceMaxInput,  setPriceMaxInput]  = useState("");
  const [priceMin,       setPriceMin]       = useState<number | null>(null);
  const [priceMax,       setPriceMax]       = useState<number | null>(null);

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
  const storeUrl   = `https://${store.slug}.qtienda.shop/`;

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
    router.push(`/pedido/${num}`);
  }

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(`qtienda_welcome_banner_dismissed_${store.slug}`) === "1")
      setWelcomeBannerDismissed(true);
    // En pantallas grandes la grilla aprovecha mejor el espacio que la lista
    if (window.innerWidth >= 1024) setListView(false);
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

  // Sin actividad por un rato → avisa con cuenta regresiva y vuelve a la
  // puerta. Pausado mientras haya algo abierto (carrito, producto, cuenta,
  // QR, filtro de precio, seguimiento de pedido) para no interrumpir nunca
  // a alguien que está activamente mirando o comprando.
  const idleRedirect = useIdleRedirect({
    idleMs: 3 * 60_000,
    warningMs: 15_000,
    paused: cartOpen || !!viewProduct || accountOpen || qrOpen || trackOpen || priceFilterOpen,
    onRedirect: () => router.push("/"),
  });

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
    if (activeCategory.length > 0) items = items.filter((p) => p.category_id && activeCategory.includes(p.category_id));
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    if (priceMin != null) items = items.filter((p) => p.price_cents >= priceMin);
    if (priceMax != null) items = items.filter((p) => p.price_cents <= priceMax);
    if (sortBy === "price_asc") items = [...items].sort((a, b) => a.price_cents - b.price_cents);
    else if (sortBy === "price_desc") items = [...items].sort((a, b) => b.price_cents - a.price_cents);
    return items;
  }, [initialProducts, activeCategory, debouncedSearch, showFavorites, favoriteIds, store.slug, priceMin, priceMax, sortBy]);

  const featured        = initialProducts.filter((p) => p.is_featured).slice(0, 8);
  const hasCategories    = (store.categories?.length ?? 0) > 0;
  const hasPriceFilter   = priceMin != null || priceMax != null;
  const isFiltering      = !!debouncedSearch || activeCategory.length > 0 || showFavorites || hasPriceFilter;

  function clearAllFilters() {
    setSearch("");
    setActiveCategory([]);
    setPriceMin(null);
    setPriceMax(null);
    setPriceMinInput("");
    setPriceMaxInput("");
    setSortBy("default");
  }

  // Paginación de renderizado (no del fetch): el catálogo completo ya está en
  // memoria para que el filtro siga siendo instantáneo, pero una tienda con
  // cientos de productos no necesita pintar/cargar imágenes de todos a la vez.
  // Se resetea al lote inicial cada vez que cambia el filtro activo.
  const PRODUCTS_PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PRODUCTS_PAGE_SIZE);
  }, [activeCategory, debouncedSearch, showFavorites, priceMin, priceMax, sortBy]);
  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMoreProducts = filtered.length > visibleCount;

  return (
    <div className="min-h-dvh pb-16 md:pb-0" data-theme={store.theme || "clasico"} style={{ background: "var(--bg)" }}>

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
      <WheelWidget slug={store.slug} accentColor={color} />

      <IdleRedirectOverlay
        visible={idleRedirect.warning}
        secondsLeft={idleRedirect.secondsLeft}
        totalSeconds={15}
        accentColor={color}
        onStay={idleRedirect.stay}
      />

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
            {/* Logo — vuelve a la puerta de la tienda (salir del catálogo) */}
            <a href="/" className="flex-shrink-0" aria-label="Salir al inicio de la tienda">
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
            </a>

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

            {/* Salir de la tienda — vuelve a la puerta (ruleta, cupón, sobre nosotros) */}
            <a
              href="/"
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}12` }}
              aria-label="Salir de la tienda"
              title="Salir de la tienda"
            >
              <DoorOpen size={16} style={{ color }} />
            </a>

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
          AVISO FLOTANTE de descuento de bienvenida — no empuja el contenido.
          Instalar/crear cuenta ahora viven en la puerta (StoreDoor), donde
          tiene más sentido pedirlo antes de entrar a comprar.
      ══════════════════════════════════ */}
      <div className="fixed top-20 right-3 z-30 flex flex-col gap-2 w-[calc(100vw-24px)] max-w-[300px] pointer-events-none lg:top-24 lg:right-6">
        <AnimatePresence>
          {mounted && store.settings?.welcome_discount_enabled && !!store.settings?.welcome_discount_cents && !welcomeBannerDismissed && (
            <motion.div
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
              className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-3 rounded-2xl"
              style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", border: `1px solid ${color}25` }}
            >
              <span className="text-lg flex-shrink-0">🎁</span>
              <p className="flex-1 text-xs font-bold leading-snug" style={{ color: "var(--ink)" }}>
                {formatPrice(store.settings.welcome_discount_cents, storeCurrency, storeLocale)} de descuento en tu primera compra aquí
              </p>
              <button onClick={dismissWelcomeBanner} className="flex-shrink-0"><X size={14} style={{ color: "var(--ink-4)" }} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
        <div id="tienda-catalogo" className="flex-1 min-w-0 scroll-mt-24">

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

          {/* Servicios con cita — solo aparece si la tienda tiene alguno activo */}
          <ServicesSection
            storeSlug={store.slug}
            accentColor={color}
            storeCurrency={storeCurrency}
            storeLocale={storeLocale}
          />

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
                      storeCurrency={storeCurrency}
                      storeLocale={storeLocale}
                      featured
                      onTap={() => setViewProduct(p)}
                      onOpenCart={() => setCartOpen(true)}
                    />
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Orden + rango de precio */}
          {initialProducts.length > 3 && (
            <div className="flex items-center gap-2 px-4 pt-3 lg:px-0 lg:pt-4">
              <div className="relative">
                <button
                  onClick={() => setPriceFilterOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all"
                  style={{
                    background: hasPriceFilter ? `${color}15` : "var(--surface-2)",
                    color:      hasPriceFilter ? color : "var(--ink-2)",
                  }}
                >
                  <SlidersHorizontal size={12} />
                  {hasPriceFilter
                    ? `${priceMin != null ? formatPrice(priceMin, storeCurrency, storeLocale) : "0"} – ${priceMax != null ? formatPrice(priceMax, storeCurrency, storeLocale) : "∞"}`
                    : "Precio"}
                </button>
                {priceFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPriceFilterOpen(false)} />
                    <div
                      className="absolute z-50 top-full left-0 mt-2 w-64 rounded-2xl p-4"
                      style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", border: "1px solid var(--line)" }}
                    >
                      <p className="text-xs font-bold mb-3" style={{ color: "var(--ink)" }}>Rango de precio</p>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="number"
                          min={0}
                          inputMode="decimal"
                          placeholder="Desde"
                          value={priceMinInput}
                          onChange={(e) => setPriceMinInput(e.target.value)}
                          className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}
                        />
                        <span style={{ color: "var(--ink-4)" }}>–</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="decimal"
                          placeholder="Hasta"
                          value={priceMaxInput}
                          onChange={(e) => setPriceMaxInput(e.target.value)}
                          className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--line-2)", color: "var(--ink)" }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const min = priceMinInput ? Math.round(parseFloat(priceMinInput) * 100) : null;
                            const max = priceMaxInput ? Math.round(parseFloat(priceMaxInput) * 100) : null;
                            setPriceMin(min != null && !isNaN(min) ? min : null);
                            setPriceMax(max != null && !isNaN(max) ? max : null);
                            setPriceFilterOpen(false);
                          }}
                          className="flex-1 text-xs font-bold py-2 rounded-xl text-white"
                          style={{ background: color }}
                        >
                          Aplicar
                        </button>
                        <button
                          onClick={() => {
                            setPriceMinInput("");
                            setPriceMaxInput("");
                            setPriceMin(null);
                            setPriceMax(null);
                          }}
                          className="text-xs font-bold py-2 px-3 rounded-xl"
                          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-[11px] font-bold pl-3 pr-2 py-1.5 rounded-full outline-none"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "none" }}
                aria-label="Ordenar productos"
              >
                <option value="default">Recomendado</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
              </select>
            </div>
          )}

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pt-2 pb-2 lg:px-0 lg:pt-3 lg:pb-4">
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
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `${color}12` }}>
                    <Search size={26} style={{ color }} />
                  </div>
                  <p className="font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
                    Sin resultados
                  </p>
                  <p className="text-sm" style={{ color: "var(--ink-3)" }}>
                    Prueba con otro término, categoría o rango de precio
                  </p>
                  <button
                    onClick={clearAllFilters}
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
                        storeCurrency={storeCurrency}
                        storeLocale={storeLocale}
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
                        storeCurrency={storeCurrency}
                        storeLocale={storeLocale}
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
                    {r.photo_urls && r.photo_urls.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {r.photo_urls.map((url, pi) => (
                          <button
                            key={pi}
                            type="button"
                            onClick={() => setReviewPhotoPreview(url)}
                            className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                            style={{ border: "1px solid var(--line)" }}
                          >
                            <img src={url} alt="Foto de la reseña" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {reviewPhotoPreview && (
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,.92)" }}
              onClick={() => setReviewPhotoPreview(null)}
            >
              <img
                src={reviewPhotoPreview}
                alt="Foto de la reseña"
                className="max-w-full max-h-full object-contain rounded-lg"
                style={{ maxHeight: "90dvh" }}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => setReviewPhotoPreview(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.15)" }}
                aria-label="Cerrar"
              >
                <X size={20} color="white" />
              </button>
            </div>
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
            {/* Sobre esta tienda — descripción, rubros y redes juntas, no
                solo íconos sueltos, para que aporte confianza real al final
                del recorrido (no compite por espacio con el banner de arriba) */}
            {(store.description || hasCategories || store.instagram || store.tiktok || store.facebook) && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface-2)" }}>
                <p className="eyebrow mb-2">Sobre esta tienda</p>
                {store.description && (
                  <p className="text-xs leading-relaxed mb-2.5" style={{ color: "var(--ink-2)" }}>
                    {store.description}
                  </p>
                )}
                {hasCategories && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {store.categories!.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: "var(--surface)", color: "var(--ink-2)" }}
                      >
                        {c.icon} {c.name}
                      </span>
                    ))}
                  </div>
                )}
                {(store.instagram || store.tiktok || store.facebook) && (
                  <div className="flex items-center gap-2 pt-1">
                    <SocialLinks store={store} size={34} />
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-center items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="text-[11px] font-medium" style={{ color: "var(--ink-4)" }}>Powered by</span>
              <a href="https://qtienda.shop" target="_blank" rel="noopener noreferrer">
                <span style={{ opacity: 0.55 }}>
                  <Logo size="sm" href={null} />
                </span>
              </a>
            </div>
            <div className="flex justify-center pt-3">
              <ClaimsModal slug={store.slug} accentColor={color} />
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
            className="fixed bottom-[76px] md:bottom-6 left-0 right-0 px-4 z-20 max-w-xl mx-auto lg:max-w-sm lg:left-auto lg:right-8"
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
            className="fixed bottom-[92px] md:bottom-6 right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,.5)" }}
            aria-label="Contactar por WhatsApp"
          >
            <MessageCircle size={26} fill="white" color="white" />
          </motion.a>
        )}
      </AnimatePresence>

      {/* Barra inferior — accesos directos de una tienda pública, antes
          inexistente (solo estaba el CTA de carrito y el de WhatsApp). */}
      {mounted && (
        <PublicBottomNav
          accentColor={color}
          items={[
            { key: "inicio", icon: Home, label: "Inicio", href: "/" },
            {
              key: "categorias",
              icon: LayoutGrid,
              label: "Categorías",
              active: activeCategory.length > 0,
              badge: activeCategory.length > 0 ? activeCategory.length : undefined,
              onClick: () => hasCategories && setShowCategoryModal(true),
            },
            {
              key: "carrito",
              icon: ShoppingCart,
              label: "Carrito",
              active: cartOpen,
              badge: cartCount > 0 ? cartCount : undefined,
              onClick: () => setCartOpen(true),
            },
            {
              key: "cuenta",
              icon: User,
              label: "Cuenta",
              active: accountOpen,
              onClick: () => (isLoggedIn && user ? setAccountOpen(true) : router.push("/mis-pedidos")),
            },
          ]}
        />
      )}

      {showCategoryModal && (
        <CategoryFilterModal
          title="Categorías"
          accentColor={color}
          options={(store.categories ?? []).map((c) => ({ key: c.id, label: c.name, icon: c.icon }))}
          selected={activeCategory}
          onApply={(next) => { setActiveCategory(next); setShowCategoryModal(false); }}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

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
                    <Package size={18} style={{ color }} />
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
                    <LogOut size={18} style={{ color: "var(--danger)" }} />
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
            storeCurrency={storeCurrency}
            storeLocale={storeLocale}
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
