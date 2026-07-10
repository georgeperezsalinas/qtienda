"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Store, ChevronRight, MapPin, ArrowLeft } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAuthStore } from "@/store/authStore";

interface StoreCard {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  city?: string;
  primary_color?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function TiendasPage() {
  const { accessToken } = useAuthStore();
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API}/public/stores`)
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stores.filter((s) => {
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #F1F5F9",
          boxShadow: "0 1px 12px rgba(15,23,42,.05)",
        }}
      >
        <div
          className="px-4 pb-3 max-w-lg mx-auto w-full"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Link
              href={accessToken ? "/mis-pedidos" : "/"}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: "var(--surface-1)", border: "1px solid #E2E8F0" }}
            >
              <ArrowLeft size={16} style={{ color: "var(--ink-3)" }} />
            </Link>
            <Logo size="sm" />
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
          <div className="relative">
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
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">

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
              style={{ background: "#F1F5F9" }}
            >
              <Store size={28} style={{ color: "var(--ink-4)" }} />
            </div>
            <p className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              {query ? "Sin resultados" : "No hay tiendas disponibles"}
            </p>
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              {query
                ? `No encontramos tiendas con "${query}"`
                : "Vuelve pronto para descubrir nuevas tiendas"}
            </p>
          </div>
        )}

        {/* Store list */}
        <div className="space-y-2.5">
          {filtered.map((s) => {
            const color = s.primary_color ?? "#6366f1";
            return (
              <Link
                key={s.slug}
                href={`/tienda/${s.slug}`}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl transition-all active:scale-[.98]"
                style={{
                  background: "var(--surface-0)",
                  boxShadow:
                    "0 1px 8px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.04)",
                }}
              >
                {/* Store logo */}
                <div
                  className="w-[52px] h-[52px] rounded-[14px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: color }}
                >
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt={s.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display font-extrabold text-xl text-white">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-display font-bold text-sm leading-snug"
                    style={{ color: "var(--ink)" }}
                  >
                    {s.name}
                  </p>
                  {s.description && (
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {s.description}
                    </p>
                  )}
                  {s.city && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold mt-1.5 px-2 py-0.5 rounded-full"
                      style={{ background: "#F1F5F9", color: "var(--ink-3)" }}
                    >
                      <MapPin size={9} />
                      {s.city}
                    </span>
                  )}
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
