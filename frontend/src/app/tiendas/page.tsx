"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Store, ChevronRight, ChevronLeft, MapPin, ArrowLeft, Package, Clock, Sparkles, ShoppingBag, ShieldCheck, Star, Loader2, CalendarClock } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { getOpenStatus } from "@/lib/storeHours";
import { trackPageView } from "@/lib/siteAnalytics";
import { formatPrice, getStoreCurrency } from "@/lib/utils";
import MallInstallLink from "@/components/ui/MallInstallLink";
import FiestasPatriasFloatingBadge from "@/components/ui/FiestasPatriasFloatingBadge";

interface StoreCard {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  city?: string;
  primary_color?: string;
  product_count?: number;
  categories?: string[];
  store_hours?: Record<string, { open: string; close: string }> | null;
  is_verified?: boolean;
  rating_avg?: number | null;
  rating_count?: number;
  service_count?: number;
}

interface MallCategoryItem {
  slug: string;
  label: string;
  icon: string | null;
  store_count: number;
}

interface CityItem {
  city: string;
  count: number;
}

// Chip de confianza real — nunca se muestra si no hay dato real detrás
// (0 reseñas no muestra estrellas, no-verificada no muestra insignia).
function TrustChips({ store }: { store: StoreCard }) {
  if (!store.is_verified && !(store.rating_count && store.rating_count > 0)) return null;
  return (
    <>
      {store.is_verified && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "var(--success-soft)", color: "var(--success)" }}
        >
          <ShieldCheck size={9} />
          Verificada
        </span>
      )}
      {!!store.rating_count && store.rating_count > 0 && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <Star size={9} fill="currentColor" />
          {store.rating_avg?.toFixed(1)} ({store.rating_count})
        </span>
      )}
    </>
  );
}

interface LatestProduct {
  id: string;
  name: string;
  price_cents: number;
  image_url?: string;
  store_slug: string;
  store_name: string;
  store_city?: string;
  store_logo_url?: string;
  primary_color?: string;
  store_country?: string;
  store_currency?: string;
}

interface LatestService {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents?: number | null;
  image_url?: string | null;
  store_slug: string;
  store_name: string;
  store_city?: string;
  store_logo_url?: string;
  primary_color?: string;
  store_country?: string;
  store_currency?: string;
}

type SortMode = "recent" | "az";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Fila horizontal con flechas para avanzar/retroceder en desktop — en
// celular ya se puede deslizar con el dedo, pero con mouse no hay forma
// de saber que se puede scrollear ni de moverse sin ellas.
function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function update() {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  function scroll(dir: number) {
    ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div ref={ref} className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
        {children}
      </div>
      {canLeft && (
        <button
          onClick={() => scroll(-1)}
          aria-label="Anterior"
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full items-center justify-center z-10"
          style={{ background: "var(--surface)", boxShadow: "0 2px 10px rgba(20,19,15,.18)", border: "1px solid var(--line)" }}
        >
          <ChevronLeft size={16} style={{ color: "var(--ink-2)" }} />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scroll(1)}
          aria-label="Siguiente"
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full items-center justify-center z-10"
          style={{ background: "var(--surface)", boxShadow: "0 2px 10px rgba(20,19,15,.18)", border: "1px solid var(--line)" }}
        >
          <ChevronRight size={16} style={{ color: "var(--ink-2)" }} />
        </button>
      )}
    </div>
  );
}

interface DynamicBanner {
  id: string;
  image_url: string;
  link_url: string | null;
}

type BannerSlide =
  | {
      kind: "text";
      icon: React.ElementType;
      title: string;
      body: string;
      gradient: string;
      cta?: { label: string; href: string };
      showInstallLink?: boolean;
    }
  | { kind: "image"; imageUrl: string; linkUrl: string | null };

const BANNER_ROTATE_MS = 6000;

