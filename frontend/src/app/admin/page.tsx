"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Users, ShoppingBag, TrendingUp, Clock, ArrowRight, Trash2, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import toast from "react-hot-toast";

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

interface ResetResult {
  deleted: { orders: number; stores: number; users: number };
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const [resetOpen,    setResetOpen]    = useState(false);
  const [resetInput,   setResetInput]   = useState("");
  const [resetting,    setResetting]    = useState(false);
  const [resetResult,  setResetResult]  = useState<ResetResult | null>(null);

  function loadMetrics() {
    apiClient
      .get("/admin/metrics")
      .then(({ data }) => setMetrics(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMetrics(); }, []);

  async function handleReset() {
    if (resetInput !== "RESET") return;
    setResetting(true);
    try {
      const { data } = await apiClient.post<ResetResult>("/admin/reset-test-data", { confirm: "RESET" });
      setResetResult(data);
      setResetOpen(false);
      setResetInput("");
      toast.success("Datos de prueba eliminados");
      setLoading(true);
      loadMetrics();
    } catch {
      toast.error("Error al resetear los datos");
    } finally {
      setResetting(false);
    }
  }

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

      {/* Zona de pruebas */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
          Zona de pruebas
        </h2>

        {resetResult && (
          <div
            className="p-4 rounded-2xl text-sm space-y-1"
            style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
          >
            <p className="font-bold" style={{ color: "#15803D" }}>Reset completado</p>
            <p style={{ color: "#166534" }}>
              {resetResult.deleted.orders} pedidos · {resetResult.deleted.stores} tiendas · {resetResult.deleted.users} usuarios eliminados
            </p>
          </div>
        )}

        <button
          onClick={() => { setResetOpen(true); setResetResult(null); }}
          className="flex items-center gap-3 p-4 rounded-2xl w-full text-left transition-all active:scale-[.98]"
          style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FEE2E2" }}>
            <Trash2 size={18} style={{ color: "#DC2626" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>Resetear datos de prueba</p>
            <p className="text-xs mt-0.5" style={{ color: "#EF4444" }}>
              Elimina todos los usuarios, tiendas y pedidos (excepto admin)
            </p>
          </div>
        </button>
      </div>

      {/* Modal confirmación reset */}
      {resetOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={() => setResetOpen(false)}
          />
          <div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-3xl p-6 max-w-sm mx-auto"
            style={{ background: "var(--surface-0)", boxShadow: "0 24px 64px rgba(15,23,42,.24)" }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#FEE2E2" }}>
              <AlertTriangle size={22} style={{ color: "#DC2626" }} />
            </div>

            <h3 className="font-display font-extrabold text-lg text-center mb-1" style={{ color: "var(--ink)" }}>
              ¿Resetear datos de prueba?
            </h3>
            <p className="text-sm text-center mb-5" style={{ color: "var(--ink-3)" }}>
              Se eliminarán <strong>todos los usuarios, tiendas y pedidos</strong> de la plataforma. El usuario admin se mantiene. Esta acción es <strong>irreversible</strong>.
            </p>

            <p className="text-xs font-bold mb-2" style={{ color: "var(--ink-2)" }}>
              Escribe <span style={{ color: "#DC2626" }}>RESET</span> para confirmar
            </p>
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="RESET"
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm font-mono mb-4 outline-none"
              style={{
                border: "1.5px solid",
                borderColor: resetInput === "RESET" ? "#DC2626" : "#E2E8F0",
                background: "var(--surface-1)",
                color: "var(--ink)",
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setResetOpen(false); setResetInput(""); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ background: "var(--surface-1)", color: "var(--ink-2)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={resetInput !== "RESET" || resetting}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: resetInput === "RESET" ? "#DC2626" : "#FECACA",
                  color: "#fff",
                  cursor: resetInput === "RESET" ? "pointer" : "not-allowed",
                }}
              >
                {resetting ? "Eliminando..." : "Resetear todo"}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
