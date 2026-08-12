"use client";

// Admin: moderación de reseñas de compradores. El sistema de reseñas
// (calificar un pedido entregado) no tenía ninguna vista en /admin — un
// admin no podía ver, buscar ni ocultar una reseña abusiva o falsa.

import { useEffect, useState, useCallback } from "react";
import { Search, Star, EyeOff, Eye, ChevronLeft, ChevronRight, MessageSquareOff } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  photo_urls: string[];
  buyer_name: string;
  store_name: string;
  store_slug: string;
  created_at: string;
  hidden_at: string | null;
}

const RATING_FILTERS = [0, 5, 4, 3, 2, 1];
type VisibilityFilter = "" | "visible" | "hidden";

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-PE", { month: "short", day: "numeric", year: "numeric" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          fill={i < rating ? "var(--warn)" : "none"}
          style={{ color: i < rating ? "var(--warn)" : "var(--line-2)" }}
        />
      ))}
    </div>
  );
}

export default function AdminResenasPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [rating, setRating] = useState(0);
  const [visibility, setVisibility] = useState<VisibilityFilter>("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(1); }, [debouncedQuery, rating, visibility]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (debouncedQuery) params.q = debouncedQuery;
      if (rating) params.rating = rating;
      if (visibility) params.hidden = visibility === "hidden" ? "true" : "false";
      const { data } = await apiClient.get("/admin/reviews", { params });
      setItems(data.items ?? []);
      setPages(data.pages || 1);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("No se pudieron cargar las reseñas");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, rating, visibility]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function toggleHidden(review: ReviewItem) {
    setActingId(review.id);
    try {
      await apiClient.post(`/admin/reviews/${review.id}/${review.hidden_at ? "unhide" : "hide"}`);
      setItems((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, hidden_at: r.hidden_at ? null : new Date().toISOString() } : r))
      );
      toast.success(review.hidden_at ? "Reseña visible de nuevo" : "Reseña ocultada");
    } catch {
      toast.error("No se pudo actualizar la reseña");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
      <div>
        <p className="eyebrow">Confianza</p>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Reseñas
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          {total} reseña{total !== 1 ? "s" : ""} de compradores en toda la plataforma. Ocultar una reseña
          la quita del promedio y de la ficha pública de la tienda, sin borrarla.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-4)" }} />
          <input
            className="input pl-10"
            placeholder="Buscar por tienda o texto de la reseña..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="text-sm font-semibold px-3 py-2.5 rounded-xl"
            style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)", color: "var(--ink-2)" }}
          >
            {RATING_FILTERS.map((r) => (
              <option key={r} value={r}>{r === 0 ? "Todas las estrellas" : `${r}★`}</option>
            ))}
          </select>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as VisibilityFilter)}
            className="text-sm font-semibold px-3 py-2.5 rounded-xl"
            style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)", color: "var(--ink-2)" }}
          >
            <option value="">Todas</option>
            <option value="visible">Visibles</option>
            <option value="hidden">Ocultas</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}>
          <MessageSquareOff size={28} className="mx-auto mb-2" style={{ color: "var(--ink-4)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>Sin reseñas para este filtro</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl p-4"
              style={{
                background: "var(--surface-0)",
                border: "1.5px solid var(--line-2)",
                opacity: r.hidden_at ? 0.6 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Stars rating={r.rating} />
                    <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>{r.buyer_name}</span>
                    {r.hidden_at && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                        Oculta
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {r.store_name} · {timeAgo(r.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => toggleHidden(r)}
                  disabled={actingId === r.id}
                  title={r.hidden_at ? "Volver a mostrar" : "Ocultar reseña"}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                  style={
                    r.hidden_at
                      ? { background: "var(--success-soft)", color: "var(--success)" }
                      : { background: "var(--danger-soft)", color: "var(--danger)" }
                  }
                >
                  {r.hidden_at ? <Eye size={13} /> : <EyeOff size={13} />}
                  {r.hidden_at ? "Mostrar" : "Ocultar"}
                </button>
              </div>
              {r.comment && (
                <p className="text-sm mt-1.5" style={{ color: "var(--ink-2)" }}>{r.comment}</p>
              )}
              {r.photo_urls?.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {r.photo_urls.map((url, pi) => (
                    <a key={pi} href={url} target="_blank" rel="noopener noreferrer"
                      className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                      style={{ border: "1px solid var(--line-2)" }}>
                      <img src={url} alt="Foto de la reseña" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronLeft size={16} style={{ color: "var(--ink-2)" }} />
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronRight size={16} style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
      )}
    </div>
  );
}
