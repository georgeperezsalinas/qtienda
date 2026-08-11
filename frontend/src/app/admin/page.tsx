"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Store, Users, ShoppingBag, TrendingUp, Clock, ArrowRight, ShieldAlert,
  Package, ScrollText, Server, GitBranch, Database, Timer, Globe, Smartphone, Monitor,
  CreditCard, MessageCircle, Image as ImageIcon, Star,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Metrics {
  stores: { total: number; active: number; pending: number; suspended: number; test: number; without_products: number; onboarding_incomplete: number };
  users: { total: number };
  products: { total: number };
  orders: { total: number };
  plan_requests: { pending: number };
  subscriptions: { expiring_soon: number };
  this_month: { orders: number; revenue_cents: number };
  trend: { date: string; stores: number; users: number }[];
  top_stores: { id: string; name: string; slug: string; orders: number; revenue_cents: number }[];
  technical: {
    version: string;
    environment: string;
    uptime_seconds: number | null;
    database: string;
    plan_expiry_watcher: boolean;
  };
}

interface SiteTraffic {
  period_days: number;
  site: {
    page_views: number;
    unique_visitors: number;
    devices: Record<string, number>;
    top_paths: { path: string; views: number }[];
  };
  stores: {
    store_views: number;
    product_views: number;
    add_to_cart: number;
    checkout_start: number;
    unique_visitors: number;
    devices: Record<string, number>;
    top_viewed: { id: string; name: string; slug: string; views: number }[];
  };
}

function StatCard({
  label, value, sub, icon, iconBg, iconColor, accent,
}: {
  label:      string;
  value:      string | number;
  sub?:       string;
  icon:       React.ReactNode;
  iconBg:     string;
  iconColor:  string;
  accent?:    boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: accent ? "var(--brand-600)" : "var(--surface-0)",
        border:     accent ? "none" : "1.5px solid var(--line-2)",
        boxShadow:  accent ? "var(--shadow-brand)" : "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? "rgba(255,255,255,.2)" : iconBg }}
        >
          <span style={{ color: accent ? "#fff" : iconColor }}>{icon}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color: accent ? "rgba(255,255,255,.7)" : "var(--ink-3)" }}>
          {label}
        </span>
      </div>
      <div>
        <p
          className="font-display font-extrabold text-2xl leading-none"
          style={{ color: accent ? "#fff" : "var(--ink)" }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs font-semibold mt-1" style={{ color: accent ? "rgba(255,255,255,.65)" : "var(--ink-3)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* 12-14 punto sparkline — una sola serie, sin necesidad de leyenda (el título del tile ya la nombra) */
function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  const w = 100, h = 28, pad = 2;
  const max = Math.max(1, ...data);
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data.map((v, i) => [
    pad + i * stepX,
    pad + (1 - v / max) * (h - pad * 2),
  ]);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${points[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 28 }} preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TrendTile({ label, data, total }: { label: string; data: number[]; total: number }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
    >
      <p className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{label}</p>
      <p className="font-display font-extrabold text-2xl leading-none mt-2" style={{ color: "var(--ink)" }}>
        +{total}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-4)" }}>últimos 14 días</p>
      <div className="mt-2">
        <Sparkline data={data} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: "var(--surface-2)" }}>
      <p className="text-[10px]" style={{ color: "var(--ink-3)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{value}</p>
    </div>
  );
}

function formatUptime(seconds: number | null) {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function TechRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--ink-3)" }}>{icon}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>{label}</span>
      </div>
      <span className="text-xs font-bold mono" style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

function Skel({ h = 24, className = "" }: { h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h, borderRadius: 16 }} />;
}

/* Embudo de conversion — barras finas de una sola serie, etiqueta directa al final de cada una */
function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs w-28 flex-shrink-0 truncate" style={{ color: "var(--ink-2)" }}>{label}</p>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--surface-2)", height: 20 }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
      <p className="text-xs font-bold w-10 text-right flex-shrink-0" style={{ color: "var(--ink)" }}>{value}</p>
    </div>
  );
}

