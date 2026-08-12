"use client";

// src/hooks/useIdleRedirect.ts — si el comprador queda sin interactuar con
// el catálogo, avisa con una cuenta regresiva y, si sigue sin responder,
// vuelve a la puerta de la tienda. Pensado para cuando alguien deja la
// pestaña abierta y se olvida — nunca interrumpe mientras hay actividad,
// carrito o un producto abierto.

import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "touchstart", "scroll", "keydown", "wheel"] as const;

export function useIdleRedirect({
  idleMs,
  warningMs,
  paused,
  onRedirect,
}: {
  /** Tiempo sin actividad antes de mostrar el aviso de cuenta regresiva */
  idleMs: number;
  /** Duración de la cuenta regresiva antes de redirigir */
  warningMs: number;
  /** Pausa todo el mecanismo (ej. carrito o producto abiertos) */
  paused: boolean;
  onRedirect: () => void;
}) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000));
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  }

  function startWarning() {
    setWarning(true);
    const deadline = Date.now() + warningMs;
    setSecondsLeft(Math.ceil(warningMs / 1000));
    countdownTimer.current = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setSecondsLeft(Math.ceil(left / 1000));
      if (left <= 0) {
        clearTimers();
        onRedirect();
      }
    }, 250);
  }

  function reset() {
    clearTimers();
    setWarning(false);
    if (paused) return;
    idleTimer.current = setTimeout(startWarning, idleMs);
  }

  // "Sigo aquí" — cancela el aviso y vuelve a contar desde cero
  function stay() {
    reset();
  }

  useEffect(() => {
    if (paused) {
      clearTimers();
      setWarning(false);
      return;
    }
    reset();
    const handler = () => { if (!warning) reset(); };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handler));
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  return { warning, secondsLeft, stay };
}