// Banner rotatorio del Mall: el primer slide (bienvenida + instalar PWA) es
// fijo — tiene lógica real de detección de navegador, no tiene sentido
// convertirlo en imagen. Los demás vienen de /admin/mall-banners; si todavía
// no hay ninguno configurado, se muestra un slide de texto genérico
// invitando a crear tienda (nunca queda el carrusel con un solo slide mudo).
function MallBannerCarousel() {
  const [dynamicBanners, setDynamicBanners] = useState<DynamicBanner[]>([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/mall-banners`)
      .then((r) => r.json())
      .then((data) => setDynamicBanners(Array.isArray(data) ? data : []))
      .catch(() => setDynamicBanners([]))
      .finally(() => setBannersLoaded(true));
  }, []);

  const slides: BannerSlide[] = useMemo(() => {
    const base: BannerSlide[] = [
      {
        kind: "text",
        icon: ShoppingBag,
        title: "Mall qtienda",
        body: "Un solo lugar para conocer todas las tiendas y sus productos.",
        gradient: "linear-gradient(120deg, var(--accent), var(--accent-soft))",
        showInstallLink: true,
      },
    ];
    if (dynamicBanners.length > 0) {
      dynamicBanners.forEach((b) => {
        base.push({ kind: "image", imageUrl: b.image_url, linkUrl: b.link_url });
      });
    } else if (bannersLoaded) {
      base.push({
        kind: "text",
        icon: Store,
        title: "¿Vendes por TikTok? 🚀",
        body: "Crea tu tienda gratis en 2 minutos — sin tarjeta, sin pasos técnicos.",
        gradient: "linear-gradient(120deg, #7C3AED, #A78BFA)",
        cta: { label: "Crear mi tienda", href: "/auth/register" },
      });
    }
    return base;
  }, [dynamicBanners, bannersLoaded]);

  const [index, setIndex] = useState(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), BANNER_ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 40) setIndex((i) => (i + 1) % slides.length);
    else if (delta < -40) setIndex((i) => (i - 1 + slides.length) % slides.length);
  }

  const slide = slides[index];
  if (!slide) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{ border: "1px solid var(--line)" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.25 }}
        >
          {slide.kind === "image" ? (
            (() => {
              // Solo http(s) o rutas internas: nunca javascript: en el href
              // (mismo criterio que el carrusel de banners de cada tienda).
              const link = slide.linkUrl && /^(https?:\/\/|\/)/.test(slide.linkUrl) ? slide.linkUrl : undefined;
              const isExternal = !!link && link.startsWith("http") && !link.includes("qtienda.shop");
              // 4:1 fijo (sin variante lg) — coincide exacto con el tamaño
              // recomendado (1600×400) para que no haya recorte extra.
              const img = (
                <div className="relative w-full aspect-[4/1]">
                  <Image
                    src={slide.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 1360px"
                    className="object-cover"
                  />
                </div>
              );
              return link ? (
                <a
                  href={link}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="block active:scale-[.99] transition-transform"
                  aria-label="Promoción"
                >
                  {img}
                </a>
              ) : (
                img
              );
            })()
          ) : (
            <div className="flex items-center gap-4 p-5" style={{ background: slide.gradient }}>
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,.2)" }}
              >
                <slide.icon size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-extrabold text-base leading-tight text-white">{slide.title}</p>
                <p className="text-xs mt-0.5 text-white/85">{slide.body}</p>
                {slide.cta ? (
                  <Link
                    href={slide.cta.href}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-bold px-3 py-1.5 rounded-full text-white"
                    style={{ background: "rgba(255,255,255,.22)", border: "1px solid rgba(255,255,255,.4)" }}
                  >
                    {slide.cta.label} <ChevronRight size={12} />
                  </Link>
                ) : slide.showInstallLink ? (
                  <MallInstallLink />
                ) : null}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2" style={{ background: "var(--surface)" }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir al slide ${i + 1}`}
              className="rounded-full transition-all"
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                background: i === index ? "var(--accent)" : "var(--line-2)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STORES_PAGE_SIZE = 24;

export default function TiendasPage() {
  const router = useRouter();
  // Historial real, no un destino adivinado por rol — la página se abre
  // desde el dashboard de un vendedor, la puerta de una tienda, la landing,
  // o un link externo, y antes esta flecha mandaba a todos a /mis-pedidos o
  // "/" según si había sesión, sin importar de dónde venían (confundía
  // sobre todo a vendedores logueados, que terminaban en una pantalla de
  // comprador). Sin historial de esta pestaña (link directo, bookmark), cae
  // a la home.
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [storesTotal, setStoresTotal] = useState(0);
  const [storesPage, setStoresPage] = useState(1);
  const [storesPages, setStoresPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mallCategories, setMallCategories] = useState<MallCategoryItem[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [latestProducts, setLatestProducts] = useState<LatestProduct[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<LatestProduct[]>([]);
  const [categoryProductsLoading, setCategoryProductsLoading] = useState(false);
  const [latestServices, setLatestServices] = useState<LatestService[]>([]);
  const [categoryServices, setCategoryServices] = useState<LatestService[]>([]);
  const [categoryServicesLoading, setCategoryServicesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    setMounted(true);
    trackPageView("/tiendas");
    // Departamentos fijos del Mall y ciudades: agregados en el backend sobre
    // TODO el directorio real (no derivado de la página de tiendas cargada),
    // para que sigan siendo correctos aunque existan miles de tiendas.
    fetch(`${API}/public/mall-categories`)
      .then((r) => r.json())
      .then((data) => setMallCategories(Array.isArray(data) ? data : []))
      .catch(() => setMallCategories([]));
    fetch(`${API}/public/store-cities`)
      .then((r) => r.json())
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
    fetch(`${API}/public/latest-products?limit=24`)
      .then((r) => r.json())
      .then((data) => setLatestProducts(Array.isArray(data) ? data : []))
      .catch(() => setLatestProducts([]));
    fetch(`${API}/public/latest-services?limit=24`)
      .then((r) => r.json())
      .then((data) => setLatestServices(Array.isArray(data) ? data : []))
      .catch(() => setLatestServices([]));
  }, []);

  // Búsqueda con debounce — evita una consulta al servidor por cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Directorio de tiendas paginado en el servidor — se recarga desde la
  // página 1 cuando cambia búsqueda/ciudad/departamento/orden.
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: String(STORES_PAGE_SIZE) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (cityFilter) params.set("city", cityFilter);
    if (categoryFilter) params.set("mall_category", categoryFilter);
    if (sort === "az") params.set("sort", "az");
    fetch(`${API}/public/stores?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setStores(Array.isArray(data?.items) ? data.items : []);
        setStoresTotal(data?.total ?? 0);
        setStoresPages(data?.pages ?? 1);
        setStoresPage(1);
      })
      .catch(() => {
        setStores([]);
        setStoresTotal(0);
        setStoresPages(1);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, cityFilter, categoryFilter, sort]);

  async function loadMoreStores() {
    if (loadingMore || storesPage >= storesPages) return;
    setLoadingMore(true);
    const nextPage = storesPage + 1;
    const params = new URLSearchParams({ page: String(nextPage), limit: String(STORES_PAGE_SIZE) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (cityFilter) params.set("city", cityFilter);
    if (categoryFilter) params.set("mall_category", categoryFilter);
    if (sort === "az") params.set("sort", "az");
    try {
      const res = await fetch(`${API}/public/stores?${params}`);
      const data = await res.json();
      setStores((prev) => [...prev, ...(Array.isArray(data?.items) ? data.items : [])]);
      setStoresPage(nextPage);
    } catch {
      /* silencioso — el botón sigue disponible para reintentar */
    } finally {
      setLoadingMore(false);
    }
  }

  // Al elegir un departamento, además de filtrar la lista de tiendas se
  // muestra un mosaico de sus productos reales (no solo el nombre de la tienda).
  useEffect(() => {
    if (!categoryFilter) {
      setCategoryProducts([]);
      setCategoryServices([]);
      return;
    }
    setCategoryProductsLoading(true);
    fetch(`${API}/public/latest-products?mall_category=${encodeURIComponent(categoryFilter)}&limit=24`)
      .then((r) => r.json())
      .then((data) => setCategoryProducts(Array.isArray(data) ? data : []))
      .catch(() => setCategoryProducts([]))
      .finally(() => setCategoryProductsLoading(false));
    setCategoryServicesLoading(true);
    fetch(`${API}/public/latest-services?mall_category=${encodeURIComponent(categoryFilter)}&limit=24`)
      .then((r) => r.json())
      .then((data) => setCategoryServices(Array.isArray(data) ? data : []))
      .catch(() => setCategoryServices([]))
      .finally(() => setCategoryServicesLoading(false));
  }, [categoryFilter]);

  // Destacadas: las tiendas con más catálogo activo dentro de la página actual — vitrina real, no manual.
  const featured = useMemo(
    () =>
      [...stores]
        .filter((s) => (s.product_count ?? 0) > 0)
        .sort((a, b) => (b.product_count ?? 0) - (a.product_count ?? 0))
        .slice(0, 8),
    [stores]
  );
  const showFeatured = featured.length >= 3 && !debouncedQuery && !cityFilter && !categoryFilter;

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>
      {/* Franja de marca — misma firma visual del resto de la app */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }}
      />

      <FiestasPatriasFloatingBadge />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "color-mix(in srgb, var(--surface) 97%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 1px 12px rgba(20,19,15,.05)",
        }}
      >
        <div
          className="px-4 pb-3 mx-auto w-full"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))", maxWidth: "min(94vw, 1400px)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            {canGoBack ? (
              <button
                onClick={() => router.back()}
                aria-label="Volver"
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: "var(--surface)", border: "1px solid var(--line-2)" }}
              >
                <ArrowLeft size={16} style={{ color: "var(--ink-3)" }} />
              </button>
            ) : (
              <Link
                href="/"
                aria-label="Ir al inicio"
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: "var(--surface)", border: "1px solid var(--line-2)" }}
              >
                <ArrowLeft size={16} style={{ color: "var(--ink-3)" }} />
              </Link>
            )}
            <Logo size="sm" variant="brand" href={null} />
            <div className="flex-1" />
            <div className="text-right">
              <p
                className="font-display font-extrabold text-lg leading-tight"
                style={{
                  backgroundImage: "linear-gradient(90deg, var(--accent), var(--accent-soft))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Mall Qtienda
              </p>
              {!loading && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                  {storesTotal} tienda{storesTotal !== 1 ? "s" : ""} disponible{storesTotal !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {/* Tagline: framing hacia el "centro comercial virtual" */}
          <p className="text-xs mb-3" style={{ color: "var(--ink-3)" }}>
            Todas las tiendas y servicios de Qtienda en un solo lugar — explora por rubro o ciudad.
          </p>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--ink-4)" }}
            />
            <input
              className="input pl-10"
              placeholder="Buscar tienda, producto o ciudad..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Departamentos fijos del Mall — taxonomía curada (no nombres
              libres escritos por cada vendedor), con ícono real por rubro */}
          {mallCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mb-1.5">
              {mallCategories.map((c) => {
                const active = categoryFilter === c.slug;
                return (
                  <button
                    key={c.slug}
                    onClick={() => setCategoryFilter(active ? null : c.slug)}
                    className="flex-shrink-0 flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                    style={
                      active
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                    }
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: active ? "rgba(255,255,255,.25)" : "var(--accent-soft)" }}
                    >
                      {c.icon || "🛍️"}
                    </span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Filtros: ciudad (real, agregada en el servidor) + orden */}
          {cities.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              <button
                onClick={() => setCityFilter(null)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={
                  !cityFilter
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                }
              >
                Todas
              </button>
              {cities.map((c) => (
                <button
                  key={c.city}
                  onClick={() => setCityFilter(cityFilter === c.city ? null : c.city)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={
                    cityFilter === c.city
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                  }
                >
                  <MapPin size={10} /> {c.city}
                </button>
              ))}
              <div className="flex-1 min-w-2" />
              <button
                onClick={() => setSort(sort === "recent" ? "az" : "recent")}
                className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: "var(--surface)", color: "var(--ink-3)", border: "1px solid var(--line-2)" }}
              >
                {sort === "recent" ? "Recientes" : "A-Z"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-4 mx-auto w-full" style={{ maxWidth: "min(94vw, 1400px)" }}>
        {/* Banner rotatorio — bienvenida, invitación a crear tienda, y stats reales */}
        <MallBannerCarousel />

        {/* Recién publicado — últimos productos reales de todas las tiendas.
            Grilla (no fila única) para que se sienta como un catálogo real,
            no un carrusel que hay que arrastrar para ver más. */}
        {!loading && latestProducts.length >= 3 && !debouncedQuery && !cityFilter && !categoryFilter && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <Package size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Recién publicado
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {latestProducts.map((p) => {
                const color = p.primary_color ?? "#C5613B";
                const pCurrency = getStoreCurrency({ currency: p.store_currency, country: p.store_country });
                return (
                  <Link
                    key={p.id}
                    href={`https://${p.store_slug}.qtienda.shop/catalogo?p=${p.id}`}
                    className="rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {p.image_url ? (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          fill
                          sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover"
                        />
                      ) : (
                        <Package size={24} style={{ color: "var(--ink-4)" }} />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>
                        {p.name}
                      </p>
                      <p className="text-xs font-bold mt-0.5" style={{ color }}>
                        {formatPrice(p.price_cents, pCurrency.code, pCurrency.locale)}
                      </p>
                      <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--ink-4)" }}>
                        {p.store_name}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Servicios disponibles — igual criterio que "Recién publicado" pero
            para tiendas que venden servicios con cita, así el mall no se
            siente solo-productos. */}
        {!loading && latestServices.length >= 3 && !debouncedQuery && !cityFilter && !categoryFilter && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <CalendarClock size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Servicios disponibles
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
              {latestServices.map((s) => {
                const color = s.primary_color ?? "#C5613B";
                const sCurrency = getStoreCurrency({ currency: s.store_currency, country: s.store_country });
                return (
                  <Link
                    key={s.id}
                    href={`https://${s.store_slug}.qtienda.shop/#tienda-servicios`}
                    className="rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {s.image_url ? (
                        <Image
                          src={s.image_url}
                          alt={s.name}
                          fill
                          sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover"
                        />
                      ) : (
                        <CalendarClock size={24} style={{ color: "var(--ink-4)" }} />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>
                        {s.name}
                      </p>
                      <p className="text-xs font-bold mt-0.5" style={{ color }}>
                        {s.duration_minutes} min
                        {s.price_cents != null && <> · {formatPrice(s.price_cents, sCurrency.code, sCurrency.locale)}</>}
                      </p>
                      <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--ink-4)" }}>
                        {s.store_name}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Productos del departamento elegido — mosaico real, no solo la lista de tiendas */}
        {categoryFilter && (categoryProductsLoading || categoryProducts.length > 0) && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <ShoppingBag size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                {mallCategories.find((c) => c.slug === categoryFilter)?.label ?? "Productos"}
              </p>
              {!categoryProductsLoading && (
                <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                  {categoryProducts.length} producto{categoryProducts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {categoryProductsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton rounded-2xl" style={{ height: 170 }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {categoryProducts.map((p) => {
                  const color = p.primary_color ?? "#C5613B";
                  const pCurrency = getStoreCurrency({ currency: p.store_currency, country: p.store_country });
                  return (
                    <Link
                      key={p.id}
                      href={`https://${p.store_slug}.qtienda.shop/catalogo?p=${p.id}`}
                      className="rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                      style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                    >
                      <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw"
                            className="object-cover"
                          />
                        ) : (
                          <Package size={24} style={{ color: "var(--ink-4)" }} />
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {p.name}
                        </p>
                        <p className="text-xs font-bold mt-0.5" style={{ color }}>
                          {formatPrice(p.price_cents, pCurrency.code, pCurrency.locale)}
                        </p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--ink-4)" }}>
                          {p.store_name}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Servicios del departamento elegido */}
        {categoryFilter && (categoryServicesLoading || categoryServices.length > 0) && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <CalendarClock size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Servicios en {mallCategories.find((c) => c.slug === categoryFilter)?.label ?? "este rubro"}
              </p>
              {!categoryServicesLoading && (
                <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                  {categoryServices.length} servicio{categoryServices.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {categoryServicesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton rounded-2xl" style={{ height: 170 }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {categoryServices.map((s) => {
                  const color = s.primary_color ?? "#C5613B";
                  const sCurrency = getStoreCurrency({ currency: s.store_currency, country: s.store_country });
                  return (
                    <Link
                      key={s.id}
                      href={`https://${s.store_slug}.qtienda.shop/#tienda-servicios`}
                      className="rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                      style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                    >
                      <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        {s.image_url ? (
                          <Image
                            src={s.image_url}
                            alt={s.name}
                            fill
                            sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw"
                            className="object-cover"
                          />
                        ) : (
                          <CalendarClock size={24} style={{ color: "var(--ink-4)" }} />
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>
                          {s.name}
                        </p>
                        <p className="text-xs font-bold mt-0.5" style={{ color }}>
                          {s.duration_minutes} min
                          {s.price_cents != null && <> · {formatPrice(s.price_cents, sCurrency.code, sCurrency.locale)}</>}
                        </p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--ink-4)" }}>
                          {s.store_name}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-[76px] rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && stores.length === 0 && (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface-2)" }}
            >
              <Store size={28} style={{ color: "var(--ink-4)" }} />
            </div>
            <p className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              {debouncedQuery || cityFilter || categoryFilter ? "Sin resultados" : "No hay tiendas disponibles"}
            </p>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {debouncedQuery
                ? `No encontramos tiendas con "${debouncedQuery}"`
                : categoryFilter
                ? `Ninguna tienda en este rubro por ahora${cityFilter ? ` en ${cityFilter}` : ""}`
                : cityFilter
                ? `Ninguna tienda en ${cityFilter} por ahora`
                : "Vuelve pronto para descubrir nuevas tiendas"}
            </p>
          </div>
        )}

        {/* Destacadas — vitrina del "mall", según catálogo real (no manual) */}
        {!categoryFilter && !loading && showFeatured && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <Sparkles size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Destacadas
              </p>
            </div>
            <ScrollRow>
              {featured.map((s) => {
                const color = s.primary_color ?? "#C5613B";
                return (
                  <Link
                    key={s.slug}
                    href={`https://${s.slug}.qtienda.shop/`}
                    className="flex-shrink-0 w-[104px] flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div
                      className="relative w-14 h-14 rounded-[14px] flex items-center justify-center overflow-hidden"
                      style={{ background: color }}
                    >
                      {s.logo_url ? (
                        <Image src={s.logo_url} alt={s.name} fill sizes="56px" className="object-cover" />
                      ) : (
                        <span className="font-display font-extrabold text-lg text-white">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p
                      className="font-display font-bold text-[11px] leading-tight text-center truncate w-full"
                      style={{ color: "var(--ink)" }}
                    >
                      {s.name}
                    </p>
                  </Link>
                );
              })}
            </ScrollRow>
          </div>
        )}

        {/* Store list — filtrado en el servidor (búsqueda/ciudad/departamento) */}
        <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3">
          {stores.map((s) => {
            // Hex real (no var CSS): se concatena alfa "15" abajo para el fondo de la flecha
            const color = s.primary_color ?? "#C5613B";
            const status = mounted ? getOpenStatus(s.store_hours) : null;
            return (
              <Link
                key={s.slug}
                href={`https://${s.slug}.qtienda.shop/`}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl transition-all active:scale-[.98]"
                style={{
                  background: "var(--surface)",
                  boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)",
                }}
              >
                {/* Store logo */}
                <div
                  className="relative w-[52px] h-[52px] rounded-[14px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: color }}
                >
                  {s.logo_url ? (
                    <Image src={s.logo_url} alt={s.name} fill sizes="52px" className="object-cover" />
                  ) : (
                    <span className="font-display font-extrabold text-xl text-white">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: "var(--ink)" }}>
                    {s.name}
                  </p>
                  {s.description ? (
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-3)" }}>
                      {s.description}
                    </p>
                  ) : (
                    s.categories && s.categories.length > 0 && (
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-3)" }}>
                        Vende {s.categories.join(", ")}
                      </p>
                    )
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <TrustChips store={s} />
                    {s.city && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}
                      >
                        <MapPin size={9} />
                        {s.city}
                      </span>
                    )}
                    {typeof s.product_count === "number" && s.product_count > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}
                      >
                        <Package size={9} />
                        {s.product_count} producto{s.product_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    {typeof s.service_count === "number" && s.service_count > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}
                      >
                        <CalendarClock size={9} />
                        {s.service_count} servicio{s.service_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    {status && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={
                          status.open
                            ? { background: "var(--success-soft)", color: "var(--success)" }
                            : { background: "var(--surface-2)", color: "var(--ink-4)" }
                        }
                      >
                        <Clock size={9} />
                        {status.open ? "Abierto" : "Cerrado"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15`, color }}
                >
                  <ChevronRight size={15} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Cargar más — el directorio ya no trae todas las tiendas de una
            vez, se pagina para seguir siendo rápido con miles de tiendas */}
        {!loading && storesPage < storesPages && (
          <div className="flex justify-center mt-4">
            <button
              onClick={loadMoreStores}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all"
              style={{ background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }}
            >
              {loadingMore ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Cargando...
                </>
              ) : (
                `Cargar más tiendas (${stores.length} de ${storesTotal})`
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
