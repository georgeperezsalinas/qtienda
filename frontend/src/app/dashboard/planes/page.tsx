"use client";

// src/app/dashboard/planes/page.tsx — qtienda v2 (con useCulqi)
//
// CAMBIOS vs versión anterior:
//   - Reemplaza la lógica de Culqi inline por el hook useCulqi
//   - Agrega div#culqi-container requerido por el modal de Culqi
//   - Limpia el declare global duplicado (ya está en useCulqi.ts)
//   - Migra fetching a React Query con useQuery

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Zap, Crown, Sparkles, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useCulqi } from "@/hooks/useCulqi";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import { track } from "@vercel/analytics";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  max_products: number | null;
  max_orders_mo: number | null;
  features: string[];
}

interface Subscription {
  status: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  plan_slug: string;
}

const PLAN_VISUAL: Record<string, {
  icon: React.ReactNode;
  gradient: string;
  badge?: string;
  color: string;
  border: string;
}> = {
  free: {
    icon: <Sparkles size={22} />,
    gradient: "linear-gradient(135deg, #64748B, #475569)",
    color: "#475569",
    border: "#CBD5E1",
  },
  pro: {
    icon: <Zap size={22} />,
    gradient: "linear-gradient(135deg, #C5613B, #9B4A2A)",
    badge: "Más popular",
    color: "#C5613B",
    border: "#E8A882",
  },
  elite: {
    icon: <Crown size={22} />,
    gradient: "linear-gradient(135deg, #D97706, #B45309)",
    color: "#B45309",
    border: "#FCD34D",
  },
};

function formatPricePlan(cents: number): string {
  if (cents === 0) return "Gratis";
  return `S/ ${(cents / 100).toFixed(0)}`;
}

function PlanCard({
  plan,
  isCurrent,
  onUpgrade,
  loading,
}: {
  plan: Plan;
  isCurrent: boolean;
  onUpgrade: (plan: Plan) => void;
  loading: boolean;
}) {
  const visual = PLAN_VISUAL[plan.slug] ?? PLAN_VISUAL.free;
  const isPro = plan.slug === "pro";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "var(--surface)",
        border: `2px solid ${isCurrent ? visual.border : "var(--line)"}`,
        boxShadow: isCurrent ? "0 4px 24px rgba(0,0,0,.08)" : "0 1px 4px rgba(0,0,0,.04)",
        transform: isPro ? "scale(1.01)" : "scale(1)",
      }}
    >
      {/* Header con gradiente */}
      <div className="px-5 pt-5 pb-4" style={{ background: visual.gradient }}>
        <div className="flex items-start justify-between">
          <div className="text-white opacity-90">{visual.icon}</div>
          <div className="flex flex-col items-end gap-1">
            {visual.badge && (
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}
              >
                {visual.badge}
              </span>
            )}
            {isCurrent && (
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}
              >
                Plan actual
              </span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-white font-bold text-lg">{plan.name}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-white text-2xl font-bold">
              {formatPricePlan(plan.price_cents)}
            </span>
            {plan.price_cents > 0 && (
              <span className="text-white/70 text-sm">/ mes</span>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-5 py-4">
        <ul className="space-y-2.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: `${visual.color}18` }}
              >
                <Check size={11} strokeWidth={3} style={{ color: visual.color }} />
              </div>
              <span className="text-sm" style={{ color: "var(--ink-2)" }}>{f}</span>
            </li>
          ))}
        </ul>

        <div
          className="mt-4 pt-4 flex gap-3 text-xs"
          style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}
        >
          <span>
            {plan.max_products == null
              ? "Productos ilimitados"
              : `Hasta ${plan.max_products} productos`}
          </span>
          <span className="opacity-30">·</span>
          <span>
            {plan.max_orders_mo == null
              ? "Pedidos ilimitados"
              : `${plan.max_orders_mo} pedidos/mes`}
          </span>
        </div>

        <div className="mt-4">
          {isCurrent ? (
            <div
              className="w-full text-center text-sm font-semibold py-3 rounded-xl"
              style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}
            >
              Tu plan actual
            </div>
          ) : plan.price_cents === 0 ? (
            <div
              className="w-full text-center text-sm font-semibold py-3 rounded-xl"
              style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}
            >
              Plan base
            </div>
          ) : (
            <button
              onClick={() => onUpgrade(plan)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: visual.gradient,
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: `0 4px 12px ${visual.color}40`,
              }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Activar {plan.name}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════ */

export default function PlanesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ── Data con React Query ─────────────────────────
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await apiClient.get("/plans/");
      return data as Plan[];
    },
    staleTime: 10 * 60 * 1000, // los planes cambian muy poco
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await apiClient.get("/plans/my-subscription");
      return data as Subscription;
    },
    retry: false, // 404 si no tiene suscripción activa — no reintentar
  });

  // ── Mutación de suscripción ──────────────────────
  const subscribeMutation = useMutation({
    mutationFn: async ({ planId, token }: { planId: string; token: string }) => {
      const { data } = await apiClient.post("/plans/subscribe", {
        plan_id: planId,
        culqi_token: token,
      });
      return data;
    },
    onSuccess: (data, { planId }) => {
      const plan = plans.find(p => p.id === planId);
      toast.success("¡Plan activado! Bienvenido 🎉");
      track("plan_upgraded", {
        plan_slug: plan?.slug ?? "unknown",
        amount_soles: (plan?.price_cents ?? 0) / 100,
      });
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Error al procesar el pago");
    },
  });

  // ── Culqi hook ───────────────────────────────────
  // selectedPlan se actualiza dinámicamente via ref en el hook
  const selectedPlanRef = { current: plans[0] };

  const { openCulqi, loading: culqiLoading } = useCulqi({
    amount: selectedPlanRef.current?.price_cents ?? 0,
    currency: "PEN",
    title: "qtienda",
    description: `Plan ${selectedPlanRef.current?.name ?? ""} mensual`,
    email: user?.email,
    onSuccess: async (token) => {
      await subscribeMutation.mutateAsync({
        planId: selectedPlanRef.current.id,
        token,
      });
    },
    onError: (msg) => toast.error(msg),
  });

  const handleUpgrade = useCallback((plan: Plan) => {
    selectedPlanRef.current = plan;
    openCulqi();
  }, [openCulqi]);

  const currentSlug = subscription?.plan_slug ?? "free";
  const isLoading = culqiLoading || subscribeMutation.isPending;

  return (
    <div style={{ padding: "20px 20px 40px", fontFamily: "var(--font-sans)", maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 mb-5"
        style={{ background: "transparent", border: "none", color: "var(--ink-3)", fontSize: 13, cursor: "pointer" }}
      >
        <ArrowLeft size={15} /> Volver
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
        Planes
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 24px" }}>
        Elige el plan que mejor se adapta a tu negocio.
      </p>

      {/* Estado de suscripción actual */}
      {subscription && subscription.status !== "free" && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-5 text-sm font-medium"
          style={{ background: "var(--success-soft)", color: "var(--success)" }}
        >
          <Check size={15} strokeWidth={2.5} />
          Suscripción {subscription.status === "active" ? "activa" : subscription.status}
          {subscription.ends_at && (
            <span style={{ opacity: 0.7, marginLeft: 4 }}>
              · vence {new Date(subscription.ends_at).toLocaleDateString("es-PE")}
            </span>
          )}
        </div>
      )}

      {/* Grid de planes */}
      {loadingPlans ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 320, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.slug === currentSlug}
              onUpgrade={handleUpgrade}
              loading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Contenedor requerido por el modal de Culqi */}
      <div id="culqi-container" />
    </div>
  );
}
