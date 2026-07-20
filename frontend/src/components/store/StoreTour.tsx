"use client";
// src/components/store/StoreTour.tsx
// Tour guiado para clientes en /tienda/[slug]. Se auto-inicia en la primera
// visita a ESA tienda (localStorage por slug) y puede relanzarse manualmente.
//
// Requiere estos ids en StorePage.tsx:
//   #tour-categories   → wrapper de <CategoryList> (chips de categorías)
//   #tour-cart         → botón "Ver carrito" (ShoppingCart icon) del header
//   #tour-product-1    → el <ProductCard> del primer producto renderizado
//   #tour-payment      → el chip "Pago seguro por Yape, Plin o efectivo"
//   #tour-orderstatus  → botón "Mi pedido" (PackageSearch)
//   #tour-whatsapp     → link/botón de WhatsApp (header o barra inferior)
//
// Uso en StorePage.tsx:
//   import StoreTour from "./StoreTour";
//   ...
//   <StoreTour storeSlug={store.slug} />   (una vez, dentro del return de StorePage)

import { useEffect, useState } from "react";

const RESTART_EVENT = "qtienda:restart-store-tour";

export function restartStoreTour() {
  window.dispatchEvent(new Event(RESTART_EVENT));
}

type Step =
  | { kind: "modal"; icon: string; title: string; body: string; cta: string }
  | { kind: "spot"; target: string; tag: string; title: string; body: string };

function buildSteps(storeName: string): Step[] {
  return [
    { kind: "modal", icon: "🛍️", title: `¡Bienvenido a ${storeName}!`, body: "Una guía rápida para que compres sin problema.", cta: "Empezar" },
    { kind: "spot", target: "tour-categories", tag: "Categorías", title: "Explora por categoría", body: "Toca una categoría para filtrar los productos y encontrar lo que buscas más rápido." },
    { kind: "spot", target: "tour-product-1", tag: "Agregar al carrito", title: "Toca el + para agregar", body: "Elige la cantidad y el producto se suma a tu carrito al instante." },
    { kind: "spot", target: "tour-cart", tag: "Tu carrito", title: "Revisa y finaliza tu compra", body: "Aquí ves todo lo que agregaste. Desde ahí completas tus datos y eliges cómo pagar." },
    { kind: "spot", target: "tour-payment", tag: "Métodos de pago", title: "Cómo puedes pagar", body: "Esta tienda acepta los métodos configurados por el vendedor — lo eliges al finalizar tu pedido." },
    { kind: "spot", target: "tour-orderstatus", tag: "Seguimiento", title: "Sigue tu pedido", body: "Con este botón consultas el estado de tu pedido en cualquier momento, sin necesidad de escribirle al vendedor." },
    { kind: "spot", target: "tour-whatsapp", tag: "Contacto directo", title: "Escríbele por WhatsApp", body: "¿Alguna duda sobre un producto o tu pedido? Contacta directo a la tienda por WhatsApp." },
    { kind: "modal", icon: "✓", title: "¡Listo para comprar!", body: "Explora los productos y arma tu pedido cuando quieras.", cta: "Entendido" },
  ];
}

interface Rect { top: number; left: number; width: number; height: number }

export default function StoreTour({ storeSlug, storeName = "esta tienda" }: { storeSlug: string; storeName?: string }) {
  const [step, setStep] = useState(-1);
  const [, forceTick] = useState(0);
  const storageKey = `qtienda_public_tour_seen_${storeSlug}`;
  const steps = buildSteps(storeName);

  useEffect(() => {
    const onResize = () => forceTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    const onRestart = () => setStep(0);
    window.addEventListener(RESTART_EVENT, onRestart);

    let t: ReturnType<typeof setTimeout> | undefined;
    if (!localStorage.getItem(storageKey)) {
      t = setTimeout(() => setStep(0), 500);
    }
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.removeEventListener(RESTART_EVENT, onRestart);
    };
  }, [storageKey]);

  function finish() {
    localStorage.setItem(storageKey, "1");
    setStep(-1);
  }
  function next() {
    setStep((s) => {
      if (s + 1 >= steps.length) {
        finish();
        return -1;
      }
      return s + 1;
    });
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  // Eleva/restaura z-index del elemento resaltado para que quede sobre el dimmer
  useEffect(() => {
    if (step < 0 || step >= steps.length) return;
    const active = steps[step];
    if (active.kind !== "spot") return;
    const el = document.getElementById(active.target);
    if (el) el.style.zIndex = "41";
    return () => {
      if (el) el.style.zIndex = "";
    };
  }, [step]);

  // Salta pasos cuyo target no está en el DOM (p.ej. tour-whatsapp si la
  // tienda no configuró WhatsApp, o tour-product-1 sin productos aún) y
  // lleva el elemento a la vista antes de resaltarlo
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
          ? { top: r.bottom + pad + 10, left: Math.min(Math.max(r.left, 16), window.innerWidth - 286) }
          : { top: Math.max(r.top - pad - 10 - 220, 16), left: Math.min(Math.max(r.left, 16), window.innerWidth - 286) };
    }
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
            width: 270,
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
              maxWidth: 320,
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