function DeviceSplit({ devices }: { devices: Record<string, number> }) {
  const total = Object.values(devices).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-xs" style={{ color: "var(--ink-4)" }}>Sin datos todavía</p>;
  const mobile = devices.mobile ?? 0;
  const desktop = (devices.desktop ?? 0) + (devices.tablet ?? 0);
  return (
    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--ink-2)" }}>
      <span className="flex items-center gap-1.5">
        <Smartphone size={13} style={{ color: "var(--accent-ink)" }} />
        {Math.round((mobile / total) * 100)}% móvil
      </span>
      <span className="flex items-center gap-1.5">
        <Monitor size={13} style={{ color: "var(--ink-3)" }} />
        {Math.round((desktop / total) * 100)}% escritorio
      </span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [traffic, setTraffic] = useState<SiteTraffic | null>(null);
  const [loading, setLoading] = useState(true);

  function loadMetrics() {
    apiClient
      .get("/admin/metrics")
      .then(({ data }) => setMetrics(data))
      .finally(() => setLoading(false));
    apiClient
      .get("/admin/site-traffic")
      .then(({ data }) => setTraffic(data))
      .catch(() => {});
  }

  useEffect(() => { loadMetrics(); }, []);

  const storesTrend = metrics?.trend.map((t) => t.stores) ?? [];
  const usersTrend = metrics?.trend.map((t) => t.users) ?? [];
  const newStores = storesTrend.reduce((a, b) => a + b, 0);
  const newUsers = usersTrend.reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-5 py-6 space-y-6">

      <div>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Panel de administración
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          Resumen global de la plataforma
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skel key={i} h={108} />)}
        </div>
      ) : metrics && (
        <>
          <div className="grid grid-cols-2 gap-3 animate-fade-up">
            <StatCard
              label="Ingresos del mes"
              value={formatPrice(metrics.this_month.revenue_cents)}
              sub={`${metrics.this_month.orders} pedidos`}
              icon={<TrendingUp size={16} />}
              iconBg="transparent"
              iconColor="#fff"
              accent
            />
            <StatCard
              label="Pedidos del mes"
              value={metrics.this_month.orders}
              icon={<ShoppingBag size={15} />}
              iconBg="var(--brand-50)"
              iconColor="var(--brand-600)"
            />
            <StatCard
              label="Tiendas activas"
              value={metrics.stores.active}
              sub={`de ${metrics.stores.total} total`}
              icon={<Store size={15} />}
              iconBg="var(--success-soft)"
              iconColor="var(--success)"
            />
            <StatCard
              label="Usuarios"
              value={metrics.users.total}
              icon={<Users size={15} />}
              iconBg="var(--accent-soft)"
              iconColor="var(--accent-ink)"
            />
          </div>

          {/* Resumen de la app */}
          <div>
            <h2 className="font-display font-bold text-sm mb-2" style={{ color: "var(--ink)" }}>
              Datos de la aplicación
            </h2>
            <div className="grid grid-cols-4 gap-2">
              <MiniStat label="Productos" value={metrics.products.total} />
              <MiniStat label="Pedidos histórico" value={metrics.orders.total} />
              <MiniStat label="Tiendas pendientes" value={metrics.stores.pending} />
              <MiniStat label="Pagos pendientes" value={metrics.plan_requests.pending} />
            </div>
          </div>

          {/* Tendencia de altas */}
          <div>
            <h2 className="font-display font-bold text-sm mb-2" style={{ color: "var(--ink)" }}>
              Altas recientes
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <TrendTile label="Tiendas nuevas" data={storesTrend} total={newStores} />
              <TrendTile label="Usuarios nuevos" data={usersTrend} total={newUsers} />
            </div>
          </div>

          {/* Estadísticas por tienda */}
          <div>
            <h2 className="font-display font-bold text-sm mb-2" style={{ color: "var(--ink)" }}>
              Tiendas destacadas
            </h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              {metrics.top_stores.length === 0 ? (
                <p className="text-xs p-4 text-center" style={{ color: "var(--ink-3)" }}>
                  Todavía no hay ventas registradas para rankear tiendas.
                </p>
              ) : (
                metrics.top_stores.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/admin/tiendas?q=${encodeURIComponent(s.slug)}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{ borderTop: i > 0 ? "1px solid var(--line)" : undefined }}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{s.name}</p>
                      <p className="text-xs" style={{ color: "var(--ink-3)" }}>{s.orders} pedido{s.orders !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: "var(--ink)" }}>
                      {formatPrice(s.revenue_cents)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Tráfico del sitio */}
          <div>
            <h2 className="font-display font-bold text-sm mb-2" style={{ color: "var(--ink)" }}>
              Tráfico de qtienda.shop
              {traffic && <span className="font-normal" style={{ color: "var(--ink-4)" }}> · últimos {traffic.period_days} días</span>}
            </h2>

            {!traffic ? (
              <Skel h={220} />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Landing + directorio */}
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Globe size={15} style={{ color: "var(--ink-3)" }} />
                    <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Landing y directorio</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <MiniStat label="Vistas de página" value={traffic.site.page_views} />
                    <MiniStat label="Visitantes únicos" value={traffic.site.unique_visitors} />
                  </div>
                  <DeviceSplit devices={traffic.site.devices} />
                  {traffic.site.top_paths.length > 0 && (
                    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                      {traffic.site.top_paths.slice(0, 5).map((p) => (
                        <div key={p.path} className="flex items-center justify-between text-xs">
                          <span className="mono truncate" style={{ color: "var(--ink-2)" }}>{p.path}</span>
                          <span className="font-bold flex-shrink-0" style={{ color: "var(--ink)" }}>{p.views}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Embudo de tiendas */}
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Store size={15} style={{ color: "var(--ink-3)" }} />
                    <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>Tiendas (todas)</p>
                  </div>
                  <div className="space-y-2 mb-3">
                    <FunnelBar label="Vieron tienda" value={traffic.stores.store_views} max={traffic.stores.store_views} />
                    <FunnelBar label="Vieron producto" value={traffic.stores.product_views} max={traffic.stores.store_views} />
                    <FunnelBar label="Agregó carrito" value={traffic.stores.add_to_cart} max={traffic.stores.store_views} />
                    <FunnelBar label="Fue a pagar" value={traffic.stores.checkout_start} max={traffic.stores.store_views} />
                  </div>
                  <DeviceSplit devices={traffic.stores.devices} />
                  {traffic.stores.top_viewed.length > 0 && (
                    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                      {traffic.stores.top_viewed.slice(0, 5).map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs">
                          <span className="truncate" style={{ color: "var(--ink-2)" }}>{s.name}</span>
                          <span className="font-bold flex-shrink-0" style={{ color: "var(--ink)" }}>{s.views}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="space-y-3">
            <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
              Acciones rápidas
            </h2>

            <Link
              href="/admin/tiendas?status=pending"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--warn-soft)" }}>
                <Clock size={18} style={{ color: "var(--warn)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Tiendas pendientes</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>Revisar y aprobar solicitudes</p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>

            {metrics.stores.without_products > 0 && (
              <Link
                href="/admin/tiendas?status=sin-productos"
                className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--danger-soft)" }}>
                  <Package size={18} style={{ color: "var(--danger)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Tiendas sin productos</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {metrics.stores.without_products} tienda{metrics.stores.without_products !== 1 ? "s" : ""} activa{metrics.stores.without_products !== 1 ? "s" : ""} sin publicar nada
                  </p>
                </div>
                <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
              </Link>
            )}

            {metrics.subscriptions.expiring_soon > 0 && (
              <Link
                href="/admin/pagos?view=expiring"
                className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--warn-soft)" }}>
                  <CreditCard size={18} style={{ color: "var(--warn)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Suscripciones por vencer</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {metrics.subscriptions.expiring_soon} vencida{metrics.subscriptions.expiring_soon !== 1 ? "s" : ""} o por vencer en 14 días
                  </p>
                </div>
                <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
              </Link>
            )}

            {metrics.stores.onboarding_incomplete > 0 && (
              <Link
                href="/admin/campana"
                className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#25D36622" }}>
                  <MessageCircle size={18} style={{ color: "#128C7E" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Onboarding incompleto</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {metrics.stores.onboarding_incomplete} tienda{metrics.stores.onboarding_incomplete !== 1 ? "s" : ""} sin logo, banner o productos — contactar por WhatsApp
                  </p>
                </div>
                <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
              </Link>
            )}

            <Link
              href="/admin/tiendas"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)" }}>
                <Store size={18} style={{ color: "var(--brand-600)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Gestionar tiendas</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {metrics.stores.total} tiendas registradas
                </p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>

            <Link
              href="/admin/usuarios"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                <Users size={18} style={{ color: "var(--accent-ink)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Ver usuarios</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {metrics.users.total} usuarios registrados
                </p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>

            <Link
              href="/admin/pedidos"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--success-soft)" }}>
                <ShoppingBag size={18} style={{ color: "var(--success)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Ver pedidos</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {metrics.orders.total} pedidos registrados
                </p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>

            <Link
              href="/admin/mall-banners"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                <ImageIcon size={18} style={{ color: "var(--ink-2)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Banners del Mall</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>Imágenes rotatorias en /tiendas</p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>

            <Link
              href="/admin/resenas"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--warn-soft)" }}>
                <Star size={18} style={{ color: "var(--warn)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Reseñas</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>Moderar reseñas de compradores</p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>

            <Link
              href="/admin/auditoria"
              className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                <ScrollText size={18} style={{ color: "var(--ink-2)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Auditoría</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>Historial de acciones admin</p>
              </div>
              <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
            </Link>
          </div>

          {/* Datos técnicos */}
          <div>
            <h2 className="font-display font-bold text-sm mb-2" style={{ color: "var(--ink)" }}>
              Datos técnicos de qtienda
            </h2>
            <div
              className="rounded-2xl px-4"
              style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
            >
              <TechRow icon={<GitBranch size={14} />} label="Versión API" value={metrics.technical.version} />
              <TechRow
                icon={<Server size={14} />}
                label="Entorno"
                value={metrics.technical.environment === "production" ? "Producción" : "Desarrollo"}
              />
              <TechRow icon={<Timer size={14} />} label="Uptime del servidor" value={formatUptime(metrics.technical.uptime_seconds)} />
              <TechRow icon={<Database size={14} />} label="Base de datos" value={metrics.technical.database} />
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--ink-3)" }}><Package size={14} /></span>
                  <span className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>Watcher de vencimiento de planes</span>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: metrics.technical.plan_expiry_watcher ? "var(--success-soft)" : "var(--danger-soft)",
                    color: metrics.technical.plan_expiry_watcher ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {metrics.technical.plan_expiry_watcher ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      <div
        className="flex items-start gap-3 p-4 rounded-2xl"
        style={{ background: "var(--warn-soft)", border: "1.5px solid var(--line-2)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface-0)" }}>
          <ShieldAlert size={18} style={{ color: "var(--warn)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--warn)" }}>
            Limpieza controlada de marcha blanca
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>
            El reset masivo está deshabilitado en producción. Para tiendas de prueba usa
            <strong> Gestionar tiendas</strong>, revisa el detalle y elimina individualmente con auditoría.
          </p>
        </div>
      </div>

    </div>
  );
}
