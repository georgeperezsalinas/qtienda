"use client";

// Página pública de seguimiento de pedido — /tienda/{slug}/pedido/{order_number}
// Es el link que recibe el comprador por WhatsApp y en la pantalla de éxito
// del checkout. No requiere cuenta: solo tienda + número de pedido.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock, Package, Bike, Home, XCircle,
  MessageCircle, RefreshCw, Store as StoreIcon, ChevronLeft,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice, getStoreCurrency } from "@/lib/utils";

interface Props {
  params: { slug: string; order: string };
}

interface TrackData {
  order_number: string;
  status: string;
  created_at: string;
  total_cents: number;
  items: { name: string; qty: number; image_url?: string }[];
}

interface StoreInfo {
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  whatsapp?: string;
  country?: string;
  currency?: string;
}

const TIMELINE = [
  { key: "pending",    label: "Pedido recibido",   sub: "La tienda está revisando tu pedido",  icon: Clock },
  { key: "confirmed",  label: "Confirmado",         sub: "Tu pedido fue aceptado",              icon: CheckCircle2 },
  { key: "preparing",  label: "En preparación",     sub: "Están alistando tus productos",       icon: Package },
  { key: "on_the_way", label: "En camino",          sub: "Tu pedido va hacia ti",               icon: Bike },
  { key: "delivered",  label: "Entregado",          sub: "¡Disfrútalo!",                        icon: Home },
] as const;

const STATUS_IDX: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 2, on_the_way: 3, delivered: 4,
};

export default function TrackOrderPage({ params }: Props) {
  const [order, setOrder]     = useState<TrackData | null>(null);
  const [store, setStore]     = useState<StoreInfo | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await apiClient.get(
        `/public/store/${params.slug}/orders/${params.order}/track`
      );
      setOrder(data);
      setError(null);
    } catch (err: any) {
      if (!order) setError(err.response?.data?.detail || "No pudimos cargar tu pedido");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug, params.order]);

  useEffect(() => {
    load(true);
    apiClient
      .get(`/public/store/${params.slug}`)
      .then(({ data }) => setStore(data))
      .catch(() => {});
  }, [load, params.slug]);

  // Auto-refresh cada 30s mientras el pedido siga activo
  useEffect(() => {
    if (!order || order.status === "delivered" || order.status === "cancelled") return;
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [order, load]);

  const color = store?.primary_color || "#2563EB";
  const storeCurrency = getStoreCurrency(store);
  const cancelled = order?.status === "cancelled";
  const currentIdx = order ? STATUS_IDX[order.status] ?? 0 : 0;

  const waHref = store?.whatsapp
    ? `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
        `Hola 👋 tengo una consulta sobre mi pedido #${params.order}`
      )}`
    : null;

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg)" }}>
      {/* Franja de marca */}
      <div aria-hidden className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />

      <div className="max-w-md mx-auto px-4 py-5">
        {/* Header tienda */}
        <Link
          href={`/tienda/${params.slug}`}
          className="flex items-center gap-3 mb-6"
        >
          <ChevronLeft size={18} style={{ color: "var(--ink-3)" }} />
          {store?.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="w-9 h-9 rounded-xl object-cover" />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: color }}
            >
              {store?.name?.[0]?.toUpperCase() ?? <StoreIcon size={16} />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: "var(--ink)" }}>
              {store?.name ?? "Tienda"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>Volver a la tienda</p>
          </div>
        </Link>

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton" style={{ height: 80 }} />
            <div className="skeleton" style={{ height: 260 }} />
          </div>
        ) : error ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <XCircle size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="font-bold text-sm" style={{ color: "var(--ink)" }}>{error}</p>
            <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>
              Verifica que el link sea correcto o consulta con la tienda.
            </p>
          </div>
        ) : order && (
          <>
            {/* Cabecera del pedido */}
            <div
              className="rounded-2xl p-4 mb-4 flex items-center justify-between"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
                  Pedido
                </p>
                <p className="font-extrabold text-xl" style={{ color: "var(--ink)" }}>
                  #{order.order_number}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {new Intl.DateTimeFormat("es-PE", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  }).format(new Date(order.created_at))}
                </p>
              </div>
              <button
                onClick={() => load()}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full"
                style={{ background: `${color}12`, color }}
                aria-label="Actualizar estado"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>

            {/* Estado cancelado */}
            {cancelled ? (
              <div
                className="rounded-2xl p-6 mb-4 text-center"
                style={{ background: "var(--danger-soft)", border: "1px solid var(--line)" }}
              >
                <XCircle size={30} className="mx-auto mb-2" style={{ color: "var(--danger)" }} />
                <p className="font-bold text-sm" style={{ color: "var(--danger)" }}>
                  Este pedido fue cancelado
                </p>
                <p className="text-xs mt-1.5" style={{ color: "var(--ink-2)" }}>
                  Si crees que es un error, escríbele a la tienda.
                </p>
              </div>
            ) : (
              /* Timeline */
              <div
                className="rounded-2xl p-5 mb-4"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                {TIMELINE.map((s, i) => {
                  const done   = i < currentIdx;
                  const active = i === currentIdx;
                  const Icon   = s.icon;
                  return (
                    <div key={s.key} className="flex gap-3">
                      {/* Columna: punto + línea */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            background: done || active ? color : "var(--surface-2)",
                            color: done || active ? "#fff" : "var(--ink-4)",
                            boxShadow: active ? `0 0 0 4px ${color}22` : "none",
                          }}
                        >
                          <Icon size={15} />
                        </div>
                        {i < TIMELINE.length - 1 && (
                          <div
                            className="w-0.5 flex-1 my-1"
                            style={{ background: done ? color : "var(--line-2)", minHeight: 18 }}
                          />
                        )}
                      </div>
                      {/* Texto */}
                      <div className={i < TIMELINE.length - 1 ? "pb-4" : ""}>
                        <p
                          className="text-sm font-bold leading-8"
                          style={{ color: done || active ? "var(--ink)" : "var(--ink-4)" }}
                        >
                          {s.label}
                          {active && (
                            <span
                              className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full align-middle"
                              style={{ background: `${color}15`, color }}
                            >
                              Ahora
                            </span>
                          )}
                        </p>
                        {active && (
                          <p className="text-xs -mt-1.5" style={{ color: "var(--ink-3)" }}>{s.sub}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Productos */}
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
                Tu pedido
              </p>
              <div className="space-y-2.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--surface-2)" }}
                      >
                        🛍️
                      </div>
                    )}
                    <p className="flex-1 text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                      {item.name}
                    </p>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: "var(--ink-3)" }}>
                      x{item.qty}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="flex justify-between font-extrabold text-sm mt-3 pt-3"
                style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <span>Total</span>
                <span style={{ color }}>{formatPrice(order.total_cents, storeCurrency.code, storeCurrency.locale)}</span>
              </div>
            </div>

            {/* Contactar tienda */}
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-bold text-sm text-white transition-all active:scale-[.98]"
                style={{ background: "#25D366" }}
              >
                <MessageCircle size={17} />
                Consultar por WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
