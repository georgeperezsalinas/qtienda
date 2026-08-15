"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Store, ChevronRight, ChevronLeft, MapPin, Package, Clock, Sparkles, ShoppingBag, ShieldCheck, Star, Loader2, CalendarClock, Plus, Bell, Home, Grid3x3, User } from "lucide-react";
import Logo from "@/components/ui/Logo";
import PublicBottomNav from "@/components/ui/PublicBottomNav";
import CategoryFilterModal from "@/components/ui/CategoryFilterModal";
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
  | { kind: "text"; gradient: string; showInstallLink?: boolean }
  | { kind: "image"; imageUrl: string; linkUrl: string | null };

const BANNER_ROTATE_MS = 6000;

// Carrusel de banners — bloque propio dentro del contenido, separado del
// header (patrón tipo marketplace: barra angosta + buscador + departamentos
// sutiles arriba, banner recién después). El primer slide (bienvenida) es
// fijo. Los demás vienen de /admin/mall-banners — sin ninguno configurado,
// el carrusel es un solo slide fijo (sin puntos).
function MallBannerCarousel() {
  const [dynamicBanners, setDynamicBanners] = useState<DynamicBanner[]>([]);

  useEffect(() => {
    fetch(`${API}/public/mall-banners`)
      .then((r) => r.json())
      .then((data) => setDynamicBanners(Array.isArray(data) ? data : []))
      .catch(() => setDynamicBanners([]));
  }, []);

  // Ya no hay slide de degradado dedicado a "crea tu tienda" — ese CTA
  // ahora es el botón flotante circular (siempre visible, no le come un
  // turno entero del carrusel). Sin banners configurados, el carrusel
  // queda con un solo slide (bienvenida) y sin puntos de navegación.
  const slides: BannerSlide[] = useMemo(() => {
    const base: BannerSlide[] = [
      {
        kind: "text",
        gradient: "linear-gradient(160deg, var(--ink) 0%, var(--accent-ink) 100%)",
        showInstallLink: true,
      },
    ];
    dynamicBanners.forEach((b) => {
      base.push({ kind: "image", imageUrl: b.image_url, linkUrl: b.link_url });
    });
    return base;
  }, [dynamicBanners]);

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

  // Solo http(s) o rutas internas: nunca javascript: en el href (mismo
  // criterio que el carrusel de banners de cada tienda).
  const slideLink =
    slide.kind === "image" && slide.linkUrl && /^(https?:\/\/|\/)/.test(slide.linkUrl)
      ? slide.linkUrl
      : undefined;
  const isExternal = !!slideLink && slideLink.startsWith("http") && !slideLink.includes("qtienda.shop");

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
            <div className="relative w-full aspect-[21/9]">
              <Image src={slide.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 1360px" className="object-cover" />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-5" style={{ background: slide.gradient, minHeight: 108 }}>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,.2)" }}
              >
                <ShoppingBag size={18} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-extrabold text-sm text-white">Mall qtienda</p>
                <p className="text-xs mt-0.5 text-white/85">
                  Un solo lugar para conocer todas las tiendas y sus productos.
                </p>
                {slide.showInstallLink && (
                  <div className="mt-1.5">
                    <MallInstallLink />
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {slideLink && (
        <a
          href={slideLink}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="absolute inset-0 z-[5]"
          aria-label="Promoción"
        />
      )}

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

      {/* Botón flotante circular "crear tienda" — antes era un slide entero
          de degradado dedicado a esto (le comía un turno al carrusel real);
          ahora es un CTA chico y siempre presente, sin ocupar espacio de
          contenido. */}
      <Link
        href="/auth/register"
        aria-label="Crear mi tienda gratis"
        className="absolute z-20 flex items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          top: 12, right: 12, width: 40, height: 40,
          background: "var(--accent)", boxShadow: "0 4px 14px rgba(0,0,0,.35)",
        }}
      >
        <Plus size={18} color="#fff" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

const STORES_PAGE_SIZE = 24;

export default function TiendasPage() {
  // Para los tabs "Buscar" y "Categorías" de la barra inferior — llevan el
  // scroll hasta el buscador/departamentos en vez de navegar a otra página.
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
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
  // Multi-select — un comprador puede querer ver Lima Y Chiclayo a la vez,
  // no una ciudad a la vez como antes.
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
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
    cityFilter.forEach((c) => params.append("city", c));
    categoryFilter.forEach((c) => params.append("mall_category", c));
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
    cityFilter.forEach((c) => params.append("city", c));
    categoryFilter.forEach((c) => params.append("mall_category", c));
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
    if (categoryFilter.length === 0) {
      setCategoryProducts([]);
      setCategoryServices([]);
      return;
    }
    const catParams = new URLSearchParams({ limit: "24" });
    categoryFilter.forEach((c) => catParams.append("mall_category", c));
    setCategoryProductsLoading(true);
    fetch(`${API}/public/latest-products?${catParams}`)
      .then((r) => r.json())
      .then((data) => setCategoryProducts(Array.isArray(data) ? data : []))
      .catch(() => setCategoryProducts([]))
      .finally(() => setCategoryProductsLoading(false));
    setCategoryServicesLoading(true);
    fetch(`${API}/public/latest-services?${catParams}`)
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
  const showFeatured = featured.length >= 3 && !debouncedQuery && cityFilter.length === 0 && categoryFilter.length === 0;
  // Label de la sección "Productos/Servicios del departamento" — un rubro
  // muestra su nombre, varios muestran el conteo (no tiene sentido listar
  // "Moda, Belleza, Hogar..." completo ahí).
  const categoryFilterLabel =
    categoryFilter.length === 1
      ? mallCategories.find((c) => c.slug === categoryFilter[0])?.label ?? "Categoría"
      : `${categoryFilter.length} rubros`;

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>
      {/* Franja de marca — misma firma visual del resto de la app */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }}
      />

      <FiestasPatriasFloatingBadge />

      {/* ── Header — barra angosta + buscador + departamentos sutiles,
          tipo apps de marketplace (AliExpress): la marca no ocupa una
          franja grande, el banner promocional vive en el contenido, no en
          el header. */}
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
        <div className="mx-auto w-full" style={{ maxWidth: "min(94vw, 1400px)" }}>
          {/* Barra angosta: marca a la izquierda, acceso rápido a la
              derecha — sin flecha de volver (esta página es el "home" del
              Mall; antes la flecha a veces mandaba a la cuenta comprador
              sin sentido). Como el comprador todavía no tiene notificaciones
              propias, el ícono lleva a "Mis pedidos" — lo más parecido a
              "actividad" que existe hoy. */}
          <div
            className="flex items-center justify-between px-4"
            style={{ paddingTop: "max(10px, env(safe-area-inset-top))", paddingBottom: 8 }}
          >
            <Logo size="md" variant="brand" href="/" />
            <Link
              href="/mis-pedidos"
              aria-label="Mis pedidos"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--surface-2)" }}
            >
              <Bell size={16} style={{ color: "var(--ink-2)" }} />
            </Link>
          </div>

          <div className="px-4 pb-2.5">
            {/* Search */}
            <div className="relative mb-1.5">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--ink-4)" }}
              />
              <input
                ref={searchInputRef}
                className="input pl-10"
                placeholder="Buscar tienda, producto o ciudad..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Stats reales — línea de texto simple, sin chips de color
                (nunca inventado: se omite mientras carga). */}
            {!loading && (
              <p className="text-[11px] mb-2" style={{ color: "var(--ink-3)" }}>
                {storesTotal} tienda{storesTotal !== 1 ? "s" : ""}
                {cities.length > 1 && <> · {cities.length} ciudades</>}
              </p>
            )}

            {/* Departamentos fijos del Mall — sutiles a propósito: fondo
                neutro salvo el elegido, tiles chicos. Es navegación
                secundaria acá arriba, no debe competir con el buscador. */}
            {mallCategories.length > 0 && (
              <div ref={categoriesRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {mallCategories.map((c) => {
                  const active = categoryFilter.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      onClick={() =>
                        setCategoryFilter((prev) =>
                          active ? prev.filter((k) => k !== c.slug) : [...prev, c.slug]
                        )
                      }
                      className="flex-shrink-0 flex flex-col items-center gap-1 transition-all"
                      style={{ width: 48 }}
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all"
                        style={{ background: active ? "var(--accent)" : "var(--surface-2)" }}
                      >
                        {c.icon || "🛍️"}
                      </span>
                      <span
                        className="text-[9px] font-bold text-center leading-tight truncate w-full"
                        style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}
                      >
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filtros: ciudad (real, agregada en el servidor) + orden —
                multi-select: se puede combinar Lima + Chiclayo a la vez. */}
            {cities.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-2">
                <button
                  onClick={() => setCityFilter([])}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={
                    cityFilter.length === 0
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                  }
                >
                  Todas
                </button>
                {cities.map((c) => {
                  const active = cityFilter.includes(c.city);
                  return (
                    <button
                      key={c.city}
                      onClick={() =>
                        setCityFilter((prev) =>
                          active ? prev.filter((x) => x !== c.city) : [...prev, c.city]
                        )
                      }
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={
                        active
                          ? { background: "var(--accent)", color: "#fff" }
                          : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                      }
                    >
                      <MapPin size={10} /> {c.city}
                    </button>
                  );
                })}
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
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-4 pb-24 md:pb-4 mx-auto w-full" style={{ maxWidth: "min(94vw, 1400px)" }}>
        {/* Banner — recién acá, después de buscador y departamentos, no
            fusionado en el header (así lo pidió el dueño del producto). */}
        <MallBannerCarousel />

        {/* Recién publicado — últimos productos reales de todas las tiendas.
            Riel horizontal (no grilla completa) — con 20+ tiendas una
            grilla de hasta 24 productos ocupaba varias pantallas de scroll
            antes de llegar a nada más; en riel es una sola fila. */}
        {!loading && latestProducts.length >= 3 && !debouncedQuery && cityFilter.length === 0 && categoryFilter.length === 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <Package size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Recién publicado
              </p>
            </div>
            <ScrollRow>
              {latestProducts.map((p) => {
                const color = p.primary_color ?? "#C5613B";
                const pCurrency = getStoreCurrency({ currency: p.store_currency, country: p.store_country });
                return (
                  <Link
                    key={p.id}
                    href={`https://${p.store_slug}.qtienda.shop/catalogo?p=${p.id}`}
                    className="flex-shrink-0 w-[148px] rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} fill sizes="148px" className="object-cover" />
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
            </ScrollRow>
          </div>
        )}

        {/* Servicios disponibles — mismo criterio en riel horizontal. */}
        {!loading && latestServices.length >= 3 && !debouncedQuery && cityFilter.length === 0 && categoryFilter.length === 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <CalendarClock size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Servicios disponibles
              </p>
            </div>
            <ScrollRow>
              {latestServices.map((s) => {
                const color = s.primary_color ?? "#C5613B";
                const sCurrency = getStoreCurrency({ currency: s.store_currency, country: s.store_country });
                return (
                  <Link
                    key={s.id}
                    href={`https://${s.store_slug}.qtienda.shop/#tienda-servicios`}
                    className="flex-shrink-0 w-[148px] rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {s.image_url ? (
                        <Image src={s.image_url} alt={s.name} fill sizes="148px" className="object-cover" />
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
            </ScrollRow>
          </div>
        )}

        {/* Productos del departamento elegido — riel horizontal, no mosaico completo */}
        {categoryFilter.length > 0 && (categoryProductsLoading || categoryProducts.length > 0) && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <ShoppingBag size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                {categoryFilterLabel}
              </p>
              {!categoryProductsLoading && (
                <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                  {categoryProducts.length} producto{categoryProducts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {categoryProductsLoading ? (
              <div className="flex gap-2.5 overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton rounded-2xl flex-shrink-0" style={{ width: 148, height: 170 }} />
                ))}
              </div>
            ) : (
              <ScrollRow>
                {categoryProducts.map((p) => {
                  const color = p.primary_color ?? "#C5613B";
                  const pCurrency = getStoreCurrency({ currency: p.store_currency, country: p.store_country });
                  return (
                    <Link
                      key={p.id}
                      href={`https://${p.store_slug}.qtienda.shop/catalogo?p=${p.id}`}
                      className="flex-shrink-0 w-[148px] rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                      style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                    >
                      <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        {p.image_url ? (
                          <Image src={p.image_url} alt={p.name} fill sizes="148px" className="object-cover" />
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
              </ScrollRow>
            )}
          </div>
        )}

        {/* Servicios del departamento elegido — riel horizontal */}
        {categoryFilter.length > 0 && (categoryServicesLoading || categoryServices.length > 0) && (
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <CalendarClock size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Servicios en {categoryFilterLabel}
              </p>
              {!categoryServicesLoading && (
                <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                  {categoryServices.length} servicio{categoryServices.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {categoryServicesLoading ? (
              <div className="flex gap-2.5 overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton rounded-2xl flex-shrink-0" style={{ width: 148, height: 170 }} />
                ))}
              </div>
            ) : (
              <ScrollRow>
                {categoryServices.map((s) => {
                  const color = s.primary_color ?? "#C5613B";
                  const sCurrency = getStoreCurrency({ currency: s.store_currency, country: s.store_country });
                  return (
                    <Link
                      key={s.id}
                      href={`https://${s.store_slug}.qtienda.shop/#tienda-servicios`}
                      className="flex-shrink-0 w-[148px] rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                      style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                    >
                      <div className="relative w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        {s.image_url ? (
                          <Image src={s.image_url} alt={s.name} fill sizes="148px" className="object-cover" />
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
              </ScrollRow>
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
              {debouncedQuery || cityFilter.length > 0 || categoryFilter.length > 0 ? "Sin resultados" : "No hay tiendas disponibles"}
            </p>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {debouncedQuery
                ? `No encontramos tiendas con "${debouncedQuery}"`
                : categoryFilter.length > 0
                ? `Ninguna tienda en este rubro por ahora${cityFilter.length > 0 ? ` en ${cityFilter.join(", ")}` : ""}`
                : cityFilter.length > 0
                ? `Ninguna tienda en ${cityFilter.join(", ")} por ahora`
                : "Vuelve pronto para descubrir nuevas tiendas"}
            </p>
          </div>
        )}

        {/* Destacadas — vitrina del "mall", según catálogo real (no manual).
            Suma el rating cuando existe, para que se lea por qué está ahí
            (no solo el nombre) — mismo dato que ya trae TrustChips. */}
        {categoryFilter.length === 0 && !loading && showFeatured && (
          <div className="mb-5">
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
                    className="flex-shrink-0 w-[112px] flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all active:scale-[.97]"
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
                    {!!s.rating_count && s.rating_count > 0 && s.rating_avg != null && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: "var(--warn)" }}>
                        <Star size={9} fill="currentColor" />
                        {s.rating_avg.toFixed(1)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </ScrollRow>
          </div>
        )}

        {/* Directorio completo — sección propia, claramente separada de los
            rieles de descubrimiento de arriba (antes seguía directo después
            de "Destacadas" sin ninguna transición). */}
        {!loading && stores.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2.5 px-0.5 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
            <Store size={13} style={{ color: "var(--accent)" }} />
            <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
              {debouncedQuery || cityFilter.length > 0 || categoryFilter.length > 0 ? "Resultados" : "Todas las tiendas"}
            </p>
            <span className="text-xs" style={{ color: "var(--ink-4)" }}>
              {storesTotal} tienda{storesTotal !== 1 ? "s" : ""}
            </span>
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

      {showCategoryModal && (
        <CategoryFilterModal
          title="Categorías"
          options={mallCategories.map((c) => ({ key: c.slug, label: c.label, icon: c.icon }))}
          selected={categoryFilter}
          onApply={(next) => { setCategoryFilter(next); setShowCategoryModal(false); }}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      <PublicBottomNav
        items={[
          {
            key: "inicio",
            icon: Home,
            label: "Inicio",
            active: !query && cityFilter.length === 0 && categoryFilter.length === 0,
            onClick: () => {
              setQuery("");
              setCityFilter([]);
              setCategoryFilter([]);
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
          },
          {
            key: "categorias",
            icon: Grid3x3,
            label: "Categorías",
            active: categoryFilter.length > 0,
            badge: categoryFilter.length > 0 ? categoryFilter.length : undefined,
            onClick: () => setShowCategoryModal(true),
          },
          {
            key: "buscar",
            icon: Search,
            label: "Buscar",
            onClick: () => {
              searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              searchInputRef.current?.focus();
            },
          },
          { key: "cuenta", icon: User, label: "Cuenta", href: "/mis-pedidos" },
        ]}
      />
    </div>
  );
}
