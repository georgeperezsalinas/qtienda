"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ShoppingCart, Search, ChevronRight, Zap,
  MapPin, X, MessageCircle, Share2, Download,
  LayoutGrid, List,
} from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import ProductCard from "./ProductCard";
import ProductDetailSheet from "./ProductDetailSheet";
import CartDrawer from "./CartDrawer";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { trackStoreEvent } from "@/lib/storeAnalytics";

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
  categories?:   { id: string; name: string; icon?: string }[];
  whatsapp?:     string;
  meta_title?:   string;
}

interface ProductData {
  id:             string;
  name:           string;
  description?:   string;
  price_cents:    number;
  compare_price?: number;
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
        style={{ color: focused ? color : "#94A3B8" }}
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
          background: focused ? "#fff" : "#F1F5F9",
          border:     `1.5px solid ${focused ? color : "transparent"}`,
          boxShadow:  focused ? `0 0 0 3px ${color}18` : "none",
          color:      "#0F172A",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X size={14} style={{ color: "#94A3B8" }} />
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
        style={{ boxShadow: "0 2px 12px rgba(15,23,42,.08)" }}
      >
        {banners.map((b, i) => {
          // Solo http(s) o rutas internas: nunca javascript: en el href
          const link = b.link && /^(https?:\/\/|\/)/.test(b.link) ? b.link : undefined;
          const isExternal = !!link && link.startsWith("http") && !link.includes("qtienda.shop");
          const img = (
            <div className="relative w-full aspect-[3/1] md:aspect-[4/1]">
              <Image
                src={b.url}
                alt={`Banner ${i + 1} de ${storeName}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 1024px"
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

/* Estado abierto/cerrado a partir del horario configurado por el vendedor.
   Soporta horario nocturno (cierre <= apertura = cruza medianoche). */
function getOpenStatus(hours?: Record<string, { open: string; close: string }> | null) {
  if (!hours || Object.keys(hours).length === 0) return null;
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const today = hours[DAY_KEYS[now.getDay()]];
  const yesterday = hours[DAY_KEYS[(now.getDay() + 6) % 7]];

  // ¿Sigue abierto desde ayer? (horario que cruza medianoche)
  if (yesterday && toMin(yesterday.close) <= toMin(yesterday.open) && cur < toMin(yesterday.close)) {
    return { open: true, label: `Abierto · hasta ${yesterday.close}` };
  }
  if (today) {
    const open = toMin(today.open);
    const close = toMin(today.close);
    const overnight = close <= open;
    if (overnight ? cur >= open : cur >= open && cur < close) {
      return { open: true, label: `Abierto · hasta ${today.close}` };
    }
    if (cur < open) return { open: false, label: `Cerrado · abre ${today.open}` };
  }
  return { open: false, label: "Cerrado" };
}

/* ════════════════════════════════════════
   STORE PAGE
════════════════════════════════════════ */
export default function StorePage({ store, initialProducts }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
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

  const cartCount  = useCartStore((s) => s.totalItems());
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated());
  const user       = useAuthStore((s) => s.user);
  const logout     = useAuthStore((s) => s.logout);

  usePushSubscription(user?.email);
  const searchRef  = useRef<HTMLInputElement>(null);
  const color      = store.primary_color || "#2563EB";
  const openStatus = getOpenStatus(store.store_hours);

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

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("qtienda_buyer_banner_dismissed") === "1")
      setBuyerBannerDismissed(true);
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

  /* Analytics (QT-008) */
  useEffect(() => {
    trackStoreEvent(store.slug, "store_view");
  }, [store.slug]);

  useEffect(() => {
    if (viewProduct) trackStoreEvent(store.slug, "product_view", viewProduct.id);
  }, [viewProduct, store.slug]);

  useEffect(() => {
    if (cartOpen) trackStoreEvent(store.slug, "checkout_start");
  }, [cartOpen, store.slug]);

  const filtered = useMemo(() => {
    let items = initialProducts;
    if (activeCategory) items = items.filter((p) => p.category_id === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [initialProducts, activeCategory, search]);

  const featured     = initialProducts.filter((p) => p.is_featured).slice(0, 8);
  const hasCategories = (store.categories?.length ?? 0) > 0;
  const isFiltering   = !!search || !!activeCategory;

  return (
    <div className="min-h-dvh" style={{ background: "#F8FAFC" }}>

      {/* Franja de marca (color del vendedor) */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }}
      />

      {/* ══════════════════════════════════
          STICKY HEADER (logo + search + categorías)
      ══════════════════════════════════ */}
      <header
        className="sticky top-0 z-30 transition-all duration-300"
        style={{
          background:           "rgba(255,255,255,.97)",
          backdropFilter:       "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom:         `1px solid ${headerScrolled ? "#E2E8F0" : "transparent"}`,
          boxShadow:            headerScrolled ? "0 2px 16px rgba(15,23,42,.07)" : "none",
        }}
      >
        <div className="max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto">

          {/* Row 1: logo + name (+ búsqueda inline en desktop) + actions */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-2 lg:px-6 lg:py-3.5">
            {/* Logo */}
            <div className="flex-shrink-0">
              {store.logo_url ? (
                <Image src={store.logo_url} alt={store.name} width={36} height={36}
                  className="rounded-[12px] object-cover lg:w-10 lg:h-10" />
              ) : (
                <div
                  className="w-9 h-9 lg:w-10 lg:h-10 rounded-[12px] flex items-center justify-center font-bold text-sm text-white"
                  style={{ background: color }}
                >
                  {store.name[0]?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Store name */}
            <div className="flex-1 min-w-0 lg:flex-none lg:max-w-[300px]">
              <p className="font-bold text-sm lg:text-base leading-tight truncate" style={{ color: "#0F172A" }}>
                {store.name}
              </p>
              {(store.city || (mounted && openStatus)) && (
                <p className="flex items-center gap-1 text-[11px] mt-0.5 truncate" style={{ color: "#94A3B8" }}>
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
                        style={{ color: openStatus.open ? "#16A34A" : "#94A3B8" }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: openStatus.open ? "#22C55E" : "#CBD5E1" }}
                        />
                        {openStatus.label}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Búsqueda inline (solo desktop) */}
            <div className="hidden lg:block flex-1 max-w-xl mx-auto px-4">
              <SearchBox
                value={search}
                onChange={setSearch}
                focused={searchFocused}
                setFocused={setSearchFocused}
                color={color}
              />
            </div>

            {/* Share */}
            <button
              onClick={() => navigator.share?.({ title: store.name, url: location.href })}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${color}12` }}
              aria-label="Compartir"
            >
              <Share2 size={16} style={{ color }} />
            </button>

            {/* Cuenta comprador */}
            {mounted && isLoggedIn && user && (
              <button
                onClick={() => setAccountOpen(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white overflow-hidden"
                style={{ background: `${color}cc` }}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (user.full_name?.[0] ?? user.email[0]).toUpperCase()
                )}
              </button>
            )}

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
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
                    style={{ background: "#EF4444", border: "2px solid #fff" }}
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

          {/* Row 3: Category chips */}
          {hasCategories && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide lg:px-6">
              <button
                onClick={() => setActiveCategory(null)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
                style={
                  !activeCategory
                    ? { background: color, color: "#fff" }
                    : { background: "#F1F5F9", color: "#64748B" }
                }
              >
                Todo
              </button>
              {store.categories!.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={
                    activeCategory === cat.id
                      ? { background: color, color: "#fff" }
                      : { background: "#F1F5F9", color: "#64748B" }
                  }
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════
          BANNERS DEL VENDEDOR (carrusel, se desliza al hacer scroll)
      ══════════════════════════════════ */}
      {effectiveBanners.length > 0 && (
        <motion.div
          className="max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 pt-3 pb-1 lg:px-6 lg:pt-5"
          style={{ y: bannerY, opacity: bannerOpacity, scale: bannerScale }}
        >
          <BannerCarousel banners={effectiveBanners} storeName={store.name} />
        </motion.div>
      )}

      {/* ══════════════════════════════════
          BANNERS (PWA + buyer)
      ══════════════════════════════════ */}
      <AnimatePresence>
        {mounted && installPrompt && !installDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto"
            style={{ background: `${color}10`, borderBottom: `1px solid ${color}18` }}
          >
            <span className="text-lg flex-shrink-0">📲</span>
            <p className="flex-1 text-xs font-medium" style={{ color: "#475569" }}>
              Instala la tienda para acceso rápido
            </p>
            <button
              onClick={handleInstall}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white"
              style={{ background: color }}
            >
              <Download size={11} /> Instalar
            </button>
            <button onClick={() => { setInstallDismissed(true); localStorage.setItem("pwa-banner-dismissed", "1"); }}><X size={14} style={{ color: "#94A3B8" }} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mounted && !isLoggedIn && !buyerBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto"
            style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0" }}
          >
            <span className="text-lg flex-shrink-0">🛍️</span>
            <p className="flex-1 text-xs font-medium leading-snug" style={{ color: "#166534" }}>
              ¿Compras aquí seguido? Crea una cuenta para ver tus pedidos
            </p>
            <a href="/registro"
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full text-white whitespace-nowrap"
              style={{ background: "#16A34A" }}>
              Crear cuenta
            </a>
            <button onClick={dismissBuyerBanner}><X size={14} style={{ color: "#86EFAC" }} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Descripción de la tienda (si existe) */}
      {store.description && (
        <div
          className="max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 py-3"
          style={{ background: `${color}07`, borderBottom: `1px solid ${color}15` }}
        >
          <p className="text-xs leading-snug" style={{ color: "#475569" }}>
            {store.description}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════
          FEATURED CAROUSEL
      ══════════════════════════════════ */}
      <AnimatePresence>
        {featured.length > 0 && !isFiltering && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto pt-4 pb-5 lg:rounded-2xl lg:mt-3"
            style={{ background: `${color}07` }}
          >
            <div className="flex items-center gap-2 px-4 mb-3 lg:px-6">
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
                />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>


      {/* ══════════════════════════════════
          PRODUCT SECTION
      ══════════════════════════════════ */}
      <div className="max-w-xl mx-auto">

        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:px-6 lg:pt-6 lg:pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm lg:text-lg font-bold" style={{ color: "#0F172A" }}>
              {isFiltering ? "Resultados" : "Productos"}
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
            style={{ background: "#EEF2F6" }}
          >
            <button
              onClick={() => setListView(true)}
              className="flex items-center justify-center w-8 h-7 rounded-lg transition-all"
              style={{
                background: listView ? "#fff" : "transparent",
                boxShadow:  listView ? "0 1px 4px rgba(15,23,42,.1)" : "none",
                color:      listView ? "#0F172A" : "#94A3B8",
              }}
              aria-label="Vista lista"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setListView(false)}
              className="flex items-center justify-center w-8 h-7 rounded-lg transition-all"
              style={{
                background: !listView ? "#fff" : "transparent",
                boxShadow:  !listView ? "0 1px 4px rgba(15,23,42,.1)" : "none",
                color:      !listView ? "#0F172A" : "#94A3B8",
              }}
              aria-label="Vista cuadrícula"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {/* Products */}
        <main className="px-4 pb-40 lg:px-6">
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-20 text-center"
              >
                <div className="text-5xl mb-4">🔍</div>
                <p className="font-bold text-base mb-1" style={{ color: "#0F172A", fontFamily: "var(--font-display)" }}>
                  Sin resultados
                </p>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
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
                key={`list-${activeCategory}-${search}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3"
              >
                {filtered.map((product, i) => (
                  <motion.div
                    key={product.id}
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
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              /* ── GRID ── */
              <motion.div
                key={`grid-${activeCategory}-${search}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 xl:gap-5"
              >
                {filtered.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  >
                    <ProductCard
                      product={product}
                      storeColor={color}
                      storeSlug={store.slug}
                      onTap={() => setViewProduct(product)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer con identidad de la tienda */}
        <footer className="px-4 pt-8 pb-6 lg:px-6" style={{ borderTop: "1px solid #EEF2F6" }}>
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
              <p className="font-bold text-sm" style={{ color: "#0F172A" }}>{store.name}</p>
              <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                {[store.city, mounted && openStatus ? openStatus.label : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {store.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full flex-shrink-0"
                style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
          </div>
          <div className="flex justify-center items-center gap-2 pt-4" style={{ borderTop: "1px solid #F1F5F9" }}>
            <span className="text-[11px] font-medium" style={{ color: "#CBD5E1" }}>Powered by</span>
            <a href="https://qtienda.shop" target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/qtienda-wordmark.svg" alt="qtienda" style={{ height: 16, width: "auto", opacity: 0.4 }} />
            </a>
          </div>
        </footer>
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
            className="fixed bottom-0 left-0 right-0 px-4 z-20 max-w-xl mx-auto"
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

      {/* Cart drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} store={store as any} />

      {/* Panel cuenta comprador */}
      <AnimatePresence>
        {accountOpen && user && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[59]"
              style={{ background: "rgba(15,23,42,.45)" }}
              onClick={() => setAccountOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[60] max-w-xl mx-auto"
              style={{ background: "#fff", borderRadius: "24px 24px 0 0", boxShadow: "0 -8px 40px rgba(15,23,42,.18)" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pt-3 pb-8" style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0 overflow-hidden"
                    style={{ background: color }}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (user.full_name?.[0] ?? user.email[0]).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight truncate" style={{ color: "#0F172A" }}>
                      {user.full_name}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#94A3B8" }}>{user.email}</p>
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
                      <p className="text-sm font-bold" style={{ color: "#0F172A" }}>Mis pedidos</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Ver historial en todas las tiendas</p>
                    </div>
                    <ChevronRight size={16} style={{ color: "#CBD5E1" }} />
                  </a>
                  <button
                    onClick={() => { logout(); setAccountOpen(false); }}
                    className="flex items-center gap-3 w-full rounded-2xl px-4 py-3.5"
                    style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
                  >
                    <span className="text-xl">👋</span>
                    <p className="text-sm font-bold" style={{ color: "#DC2626" }}>Cerrar sesión</p>
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
