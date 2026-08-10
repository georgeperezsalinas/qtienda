"use client";

// Estado del plan del vendedor en el dashboard:
//  - Plan de pago vigente → línea discreta "Plan Pro · vence el 09 ago".
//  - Faltan ≤7 días → alerta ámbar con botón "Renovar ahora".
//  - Ya venció pero sigue en el período de gracia (todavía no bajó a free) →
//    alerta roja con los días de gracia que quedan.
//  - Plan free (sin haber tenido uno pagado, o ya degradado) → no muestra
//    nada (el ReferralBanner cubre ese caso).

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Crown, Zap } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Subscription {
  plan_slug: string | null;
  plan_name: string | null;
  status: string;
  ends_at: string | null;
  overdue?: boolean;
  grace_days_left?: number;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function datePE(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "long" });
}

export default function PlanStatusBanner() {
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    apiClient
      .get<Subscription>("/plans/my-subscription")
      .then(({ data }) => setSub(data))
      .catch(() => setSub(null)); // 404 = plan free, no mostrar nada
  }, []);

  if (!sub || !sub.plan_slug || sub.plan_slug === "free" || !sub.ends_at) return null;

  const days = daysUntil(sub.ends_at);
  const Icon = sub.plan_slug === "elite" ? Crown : Zap;
  const accent = sub.plan_slug === "elite" ? "#B45309" : "#C5613B";

  // Vigente con tiempo de sobra: línea discreta
  if (days > 7) {
    return (
      <Link
        id="tour-plan"
        href="/dashboard/planes"
        className="card flex items-center gap-3 mb-5 animate-fade-up"
        style={{ padding: "12px 16px" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}15` }}
        >
          <Icon size={15} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Plan {sub.plan_name} activo
          </p>
          <p className="text-xs" style={{ color: "var(--ink-3)", marginTop: 1 }}>
            Vence el {datePE(sub.ends_at)}
          </p>
        </div>
      </Link>
    );
  }

  // Por vencer, o vencido y todavía en período de gracia: alerta con renovación
  const expired = days <= 0;
  const daysOverdue = expired ? Math.abs(days) : 0;
  const graceDaysLeft = sub.grace_days_left ?? 0;

  return (
    <div
      id="tour-plan"
      className="rounded-2xl p-4 mb-5 animate-fade-up"
      style={{
        background: expired ? "#FEF2F2" : "#FFFBEB",
        border: `1.5px solid ${expired ? "#FECACA" : "#FDE68A"}`,
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="mt-0.5 flex-shrink-0"
          style={{ color: expired ? "#DC2626" : "#D97706" }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: expired ? "#991B1B" : "#92400E" }}>
            {expired
              ? `Tu plan ${sub.plan_name} venció hace ${daysOverdue} día${daysOverdue !== 1 ? "s" : ""}`
              : days === 1
                ? `Tu plan ${sub.plan_name} vence mañana`
                : `Tu plan ${sub.plan_name} vence en ${days} días`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: expired ? "#B91C1C" : "#B45309" }}>
            {expired
              ? graceDaysLeft > 0
                ? `Tienes ${graceDaysLeft} día${graceDaysLeft !== 1 ? "s" : ""} más antes de que tu tienda vuelva al plan gratuito. Renueva ahora para no perder tus beneficios.`
                : "Tu tienda está a punto de volver al plan gratuito. Renueva ahora para no perder tus beneficios."
              : `Renueva antes del ${datePE(sub.ends_at)} para no perder tus beneficios. Los días se suman.`}
          </p>
          <Link
            href="/dashboard/planes"
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
            style={{ background: expired ? "#DC2626" : "#D97706" }}
          >
            Renovar ahora
          </Link>
        </div>
      </div>
    </div>
  );
}
