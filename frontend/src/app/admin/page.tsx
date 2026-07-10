"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Users, ShoppingBag, TrendingUp, Clock, ArrowRight, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Metrics {
  stores:     { total: number; active: number };
  users:      { total: number };
  this_month: { orders: number; revenue_cents: number };
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
        border:     accent ? "none" : "1.5px solid #E2E8F0",
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

function Skel({ h = 24, className = "" }: { h?: number; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ height: h, borderRadius: 16 }} />;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  function loadMetrics() {
    apiClient
      .get("/admin/metrics")
      .then(({ data }) => setMetrics(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMetrics(); }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">

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
            iconBg="#D1FAE5"
            iconColor="#059669"
          />
          <StatCard
            label="Usuarios"
            value={metrics.users.total}
            icon={<Users size={15} />}
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
          />
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
          Acciones rápidas
        </h2>

        <Link
          href="/admin/tiendas?status=pending"
          className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
          style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FEF3C7" }}>
            <Clock size={18} style={{ color: "#D97706" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Tiendas pendientes</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>Revisar y aprobar solicitudes</p>
          </div>
          <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
        </Link>

        <Link
          href="/admin/tiendas"
          className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
          style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-50)" }}>
            <Store size={18} style={{ color: "var(--brand-600)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Gestionar tiendas</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              {metrics ? `${metrics.stores.total} tiendas registradas` : "Ver todas las tiendas"}
            </p>
          </div>
          <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
        </Link>

        <Link
          href="/admin/usuarios"
          className="flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-[.98]"
          style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EDE9FE" }}>
            <Users size={18} style={{ color: "#7C3AED" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Ver usuarios</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              {metrics ? `${metrics.users.total} usuarios registrados` : "Ver todos los usuarios"}
            </p>
          </div>
          <ArrowRight size={16} style={{ color: "var(--ink-4)" }} />
        </Link>
      </div>

      <div
        className="flex items-start gap-3 p-4 rounded-2xl"
        style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#FEF3C7" }}>
          <ShieldAlert size={18} style={{ color: "#B45309" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
            Limpieza controlada de marcha blanca
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "#B45309" }}>
            El reset masivo está deshabilitado en producción. Para tiendas de prueba usa
            <strong> Gestionar tiendas</strong>, revisa el detalle y elimina individualmente con auditoría.
          </p>
        </div>
      </div>

    </div>
  );
}
