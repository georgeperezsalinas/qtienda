"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Store, ChevronRight, MapPin, ArrowLeft, Package, Clock } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAuthStore } from "@/store/authStore";
import { getOpenStatus } from "@/lib/storeHours";
import { trackPageView } from "@/lib/siteAnalytics";

interface StoreCard {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  city?: string;
  primary_color?: string;
  product_count?: number;
  store_hours?: Record<string, { open: string; close: string }> | null;
}

type SortMode = "recent" | "az";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function TiendasPage() {
  const { accessToken } = useAuthStore();
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    setMounted(true);
    trackPageView("/tiendas");
    fetch(`${API}/public/stores`)
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  // Ciudades reales de las tiendas activas — nunca una lista inventada de zonas
  const cities = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => s.city && set.add(s.city));
    return Array.from(set).sort();
  }, [stores]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let items = stores.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q);
      const matchesCity = !cityFilter || s.city === cityFilter;
      return matchesQuery && matchesCity;
    });
    if (sort === "az") items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [stores, query, cityFilter, sort]);

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
                className="font-display font-extrabold text-base leading-tight"
                style={{ color: "var(--ink)" }}
              >
                Descubrir tiendas
              </p>
              {!loading && (
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                  {stores.length} tienda{stores.length !== 1 ? "s" : ""} disponible{stores.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

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
        {/* Skeletons */}
        {loading && (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-[76px] rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--surface-2)" }}
            >
              <Store size={28} style={{ color: "var(--ink-4)" }} />
            </div>
            <p className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              {query || cityFilter ? "Sin resultados" : "No hay tiendas disponibles"}
            </p>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {query
                ? `No encontramos tiendas con "${query}"`
                : cityFilter
                ? `Ninguna tienda en ${cityFilter} por ahora`
                : "Vuelve pronto para descubrir nuevas tiendas"}
            </p>
          </div>
        )}

        {/* Store list */}
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
                  {s.description && (
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-3)" }}>
                      {s.description}
                    </p>
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
      </main>
    </div>
  );
}
