"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, MapPin, Store } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAuthStore } from "@/store/authStore";

interface StoreCard {
  slug: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  city?: string;
  primary_color?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function TiendasPage() {
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const { accessToken } = useAuthStore();

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
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 pt-safe py-3.5"
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(241,245,249,0.8)",
          boxShadow: "0 1px 12px rgba(15,23,42,.04)",
        }}
      >
        <Link
          href={accessToken ? "/mis-pedidos" : "/"}
          className="flex items-center justify-center w-8 h-8 rounded-xl"
          style={{ background: "var(--surface-1)", border: "1px solid #E2E8F0" }}
        >
          <ArrowLeft size={16} style={{ color: "var(--ink-3)" }} />
        </Link>
        <Logo size="sm" />
        <span className="text-sm font-semibold text-gray-700 flex-1">Tiendas</span>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Buscar tienda o ciudad..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <Store size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-500">
              {query ? "Sin resultados para esa búsqueda" : "No hay tiendas disponibles"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((s) => (
            <Link
              key={s.slug}
              href={`/tienda/${s.slug}`}
              className="block rounded-2xl overflow-hidden transition-transform active:scale-[0.98]"
              style={{
                background: "var(--surface-0)",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 8px rgba(15,23,42,.05)",
              }}
            >
              {/* Banner */}
              {s.banner_url ? (
                <div className="h-20 w-full overflow-hidden">
                  <img src={s.banner_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className="h-20 w-full"
                  style={{ background: s.primary_color ?? "#6366f1", opacity: 0.15 }}
                />
              )}

              <div className="flex items-center gap-3 px-4 py-3 -mt-6">
                {/* Logo */}
                <div
                  className="w-12 h-12 rounded-xl border-2 border-white overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{ background: s.primary_color ?? "#6366f1" }}
                >
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store size={22} className="text-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-gray-900 truncate">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-gray-500 truncate">{s.description}</p>
                  )}
                  {s.city && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400 mt-0.5">
                      <MapPin size={10} />
                      {s.city}
                    </span>
                  )}
                </div>

                <div
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{
                    background: `${s.primary_color ?? "#6366f1"}18`,
                    color: s.primary_color ?? "#6366f1",
                  }}
                >
                  Ver
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
