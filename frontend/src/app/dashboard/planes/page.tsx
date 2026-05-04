"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Zap, Crown, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api";

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
}: {
  plan: Plan;
  isCurrent: boolean;
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
          ? `0 4px 24px rgba(0,0,0,.08)`
          : "0 1px 4px rgba(0,0,0,.04)",
        transform: isPro ? "scale(1.01)" : "scale(1)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4"
        style={{ background: visual.gradient }}
      >
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

        {/* CTA */}
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
            <a
              href={`https://wa.me/51999999999?text=${encodeURIComponent(`Hola, quiero actualizar mi plan a ${plan.name} (S/ ${plan.price_cents / 100}/mes)`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all active:scale-95"
              style={{
                background: visual.gradient,
                color: "#fff",
                boxShadow: `0 4px 12px ${visual.color}40`,
              }}
            >
              Actualizar a {plan.name}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanesPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [plansRes, storeRes] = await Promise.allSettled([
          apiClient.get("/plans"),
          apiClient.get("/stores/me"),
        ]);

        if (plansRes.status === "fulfilled") {
          setPlans(plansRes.value.data);
        }
        if (storeRes.status === "fulfilled") {
          setCurrentPlanSlug(storeRes.value.data.plan_slug ?? "free");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-10">
      {/* Header */}
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

      {/* Plans */}
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
            />
          ))}
        </div>
      )}

      {/* Nota al pie */}
      {!loading && (
        <p
          className="text-center text-xs mt-6 leading-relaxed"
          style={{ color: "var(--ink-4)" }}
        >
          Para cambiar de plan, contáctanos por WhatsApp.
          <br />
          Los pagos se procesan de forma manual durante el beta.
        </p>
      )}
    </div>
  );
}
