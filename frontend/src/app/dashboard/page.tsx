// src/app/dashboard/page.tsx — qtienda v2
// Reemplaza completo. Misma lógica de API/state, presentación rediseñada.

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  Share2,
  ChevronRight,
  Mail,
  RefreshCw,
  CheckCircle2,
  Store,
  ExternalLink,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import ReferralBanner from "@/components/ui/ReferralBanner";
import PlanStatusBanner from "@/components/ui/PlanStatusBanner";
import toast from "react-hot-toast";

/* ─── Types ─── */
interface Stats {
  total_orders: number;
  pending: number;
  delivered: number;
  cancelled: number;
  revenue_cents: number;
}
interface StoreData {
  id: string;
  slug: string;
  name: string;
  status: string;
  primary_color: string;
  logo_url?: string;
  plan_slug?: string;
}
interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string;
  items_count: number;
  created_at: string;
}

/* ─── Helpers ─── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatMoney(cents: number) {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "badge-warn" },
  confirmed: { label: "Confirmado", cls: "badge-mute" },
  preparing: { label: "Preparando", cls: "badge-mute" },
  on_the_way: { label: "En camino", cls: "badge-mute" },
  delivered: { label: "Entregado", cls: "badge-success" },
  cancelled: { label: "Cancelado", cls: "badge-danger" },
};

function Skel({ h = 24, className = "" }: { h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h }} />;
}

/* ══════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuthStore();

  const [store, setStore] = useState<StoreData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<{
    store_views: number;
    unique_visitors: number;
    product_views: number;
    add_to_cart: number;
    orders_created: number;
    devices: Record<string, number>;
    top_products: { name: string; views: number }[];
  } | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const firstName = user?.full_name?.split(" ")[0] ?? "vendedor";

  useEffect(() => {
    apiClient
      .get("/stores/me")
      .then(({ data }) => setStore(data))
      .catch(() => setStore(null))
      .finally(() => setLoadingStore(false));
  }, []);

  useEffect(() => {
    if (!store) return;
    setLoadingStats(true);
    const today = toISO(new Date());
    Promise.all([
      apiClient.get("/orders/stats/summary", { params: { from_date: today, to_date: today } }),
      apiClient.get("/orders/", { params: { limit: 4, page: 1 } }),
      apiClient.get("/products/", { params: { limit: 1, page: 1 } }),
    ])
      .then(([statsRes, ordersRes, prodsRes]) => {
        setStats(statsRes.data.this_month);
        setRecent(ordersRes.data.items ?? []);
        setProductCount(prodsRes.data.total ?? 0);
      })
      .catch(() => { })
      .finally(() => setLoadingStats(false));

    apiClient
      .get("/stores/me/analytics", { params: { days: 30 } })
      .then(({ data }) => setAnalytics(data))
      .catch(() => { });
  }, [store]);

  async function resendVerification() {
    setResending(true);
    try {
      await apiClient.post("/auth/resend-verification");
      setResent(true);
      toast.success("Correo reenviado");
    } catch {
      toast.error("No se pudo reenviar");
    } finally {
      setResending(false);
    }
  }

  /* Derived */
  const pending = stats?.pending ?? 0;
  const delivered = stats?.delivered ?? 0;
  const total = stats?.total_orders ?? 0;
  const revenue = stats?.revenue_cents ?? 0;

  /* ── Skeleton ── */
  if (loadingStore) {
    return (
      <div className="px-5 md:px-8 py-5 max-w-3xl mx-auto md:max-w-none xl:max-w-6xl space-y-4 animate-fade-in">
        <Skel h={28} className="w-48" />
        <Skel h={64} />
        <Skel h={120} />
        <Skel h={200} />
      </div>
    );
  }

  /* ── No-store empty state ── */
  if (!store) {
    const isVerified = user?.is_verified ?? false;
    return (
      <div className="px-5 py-5 max-w-md mx-auto md:max-w-lg animate-fade-up">
        <div className="mb-7">
          <p className="eyebrow">{getGreeting()}</p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginTop: 2,
            }}
          >
            Hola, {firstName}
          </h1>
        </div>

        {!isVerified ? (
          <div className="card" style={{ padding: 28, textAlign: "center" }}>
            <Mail size={26} style={{ color: "var(--ink-3)", margin: "0 auto 14px" }} strokeWidth={1.5} />
            <h2 className="text-lg font-medium">Verifica tu correo</h2>
            <p className="text-sm mt-2 mb-6" style={{ color: "var(--ink-2)" }}>
              Te enviamos un enlace a <strong style={{ color: "var(--ink)" }}>{user?.email}</strong>.
              Haz clic ahí para activar tu cuenta y crear tu tienda.
            </p>
            <button
              onClick={resendVerification}
              disabled={resending || resent}
              className="btn-primary w-full disabled:opacity-60"
            >
              {resending ? <RefreshCw size={15} className="animate-spin" /> : resent ? <CheckCircle2 size={15} /> : <Mail size={15} />}
              {resent ? "Correo enviado" : "Reenviar verificación"}
            </button>
            <p className="text-xs mt-4" style={{ color: "var(--ink-3)" }}>
              Revisa tu bandeja y la carpeta de spam.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 28, textAlign: "center" }}>
            <Store size={26} style={{ color: "var(--ink-3)", margin: "0 auto 14px" }} strokeWidth={1.5} />
            <h2 className="text-lg font-medium">Crea tu tienda</h2>
            <p className="text-sm mt-2 mb-6" style={{ color: "var(--ink-2)" }}>
              Configura tu tienda online y empieza a recibir pedidos en minutos.
            </p>
            <Link href="/dashboard/configuracion" className="btn-primary w-full">
              <Plus size={15} /> Crear tienda
            </Link>
          </div>
        )}
      </div>
    );
  }

  /* ── Main dashboard ── */
  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div className="px-5 md:px-10 pt-5 md:pt-8 pb-8 mx-auto max-w-[760px] lg:max-w-6xl">
        {/* Greeting */}
        <div className="animate-fade-up mb-5">
          <p className="eyebrow">{getGreeting()}</p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginTop: 2,
            }}
          >
            Hola, {firstName}
          </h1>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">
        <div className="min-w-0">

        {/* Store strip */}
        <Link
          href="/dashboard/configuracion"
          className="card flex items-center gap-3 mb-5 animate-fade-up"
          style={{ padding: "14px 16px" }}
        >
          {store.logo_url ? (
            // <img
            //   src={store.logo_url}
            //   alt={store.name}
            //   style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
            // />

            <div style={{ position: "relative", width: 38, height: 38, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
              <Image
                src={store.logo_url}
                alt={store.name}
                fill
                sizes="38px"
                className="object-cover"
                unoptimized={store.logo_url.startsWith("http://localhost")}
              />
            </div>

          ) : (
            <div
              className="placeholder flex items-center justify-center"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                flexShrink: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ink-3)",
              }}
            >
              {store.name[0]?.toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
              {store.name}
            </p>
            {/* Link de la tienda: chip visible que abre la tienda pública */}
            <button
              onClick={(e) => {
                e.preventDefault();
                window.open(`/tienda/${store.slug}`, "_blank", "noopener");
              }}
              className="mono inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold max-w-full"
              style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
            >
              <ExternalLink size={11} strokeWidth={2.2} className="flex-shrink-0" />
              <span className="truncate">qtienda.shop/{store.slug}</span>
            </button>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              navigator.share?.({
                title: store.name,
                text: `Visita mi tienda: ${store.name}`,
                url: `${window.location.origin}/tienda/${store.slug}`,
              });
            }}
            className="btn-secondary"
            style={{ padding: "8px 10px", borderRadius: 999 }}
            aria-label="Compartir"
          >
            <Share2 size={14} strokeWidth={1.7} />
          </button>
        </Link>

        {/* Plan actual y aviso de renovación */}
        <PlanStatusBanner />

        {/* Referidos: sube tus límites del plan free */}
        <ReferralBanner />

        {/* Pending alert */}
        {
          !loadingStats && pending > 0 && (
            <Link
              href="/dashboard/pedidos?status=pending"
              className="card flex items-center gap-3 mb-5 animate-fade-up"
              style={{ padding: "14px 16px" }}
            >
              <span className="dot dot-warn" style={{ width: 8, height: 8 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {pending} pedido{pending !== 1 ? "s" : ""} esperan respuesta
                </p>
                <p className="text-xs" style={{ color: "var(--ink-3)", marginTop: 2 }}>
                  Confírmalos para avisar al cliente
                </p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--ink-3)" }} />
            </Link>
          )
        }

        {/* Onboarding checklist */}
        {
          !loadingStats && productCount !== null && productCount === 0 && (
            <div className="card mb-5 p-4 animate-fade-up">
              <p className="eyebrow mb-3">Para que tu tienda esté lista</p>
              {(
                [
                  {
                    label: "Tienda creada",
                    sub: store.name,
                    done: true,
                    href: "/dashboard/configuracion",
                  },
                  {
                    label: "Primer producto",
                    sub: "Una foto y un precio",
                    done: false,
                    href: "/dashboard/productos",
                  },
                  {
                    label: "Cómo recibes pagos",
                    sub: "Yape, transferencia, contra entrega",
                    done: false,
                    href: "/dashboard/configuracion",
                  },
                  {
                    label: "Compartir tu link",
                    sub: `qtienda.shop/${store.slug}`,
                    done: false,
                    onClick: () =>
                      navigator.share?.({
                        title: store.name,
                        text: `Visita mi tienda: ${store.name}`,
                        url: `${window.location.origin}/tienda/${store.slug}`,
                      }),
                  },
                ] as const
              ).map((step, i) => {
                const content = (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                    style={{
                      padding: "12px 0",
                      borderTop: i === 0 ? "0" : "1px solid var(--line)",
                    }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0 rounded-full"
                      style={{
                        width: 18,
                        height: 18,
                        background: step.done ? "var(--ink)" : "transparent",
                        border: step.done ? "0" : "1.5px solid var(--ink-4)",
                        color: "var(--bg)",
                      }}
                    >
                      {step.done && <CheckCircle2 size={11} strokeWidth={2.5} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        className="text-sm font-medium truncate"
                        style={{
                          color: step.done ? "var(--ink-3)" : "var(--ink)",
                          textDecoration: step.done ? "line-through" : "none",
                        }}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--ink-3)", marginTop: 1 }}>
                        {step.sub}
                      </p>
                    </div>
                    {!step.done && <ChevronRight size={15} style={{ color: "var(--ink-4)" }} />}
                  </div>
                );
                if ("onClick" in step && step.onClick)
                  return (
                    <button key={i} onClick={step.onClick} className="w-full text-left">
                      {content}
                    </button>
                  );
                if ("href" in step && step.href)
                  return (
                    <Link key={i} href={step.href} className="block">
                      {content}
                    </Link>
                  );
                return content;
              })}
            </div>
          )
        }

        <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        {/* Today — typographic, no boxes */}
        {
          !loadingStats && (
            <div className={`animate-fade-up mb-7 ${analytics && analytics.store_views > 0 ? "" : "md:col-span-2"}`}>
              <p className="eyebrow mb-3">Hoy</p>
              {/* Tarjetas con color: pedidos (terracota), vendido (verde), entregados (ámbar) */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { value: total.toString(), label: "pedidos", icon: ShoppingBag, bg: "var(--accent-soft)", fg: "var(--accent-ink)", ic: "var(--accent)" },
                  { value: formatMoney(revenue), label: "vendido", icon: TrendingUp, bg: "var(--success-soft)", fg: "var(--success)", ic: "var(--success)" },
                  { value: delivered.toString(), label: "entregados", icon: CheckCircle2, bg: "var(--warn-soft)", fg: "var(--warn)", ic: "var(--warn)" },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="rounded-2xl"
                    style={{ background: s.bg, padding: "14px 12px" }}
                  >
                    <s.icon size={15} strokeWidth={2} style={{ color: s.ic }} />
                    <div
                      className="mono num truncate"
                      style={{ fontSize: 21, fontWeight: 600, lineHeight: 1, color: s.fg, marginTop: 8 }}
                    >
                      {s.value}
                    </div>
                    <div className="text-xs mt-1.5 font-medium" style={{ color: s.fg, opacity: 0.75 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        {/* Visitas (últimos 30 días) */}
        {analytics && analytics.store_views > 0 && (
          <div className="animate-fade-up mb-7">
            <p className="eyebrow mb-3">Tu tienda · últimos 30 días</p>
            <div
              className="grid grid-cols-3"
              style={{
                borderTop: "1px solid var(--line)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              {[
                { value: analytics.store_views.toString(), label: "visitas" },
                { value: analytics.unique_visitors.toString(), label: "visitantes" },
                {
                  value: analytics.store_views
                    ? `${Math.round((analytics.orders_created / analytics.store_views) * 100)}%`
                    : "0%",
                  label: "conversión",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: "16px 14px",
                    borderRight: i < 2 ? "1px solid var(--line)" : "0",
                  }}
                >
                  <div
                    className="mono num"
                    style={{ fontSize: 22, fontWeight: 500, lineHeight: 1 }}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs mt-1.5" style={{ color: "var(--ink-3)" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            {analytics.top_products.length > 0 && (
              <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>
                Más visto: <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{analytics.top_products[0].name}</span>
                {" "}({analytics.top_products[0].views} vistas)
              </p>
            )}
          </div>
        )}

        </div>

        </div>{/* /col izquierda */}

        {/* ── Columna derecha (sticky, solo desktop): pedidos recientes + plan ── */}
        <div className="lg:sticky lg:top-6">

        {/* Recent orders */}
        {
          recent.length > 0 && (
            <div className="animate-fade-up mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="eyebrow">Últimos pedidos</p>
                <Link
                  href="/dashboard/pedidos"
                  className="text-xs font-medium underline"
                  style={{ color: "var(--ink-2)", textUnderlineOffset: 2 }}
                >
                  Ver todos
                </Link>
              </div>
              <div className="card overflow-hidden">
                {recent.map((order, idx) => {
                  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
                  return (
                    <Link
                      href={`/dashboard/pedidos`}
                      key={order.id}
                      className="flex items-center gap-3"
                      style={{
                        padding: "14px 16px",
                        borderTop: idx > 0 ? "1px solid var(--line)" : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--ink)" }}
                        >
                          {order.buyer_name}
                        </p>
                        <p
                          className="mono text-[11px]"
                          style={{ color: "var(--ink-3)", marginTop: 2 }}
                        >
                          #{order.order_number} · {order.items_count} ítem
                          {order.items_count !== 1 ? "s" : ""} · {timeAgo(order.created_at)}
                        </p>
                      </div>
                      <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )
        }

        {/* Plan strip */}
        {
          (!store.plan_slug || store.plan_slug === "free") && (
            <Link
              href="/dashboard/planes"
              className="card flex items-center gap-3 animate-fade-up"
              style={{ padding: "14px 16px" }}
            >
              <div style={{ flex: 1 }}>
                <p className="text-sm font-medium">Plan Free</p>
                <p className="text-xs" style={{ color: "var(--ink-3)", marginTop: 2 }}>
                  Dominio propio y reportes en Pro
                </p>
              </div>
              <span className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Ver planes
              </span>
            </Link>
          )
        }
        </div>{/* /col derecha */}

      </div >{/* /grid principal */}
      </div >
    </div >
  );
}
