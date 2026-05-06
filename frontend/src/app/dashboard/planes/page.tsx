"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Zap, Crown, Sparkles, Loader2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

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

declare global {
  interface Window {
    Culqi: {
      publicKey: string;
      settings: (config: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
    };
    culqiAction: () => void;
    culqiError: () => void;
  }
}

const CULQI_PUBLIC_KEY = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "";

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
    gradient: "linear-gradient(135deg, var(--brand-600), #7C3AED)",
    badge: "Más popular",
    color: "var(--brand-700)",
    border: "var(--brand-300)",
  },
  elite: {
    icon: <Crown size={22} />,
    gradient: "linear-gradient(135deg, #D97706, #B45309)",
    color: "#B45309",
    border: "#FCD34D",
  },
};

function formatPrice(cents: number): string {
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
        background: "var(--surface-0)",
        border: `2px solid ${isCurrent ? visual.border : "#F1F5F9"}`,
        boxShadow: isCurrent
          ? "0 4px 24px rgba(0,0,0,.08)"
          : "0 1px 4px rgba(0,0,0,.04)",
        transform: isPro ? "scale(1.01)" : "scale(1)",
      }}
    >
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
          <p className="text-white font-display font-bold text-lg">{plan.name}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-white text-2xl font-display font-bold">
              {formatPrice(plan.price_cents)}
            </span>
            {plan.price_cents > 0 && (
              <span className="text-white/70 text-sm">/ mes</span>
            )}
          </div>
        </div>
      </div>

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
              <span className="text-sm" style={{ color: "var(--ink-2)" }}>
                {f}
              </span>
            </li>
          ))}
        </ul>

        <div
          className="mt-4 pt-4 flex gap-3 text-xs"
          style={{ borderTop: "1px solid #F1F5F9", color: "var(--ink-3)" }}
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
              style={{ background: "var(--surface-1)", color: "var(--ink-3)" }}
            >
              Tu plan actual
            </div>
          ) : plan.price_cents === 0 ? (
            <div
              className="w-full text-center text-sm font-semibold py-3 rounded-xl"
              style={{ background: "var(--surface-1)", color: "var(--ink-3)" }}
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
                boxShadow: `0 4px 12px ${visual.color}40`,
              }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>Actualizar a {plan.name}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  plan,
  onConfirm,
  onClose,
  loading,
}: {
  plan: Plan;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const visual = PLAN_VISUAL[plan.slug] ?? PLAN_VISUAL.free;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 z-10"
        style={{ background: "var(--surface-0)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: "var(--ink-3)" }}
        >
          <X size={18} />
        </button>

        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-white"
          style={{ background: visual.gradient }}
        >
          {visual.icon}
        </div>

        <h2 className="font-display font-bold text-lg mb-1" style={{ color: "var(--ink)" }}>
          Suscribirse a {plan.name}
        </h2>
        <p className="text-sm mb-5" style={{ color: "var(--ink-3)" }}>
          Se cobrará {formatPrice(plan.price_cents)} por mes a tu tarjeta. Puedes cancelar en cualquier momento.
        </p>

        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-white text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{ background: visual.gradient }}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Ingresar datos de tarjeta"
          )}
        </button>
      </div>
    </div>
  );
}

export default function PlanesPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<Plan | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [plansRes, storeRes, subRes] = await Promise.allSettled([
          apiClient.get("/plans"),
          apiClient.get("/stores/me"),
          apiClient.get("/plans/my-subscription"),
        ]);
        if (plansRes.status === "fulfilled") setPlans(plansRes.value.data);
        if (storeRes.status === "fulfilled")
          setCurrentPlanSlug(storeRes.value.data.plan_slug ?? "free");
        if (subRes.status === "fulfilled") setSubscription(subRes.value.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load Culqi.js once
  useEffect(() => {
    if (!CULQI_PUBLIC_KEY) return;
    if (document.getElementById("culqi-js")) return;
    const script = document.createElement("script");
    script.id = "culqi-js";
    script.src = "https://checkout.culqi.com/js/v4";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const openCulqi = useCallback(
    (plan: Plan) => {
      if (!window.Culqi) {
        toast.error("El módulo de pago no cargó. Recarga la página.");
        return;
      }

      setPaying(true);
      setPayingPlan(plan);
      setConfirmPlan(null);

      window.Culqi.publicKey = CULQI_PUBLIC_KEY;
      window.Culqi.settings({
        title: "qtienda.shop",
        currency: "PEN",
        description: `Plan ${plan.name} mensual`,
        amount: plan.price_cents,
        order: `PLAN-${plan.slug.toUpperCase()}`,
      });

      window.culqiAction = async () => {
        const token = (window.Culqi as unknown as { token: { id: string } }).token?.id;
        window.Culqi.close();
        if (!token) {
          setPaying(false);
          return;
        }
        try {
          await apiClient.post(`/plans/${plan.id}/subscribe`, {
            culqi_token: token,
          });
          toast.success(`¡Suscripción a ${plan.name} activada!`);
          setCurrentPlanSlug(plan.slug);
          setSubscription({ status: "active", ends_at: null, trial_ends_at: null, plan_slug: plan.slug });
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            "Error procesando el pago";
          toast.error(msg);
        } finally {
          setPaying(false);
          setPayingPlan(null);
        }
      };

      window.culqiError = () => {
        setPaying(false);
        setPayingPlan(null);
      };

      window.Culqi.open();
    },
    []
  );

  const handleUpgrade = (plan: Plan) => {
    if (!CULQI_PUBLIC_KEY) {
      toast.error("Pagos no configurados aún. Contáctanos por WhatsApp.");
      return;
    }
    setConfirmPlan(plan);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-10">
      <div className="flex items-center gap-3 pt-5 pb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-slate-100"
          style={{ color: "var(--ink-2)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>
            Planes
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
            Elige el plan que mejor se adapta a tu tienda
          </p>
        </div>
      </div>

      {subscription && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--surface-1)", color: "var(--ink-2)" }}
        >
          Suscripción{" "}
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            {subscription.status === "active" ? "activa" : subscription.status === "trial" ? "en período de prueba" : subscription.status}
          </span>
          {subscription.ends_at && (
            <> · Vence el {new Date(subscription.ends_at).toLocaleDateString("es-PE")}</>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ height: 260, background: "var(--surface-1)" }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.slug === currentPlanSlug}
              onUpgrade={handleUpgrade}
              loading={paying && payingPlan?.id === plan.id}
            />
          ))}
        </div>
      )}

      {!loading && !CULQI_PUBLIC_KEY && (
        <p
          className="text-center text-xs mt-6 leading-relaxed"
          style={{ color: "var(--ink-4)" }}
        >
          Para cambiar de plan, contáctanos por WhatsApp.
        </p>
      )}

      {confirmPlan && (
        <ConfirmModal
          plan={confirmPlan}
          onConfirm={() => openCulqi(confirmPlan)}
          onClose={() => setConfirmPlan(null)}
          loading={paying}
        />
      )}
    </div>
  );
}
