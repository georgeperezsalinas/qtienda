"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Progress {
  store_created: boolean;
  logo_added: boolean;
  products_count: number;
  products_target: number;
  shared: boolean;
  complete: boolean;
}

interface Props {
  store: { name: string; slug: string };
}

type StepState = "done" | "partial" | "pending";

interface Step {
  label: string;
  sub: string;
  state: StepState;
  href?: string;
  onClick?: () => void;
}

export default function OnboardingProgress({ store }: Props) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/notifications/onboarding-progress")
      .then(({ data }) => setProgress(data))
      .catch(() => setProgress(null))
      .finally(() => setLoading(false));
  }, []);

  async function shareStore() {
    try {
      await apiClient.post("/stores/me/mark-shared");
      setProgress((p) => (p ? { ...p, shared: true } : p));
    } catch {
      // best-effort — no bloquea el share nativo
    }
    navigator.share?.({
      title: store.name,
      text: `Visita mi tienda: ${store.name}`,
      url: `${window.location.origin}/tienda/${store.slug}`,
    });
  }

  if (loading || !progress || progress.complete) return null;

  const productsDone = progress.products_count >= progress.products_target;
  const productsPartial = progress.products_count > 0 && !productsDone;

  const steps: Step[] = [
    { label: "Tienda creada", sub: store.name, state: "done", href: "/dashboard/configuracion" },
    {
      label: "Logo de tu tienda",
      sub: progress.logo_added ? "Listo" : "Sube tu logo para verte más profesional",
      state: progress.logo_added ? "done" : "pending",
      href: "/dashboard/configuracion",
    },
    {
      label: `Productos (${progress.products_count} de ${progress.products_target})`,
      sub: productsDone ? "¡Completo!" : "Una foto y un precio bastan para empezar",
      state: productsDone ? "done" : productsPartial ? "partial" : "pending",
      href: "/dashboard/productos",
    },
    {
      label: "Compartir tu tienda",
      sub: `qtienda.shop/${store.slug}`,
      state: progress.shared ? "done" : "pending",
      onClick: progress.shared ? undefined : shareStore,
    },
  ];

  const doneCount = steps.filter((s) => s.state === "done").length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div id="tour-checklist" className="card mb-5 p-4 animate-fade-up">
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow" style={{ marginBottom: 0 }}>
          ¡Ya casi estás listo para vender! 🚀
        </p>
        <span className="text-xs font-semibold mono" style={{ color: "var(--accent)" }}>
          {pct}%
        </span>
      </div>

      <div className="rounded-full overflow-hidden mb-3" style={{ height: 6, background: "var(--line)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>

      {steps.map((step, i) => {
        const icon = step.state === "done" ? "🟢" : step.state === "partial" ? "🟡" : "⚪";
        const content = (
          <div
            className="flex items-center gap-3"
            style={{ padding: "10px 0", borderTop: i === 0 ? "0" : "1px solid var(--line)" }}
          >
            <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                className="text-sm font-medium truncate"
                style={{
                  color: step.state === "done" ? "var(--ink-3)" : "var(--ink)",
                  textDecoration: step.state === "done" ? "line-through" : "none",
                }}
              >
                {step.label}
              </p>
              <p className="text-[11px]" style={{ color: "var(--ink-3)", marginTop: 1 }}>
                {step.sub}
              </p>
            </div>
            {step.state !== "done" && <ChevronRight size={15} style={{ color: "var(--ink-4)" }} />}
          </div>
        );
        if (step.onClick) {
          return (
            <button key={i} onClick={step.onClick} className="w-full text-left">
              {content}
            </button>
          );
        }
        if (step.href) {
          return (
            <Link key={i} href={step.href} className="block">
              {content}
            </Link>
          );
        }
        return <div key={i}>{content}</div>;
      })}

      <p className="text-xs mt-3" style={{ color: "var(--ink-3)" }}>
        Te falta muy poco para comenzar a recibir pedidos.
      </p>
    </div>
  );
}
