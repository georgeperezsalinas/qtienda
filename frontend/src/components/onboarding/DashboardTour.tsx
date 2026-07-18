"use client";
// src/components/onboarding/DashboardTour.tsx
// Tour guiado de bienvenida para /dashboard. Se auto-inicia la primera vez
// (localStorage) y se puede relanzar desde cualquier lugar con restartQtiendaTour().
//
// Requiere que estos ids existan en el DOM del dashboard:
//   #tour-store      → tarjeta de nombre/link de la tienda
//   #tour-products   → sección de productos y categorías
//   #tour-plan       → PlanStatusBanner
//   #tour-checklist  → checklist de onboarding
//   #tour-stats      → tarjetas "Hoy" (pedidos/ventas/entregados)
//   #tour-orders     → tarjeta "Últimos pedidos"
//
// Uso:
//   1. Móntalo UNA vez en DashboardLayout: <DashboardTour firstName={firstName} />
//   2. Para relanzarlo (p.ej. botón "?" del top bar): import { restartQtiendaTour } from "./DashboardTour"
//      onClick={() => restartQtiendaTour()}

import { useEffect, useState } from "react";

const STORAGE_KEY = "qtienda_onboarding_seen";
const RESTART_EVENT = "qtienda:restart-tour";

export function restartQtiendaTour() {
  window.dispatchEvent(new Event(RESTART_EVENT));
}

type Step =
  | { kind: "modal"; icon: string; title: string; body: string; cta: string }
  | { kind: "spot"; target: string; tag: string; title: string; body: string };

function buildSteps(firstName: string): Step[] {
  return [
    { kind: "modal", icon: "👋", title: `¡Bienvenida, ${firstName}!`, body: "Te mostramos rápido dónde está todo en tu panel. Toma 30 segundos.", cta: "Empezar" },
    { kind: "spot", target: "tour-store", tag: "Tu tienda", title: "Nombre y link público", body: "Aquí está el nombre de tu tienda y el link que compartes con tus clientes. Tócalo para copiarlo o compartirlo." },
    { kind: "spot", target: "tour-products", tag: "Productos", title: "Agrega tus productos y categorías", body: "Esto es lo primero que debes hacer: sube tus productos con foto y precio, y agrúpalos en categorías para que tus clientes naveguen fácil." },
    { kind: "spot", target: "tour-plan", tag: "Tu plan", title: "Plan actual y beneficios", body: "Aquí ves tu plan activo y su fecha de renovación. Te avisaremos antes de que venza." },
    { kind: "spot", target: "tour-checklist", tag: "Configuración", title: "Progreso de tu tienda", body: "Esta lista y la barra de progreso te muestran qué falta: agregar productos, métodos de pago y compartir tu link." },
    { kind: "spot", target: "tour-stats", tag: "Métricas de hoy", title: "Pedidos, ventas y entregas", body: "Un vistazo rápido a cómo va tu tienda hoy." },
    { kind: "spot", target: "tour-orders", tag: "Pedidos recientes", title: "Tus últimos pedidos", body: "Entra aquí para confirmar o preparar los pedidos más nuevos." },
    { kind: "modal", icon: "✓", title: "¡Listo para vender!", body: 'Puedes repetir este recorrido cuando quieras tocando el botón "?" arriba.', cta: "Entendido" },
  ];
}

interface Rect { top: number; left: number; width: number; height: number }

export default function DashboardTour({ firstName = "vendedor" }: { firstName?: string }) {
  const [step, setStep] = useState(-1);
  const [, forceTick] = useState(0);
  const steps = buildSteps(firstName);

  useEffect(() => {
    const onResize = () => forceTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    const onRestart = () => setStep(0);
    window.addEventListener(RESTART_EVENT, onRestart);

    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setStep(0), 500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onResize, true);
        window.removeEventListener(RESTART_EVENT, onRestart);
      };
    }
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.removeEventListener(RESTART_EVENT, onRestart);
    };
  }, []);

  // Limpia z-index elevado de los targets al cambiar de paso.
  // OJO: debe ir ANTES del return condicional (reglas de hooks).
  useEffect(() => {
    return () => {
      steps.forEach((s) => {
        if (s.kind === "spot") {
          const el = document.getElementById(s.target);
          if (el) el.style.zIndex = "";
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Salta pasos cuyo elemento no está en el DOM (plan free sin banner,
  // checklist ya completado, sin pedidos aún…) y lleva el elemento a la vista
  useEffect(() => {
    if (step < 0 || step >= steps.length) return;
    const s = steps[step];
    if (s.kind !== "spot") return;
    const el = document.getElementById(s.target);
    if (!el) {
      setStep((v) => Math.min(v + 1, steps.length - 1));
    } else {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setStep(-1);
  }
  function next() {
    setStep((s) => (s + 1 >= steps.length ? (finish(), -1) : s + 1));
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (step < 0 || step >= steps.length) return null;
  const active = steps[step];
  const spotSteps = steps.filter((s) => s.kind === "spot");

  let spot: Rect = { top: 0, left: 0, width: 0, height: 0 };
  let tip = { top: 0, left: 0 };
  if (active.kind === "spot") {
    const el = document.getElementById(active.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 8;
      spot = { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
      const spaceBelow = window.innerHeight - r.bottom;
      tip =
        spaceBelow > 220
          ? { top: r.bottom + pad + 10, left: Math.min(Math.max(r.left, 16), window.innerWidth - 296) }
          : { top: Math.max(r.top - pad - 10 - 230, 16), left: Math.min(Math.max(r.left, 16), window.innerWidth - 296) };
    }
    // Eleva el z-index del elemento resaltado para que quede sobre el dimmer
    if (el) el.style.zIndex = "41";
  }

  return (
    <>
      {active.kind === "spot" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            pointerEvents: "none",
            transition: "all .3s ease",
            boxShadow: "0 0 0 9999px rgba(20,19,15,.62)",
            borderRadius: 16,
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            border: "2px solid var(--accent)",
          }}
        />
      )}
      {active.kind === "modal" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(20,19,15,.55)" }} />
      )}

      {active.kind === "spot" && (
        <div
          style={{
            position: "fixed",
            zIndex: 50,
            top: tip.top,
            left: tip.left,
            width: 280,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--accent-ink)",
                textTransform: "uppercase",
                letterSpacing: ".1em",
                margin: 0,
                flex: 1,
              }}
            >
              {active.tag}
            </p>
            <button
              onClick={finish}
              style={{ border: 0, background: "none", color: "var(--ink-3)", fontSize: 13, cursor: "pointer", padding: 0 }}
              aria-label="Saltar tour"
            >
              ✕
            </button>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{active.title}</h3>
          <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, margin: "0 0 14px" }}>{active.body}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 5 }}>
              {spotSteps.map((s, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: steps.indexOf(s) === step ? "var(--accent)" : "var(--ink-5)",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {step > 1 && (
                <button
                  onClick={prev}
                  style={{
                    border: "1px solid var(--line-2)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "8px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Atrás
                </button>
              )}
              <button
                onClick={next}
                style={{
                  border: 0,
                  background: "var(--ink)",
                  color: "var(--bg)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "8px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {active.kind === "modal" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 340,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,.18)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--accent-soft)",
                color: "var(--accent-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                fontSize: 20,
              }}
            >
              {active.icon}
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 8px" }}>{active.title}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, margin: "0 0 20px" }}>{active.body}</p>
            <button
              onClick={next}
              style={{
                width: "100%",
                border: 0,
                background: "var(--ink)",
                color: "var(--bg)",
                fontSize: 14,
                fontWeight: 600,
                padding: 12,
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              {active.cta}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
