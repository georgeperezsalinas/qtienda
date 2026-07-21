"use client";

import { useEffect, useState } from "react";

/**
 * Countdown real de oferta — solo se muestra si el vendedor definió una
 * fecha de fin (sale_ends_at). Nunca inventa una fecha ni finge urgencia.
 * Devuelve null si no hay fecha o si ya expiró (se auto-oculta).
 */
export function useSaleCountdown(saleEndsAt?: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!saleEndsAt) {
      setLabel(null);
      return;
    }
    const end = new Date(saleEndsAt).getTime();
    if (isNaN(end)) {
      setLabel(null);
      return;
    }

    function tick() {
      const diff = end - Date.now();
      setLabel(diff > 0 ? formatCountdown(diff) : null);
    }

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [saleEndsAt]);

  return label;
}

function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
