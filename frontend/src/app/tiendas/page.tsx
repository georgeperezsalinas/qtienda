"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Store, ChevronRight, MapPin, ArrowLeft, Package, Clock, Tag, Sparkles, ShoppingBag } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAuthStore } from "@/store/authStore";
import { getOpenStatus } from "@/lib/storeHours";
import { trackPageView } from "@/lib/siteAnalytics";
import { formatPrice } from "@/lib/utils";
import MallInstallLink from "@/components/ui/MallInstallLink";

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
}

type SortMode = "recent" | "az";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function TiendasPage() {
  const { accessToken } = useAuthStore();
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [latestProducts, setLatestProducts] = useState<LatestProduct[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<LatestProduct[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    setMounted(true);
    trackPageView("/tiendas");
    fetch(`${API}/public/stores`)
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
    fetch(`${API}/public/latest-products`)
      .then((r) => r.json())
      .then((data) => setLatestProducts(Array.isArray(data) ? data : []))
      .catch(() => setLatestProducts([]));
  }, []);

  // Al elegir un rubro, el mall muestra productos de ese rubro (todas las tiendas), no solo la lista de tiendas
  useEffect(() => {
    if (!categoryFilter) {
      setCategoryProducts([]);
      return;
    }
    setCategoryLoading(true);
    fetch(`${API}/public/latest-products?category=${encodeURIComponent(categoryFilter)}&limit=24`)
      .then((r) => r.json())
      .then((data) => setCategoryProducts(Array.isArray(data) ? data : []))
      .catch(() => setCategoryProducts([]))
      .finally(() => setCategoryLoading(false));
  }, [categoryFilter]);

  // Ciudades reales de las tiendas activas — nunca una lista inventada de zonas
  const cities = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => s.city && set.add(s.city));
    return Array.from(set).sort();
  }, [stores]);

  // Rubros reales — derivados del catálogo de cada tienda (nunca inventados),
  // funcionan como los "pisos" o secciones del centro comercial virtual.
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    stores.forEach((s) => (s.categories ?? []).forEach((c) => count.set(c, (count.get(c) ?? 0) + 1)));
    return Array.from(count.keys()).sort((a, b) => (count.get(b)! - count.get(a)!) || a.localeCompare(b));
  }, [stores]);

  // Lista de tiendas — solo se muestra cuando no hay rubro elegido
  // (con rubro elegido, el mall muestra productos de ese rubro más abajo).
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let items = stores.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q) ||
        (s.categories ?? []).some((c) => c.toLowerCase().includes(q));
      const matchesCity = !cityFilter || s.city === cityFilter;
      return matchesQuery && matchesCity;
    });
    if (sort === "az") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [stores, query, cityFilter, sort]);

  // Productos del rubro elegido — combinando ciudad/búsqueda ya activos
  const filteredCategoryProducts = useMemo(() => {
    const q = query.toLowerCase();
    return categoryProducts.filter((p) => {
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || p.store_name.toLowerCase().includes(q);
      const matchesCity = !cityFilter || p.store_city === cityFilter;
      return matchesQuery && matchesCity;
    });
  }, [categoryProducts, query, cityFilter]);

  // Destacadas: las tiendas con más catálogo activo — vitrina real, no manual.
  const featured = useMemo(
    () =>
      [...stores]
        .filter((s) => (s.product_count ?? 0) > 0)
        .sort((a, b) => (b.product_count ?? 0) - (a.product_count ?? 0))
        .slice(0, 8),
    [stores]
  );
  const showFeatured = featured.length >= 3 && !query && !cityFilter && !categoryFilter;

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>
      {/* Franja de marca — misma firma visual del resto de la app */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }}
      />

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
          className="px-4 pb-3 max-w-lg lg:max-w-4xl mx-auto w-full"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Link
              href={accessToken ? "/mis-pedidos" : "/"}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: "var(--surface)", border: "1px solid var(--line-2)" }}
            >
              <ArrowLeft size={16} style={{ color: "var(--ink-3)" }} />
            </Link>
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
                  {stores.length} tienda{stores.length !== 1 ? "s" : ""} disponible{stores.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {/* Tagline: framing hacia el "centro comercial virtual" */}
          <p className="text-xs mb-3" style={{ color: "var(--ink-3)" }}>
            Todas las tiendas de Qtienda en un solo lugar — explora por rubro o ciudad.
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

          {/* Filtro por rubro — "pisos" del centro comercial, derivados del catálogo real */}
          {!loading && categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 mb-1.5">
              <Tag size={11} className="flex-shrink-0" style={{ color: "var(--ink-4)" }} />
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                  style={
                    categoryFilter === c
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Filtros: ciudad (real, derivada de las tiendas) + orden */}
          {!loading && cities.length > 1 && (
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
                  key={c}
                  onClick={() => setCityFilter(cityFilter === c ? null : c)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={
                    cityFilter === c
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }
                  }
                >
                  <MapPin size={10} /> {c}
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
      <main className="flex-1 px-4 py-4 max-w-lg lg:max-w-4xl mx-auto w-full">
        {/* Banner — bienvenida al mall, decorativo y estático */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 mb-4 flex items-center gap-4"
          style={{ background: "linear-gradient(120deg, var(--accent), var(--accent-soft))" }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,.2)" }}
          >
            <ShoppingBag size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-base leading-tight text-white">Mall qtienda</p>
            <p className="text-xs mt-0.5 text-white/85">
              Un solo lugar para conocer todas las tiendas y sus productos.
            </p>
            <MallInstallLink />
          </div>
        </div>

        {/* Recién publicado — últimos productos reales de todas las tiendas */}
        {!loading && latestProducts.length >= 3 && !query && !cityFilter && !categoryFilter && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <Package size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Recién publicado
              </p>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
              {latestProducts.map((p) => {
                const color = p.primary_color ?? "#C5613B";
                return (
                  <Link
                    key={p.id}
                    href={`/tienda/${p.store_slug}?p=${p.id}`}
                    className="flex-shrink-0 w-[120px] rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div className="w-full h-[90px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={22} style={{ color: "var(--ink-4)" }} />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                        {p.name}
                      </p>
                      <p className="text-[11px] font-bold mt-0.5" style={{ color }}>
                        {formatPrice(p.price_cents)}
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

        {/* Skeletons */}
        {(categoryFilter ? loading || categoryLoading : loading) && (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-[76px] rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading &&
          (categoryFilter
            ? !categoryLoading && filteredCategoryProducts.length === 0
            : filtered.length === 0) && (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--surface-2)" }}
              >
                <Store size={28} style={{ color: "var(--ink-4)" }} />
              </div>
              <p className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
                {query || cityFilter || categoryFilter ? "Sin resultados" : "No hay tiendas disponibles"}
              </p>
              <p className="text-sm" style={{ color: "var(--ink-3)" }}>
                {categoryFilter
                  ? `Ningún producto de "${categoryFilter}" por ahora${cityFilter ? ` en ${cityFilter}` : ""}`
                  : query
                  ? `No encontramos tiendas con "${query}"`
                  : cityFilter
                  ? `Ninguna tienda en ${cityFilter} por ahora`
                  : "Vuelve pronto para descubrir nuevas tiendas"}
              </p>
            </div>
          )}

        {/* Productos del rubro elegido — el mall navega por catálogo, no solo por tienda */}
        {!categoryLoading && categoryFilter && filteredCategoryProducts.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <Tag size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                {categoryFilter}
              </p>
              <span className="text-xs" style={{ color: "var(--ink-4)" }}>
                {filteredCategoryProducts.length} producto{filteredCategoryProducts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredCategoryProducts.map((p) => {
                const color = p.primary_color ?? "#C5613B";
                return (
                  <Link
                    key={p.id}
                    href={`/tienda/${p.store_slug}?p=${p.id}`}
                    className="rounded-2xl overflow-hidden transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div className="w-full h-[110px] flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} style={{ color: "var(--ink-4)" }} />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>
                        {p.name}
                      </p>
                      <p className="text-xs font-bold mt-0.5" style={{ color }}>
                        {formatPrice(p.price_cents)}
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

        {/* Destacadas — vitrina del "mall", según catálogo real (no manual) */}
        {!categoryFilter && !loading && showFeatured && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
              <Sparkles size={13} style={{ color: "var(--accent)" }} />
              <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                Destacadas
              </p>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
              {featured.map((s) => {
                const color = s.primary_color ?? "#C5613B";
                return (
                  <Link
                    key={s.slug}
                    href={`/tienda/${s.slug}`}
                    className="flex-shrink-0 w-[104px] flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition-all active:scale-[.97]"
                    style={{ background: "var(--surface)", boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)" }}
                  >
                    <div
                      className="w-14 h-14 rounded-[14px] flex items-center justify-center overflow-hidden"
                      style={{ background: color }}
                    >
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
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
            </div>
          </div>
        )}

        {/* Store list */}
        {!categoryFilter && (
        <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
          {filtered.map((s) => {
            // Hex real (no var CSS): se concatena alfa "15" abajo para el fondo de la flecha
            const color = s.primary_color ?? "#C5613B";
            const status = mounted ? getOpenStatus(s.store_hours) : null;
            return (
              <Link
                key={s.slug}
                href={`/tienda/${s.slug}`}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl transition-all active:scale-[.98]"
                style={{
                  background: "var(--surface)",
                  boxShadow: "0 1px 8px rgba(20,19,15,.06), 0 0 0 1px var(--line)",
                }}
              >
                {/* Store logo */}
                <div
                  className="w-[52px] h-[52px] rounded-[14px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: color }}
                >
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
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
        )}
      </main>
    </div>
  );
}
