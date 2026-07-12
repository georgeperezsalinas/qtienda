"use client";

// src/app/dashboard/planes/page.tsx — qtienda v2 (con useCulqi)
//
// CAMBIOS vs versión anterior:
//   - Reemplaza la lógica de Culqi inline por el hook useCulqi
//   - Agrega div#culqi-container requerido por el modal de Culqi
//   - Limpia el declare global duplicado (ya está en useCulqi.ts)
//   - Migra fetching a React Query con useQuery

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Zap, Crown, Sparkles, Loader2,
  X, Copy, Smartphone, CreditCard, Clock,
} from "lucide-react";
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

interface PaymentInfo {
  yape_phone: string;
  yape_name: string;
}

interface YapeRequest {
  id: string;
  status: string;
  plan_name: string | null;
  amount_cents: number;
  reject_reason: string | null;
  created_at: string;
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
  daysLeft,
  onUpgrade,
  loading,
}: {
  plan: Plan;
  isCurrent: boolean;
  daysLeft: number | null;
  onUpgrade: (plan: Plan) => void;
  loading: boolean;
}) {
  const renewNow = isCurrent && daysLeft !== null && daysLeft <= 7;
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
          {renewNow ? (
            <>
              <button
                onClick={() => onUpgrade(plan)}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background: "#D97706",
                  color: "#fff",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px #D9770640",
                }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Renovar {plan.name}
                    {daysLeft !== null && daysLeft > 0 && ` · vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`}
                  </>
                )}
              </button>
              <p className="text-center text-[11px] mt-2" style={{ color: "var(--ink-4)" }}>
                Paga con Yape o tarjeta · los 30 días se suman a tu fecha
              </p>
            </>
          ) : isCurrent ? (
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
            <>
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
              <p className="text-center text-[11px] mt-2" style={{ color: "var(--ink-4)" }}>
                Paga con tarjeta o Yape
              </p>
            </>
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

  const { data: paymentInfo } = useQuery({
    queryKey: ["payment-info"],
    queryFn: async () => {
      const { data } = await apiClient.get("/plans/payment-info");
      return data as PaymentInfo;
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: yapeRequest } = useQuery({
    queryKey: ["yape-request"],
    queryFn: async () => {
      const { data } = await apiClient.get("/plans/yape-request/latest");
      return data as YapeRequest;
    },
    retry: false, // 404 si nunca solicitó
  });

  // ── Yape directo ─────────────────────────────────
  const [payModalPlan, setPayModalPlan] = useState<Plan | null>(null);
  const [yapeMode, setYapeMode] = useState(false);
  const [operationNumber, setOperationNumber] = useState("");

  const yapeMutation = useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const { data } = await apiClient.post(`/plans/${planId}/yape-request`, {
        operation_number: operationNumber.trim(),
      });
      return data;
    },
    onSuccess: () => {
      toast.success("¡Recibido! Activaremos tu plan al confirmar el Yape 🙌");
      setPayModalPlan(null);
      setYapeMode(false);
      setOperationNumber("");
      qc.invalidateQueries({ queryKey: ["yape-request"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "No se pudo registrar tu pago");
    },
  });

  function copyYapePhone() {
    if (!paymentInfo) return;
    navigator.clipboard.writeText(paymentInfo.yape_phone)
      .then(() => toast.success("Número copiado"))
      .catch(() => toast.error("No se pudo copiar"));
  }

  // ── Mutación de suscripción ──────────────────────
  const subscribeMutation = useMutation({
    mutationFn: async ({ planId, token }: { planId: string; token: string }) => {
      const { data } = await apiClient.post(`/plans/${planId}/subscribe`, {
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
    setPayModalPlan(plan);
    setYapeMode(false);
    setOperationNumber("");
  }, []);

  const payWithCulqi = useCallback(() => {
    if (payModalPlan) selectedPlanRef.current = payModalPlan;
    setPayModalPlan(null);
    openCulqi();
  }, [openCulqi, payModalPlan]);

  const currentSlug = subscription?.plan_slug ?? "free";
  const isLoading = culqiLoading || subscribeMutation.isPending;
  const daysLeft = subscription?.ends_at
    ? Math.ceil((new Date(subscription.ends_at).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="mx-auto max-w-[700px] lg:max-w-[960px]" style={{ padding: "20px 20px 40px", fontFamily: "var(--font-sans)" }}>
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

      {/* Pago Yape en verificación */}
      {yapeRequest?.status === "pending" && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-2xl mb-5 text-sm"
          style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
        >
          <Clock size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold">Tu Yape está en verificación</p>
            <p className="text-xs mt-0.5">
              Plan {yapeRequest.plan_name} · {formatPricePlan(yapeRequest.amount_cents)} — lo activamos
              apenas confirmemos el pago (normalmente en unas horas).
            </p>
          </div>
        </div>
      )}
      {yapeRequest?.status === "rejected" && yapeRequest.reject_reason && (
        <div
          className="px-4 py-3 rounded-2xl mb-5 text-xs"
          style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA" }}
        >
          Tu último pago Yape fue rechazado: {yapeRequest.reject_reason}. Puedes intentarlo de nuevo.
        </div>
      )}

      {/* Estado de suscripción actual */}
      {subscription && subscription.status !== "free" && (() => {
        const nearExpiry = daysLeft !== null && daysLeft <= 7;
        const currentPlan = plans.find((p) => p.slug === subscription.plan_slug);
        return (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-5 text-sm font-medium flex-wrap"
            style={
              nearExpiry
                ? { background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }
                : { background: "var(--success-soft)", color: "var(--success)" }
            }
          >
            <Check size={15} strokeWidth={2.5} />
            <span>
              Suscripción {subscription.status === "active" ? "activa" : subscription.status}
              {subscription.ends_at && (
                <span style={{ opacity: 0.75, marginLeft: 4 }}>
                  · vence {new Date(subscription.ends_at).toLocaleDateString("es-PE")}
                  {daysLeft !== null && daysLeft > 0 && ` (${daysLeft} día${daysLeft !== 1 ? "s" : ""})`}
                </span>
              )}
            </span>
            {nearExpiry && currentPlan && (
              <button
                onClick={() => handleUpgrade(currentPlan)}
                className="ml-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: "#D97706" }}
              >
                Renovar ahora
              </button>
            )}
          </div>
        );
      })()}

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
              daysLeft={plan.slug === currentSlug ? daysLeft : null}
              onUpgrade={handleUpgrade}
              loading={isLoading}
            />
          ))}
        </div>
      )}

      {/* ── Modal: elegir método de pago ── */}
      {payModalPlan && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(15,23,42,.45)" }}
            onClick={() => setPayModalPlan(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:bottom-auto md:w-[420px] z-50 p-5 rounded-t-3xl md:rounded-3xl"
            style={{ background: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase" style={{ color: "var(--ink-3)" }}>
                  Activar {payModalPlan.name}
                </p>
                <p className="font-bold text-lg" style={{ color: "var(--ink)" }}>
                  {formatPricePlan(payModalPlan.price_cents)} / mes
                </p>
              </div>
              <button
                onClick={() => setPayModalPlan(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-2)" }}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {!yapeMode ? (
              <div className="space-y-3 pb-2">
                {/* Yape directo — primero, es lo que más usa la gente */}
                <button
                  onClick={() => setYapeMode(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[.98]"
                  style={{ background: "#742384", color: "#fff" }}
                >
                  <Smartphone size={22} />
                  <div className="flex-1">
                    <p className="font-bold text-sm">Pagar con Yape</p>
                    <p className="text-xs opacity-80">Directo al celular, sin tarjeta</p>
                  </div>
                </button>

                <button
                  onClick={payWithCulqi}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[.98]"
                  style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1.5px solid var(--line)" }}
                >
                  <CreditCard size={22} style={{ color: "var(--ink-2)" }} />
                  <div className="flex-1">
                    <p className="font-bold text-sm">Tarjeta de crédito/débito</p>
                    <p className="text-xs" style={{ color: "var(--ink-3)" }}>Pago seguro con Culqi</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4 pb-2">
                <div
                  className="rounded-2xl p-4 text-center"
                  style={{ background: "#F8F0FA", border: "1.5px dashed #C084CF" }}
                >
                  <p className="text-xs font-semibold" style={{ color: "#742384" }}>
                    Yapea {formatPricePlan(payModalPlan.price_cents)} al número
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    <p className="font-display font-extrabold text-2xl tracking-wide" style={{ color: "#742384" }}>
                      {paymentInfo?.yape_phone ?? "—"}
                    </p>
                    <button
                      onClick={copyYapePhone}
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "#fff", border: "1px solid #E9D5F0" }}
                      aria-label="Copiar número"
                    >
                      <Copy size={13} style={{ color: "#742384" }} />
                    </button>
                  </div>
                  {paymentInfo?.yape_name && (
                    <p className="text-xs mt-1" style={{ color: "#9333B8" }}>
                      A nombre de {paymentInfo.yape_name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="field-label" htmlFor="yape-op">
                    Nº de operación de tu Yape
                  </label>
                  <input
                    id="yape-op"
                    className="input"
                    placeholder="Ej. 04519823"
                    inputMode="numeric"
                    value={operationNumber}
                    onChange={(e) => setOperationNumber(e.target.value)}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-4)" }}>
                    Aparece en el comprobante de Yape después de enviar el pago.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setYapeMode(false)}
                    className="px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                  >
                    Volver
                  </button>
                  <button
                    onClick={() => yapeMutation.mutate({ planId: payModalPlan.id })}
                    disabled={yapeMutation.isPending || !operationNumber.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all active:scale-[.98]"
                    style={{ background: "#742384" }}
                  >
                    {yapeMutation.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <>Ya yapeé, confirmar</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Contenedor requerido por el modal de Culqi */}
      <div id="culqi-container" />
    </div>
  );
}
