/** Estado abierto/cerrado a partir del horario configurado por el vendedor.
 *  Soporta horario nocturno (cierre <= apertura = cruza medianoche). Si está
 *  cerrado, busca hacia adelante (hoy más tarde, o los próximos días) cuándo
 *  vuelve a abrir, para que el comprador sepa cuándo volver.
 *  Compartido entre StorePage, StoreDoor y el directorio /tiendas — una sola
 *  fuente de verdad para no duplicar la lógica de horario. */

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function getOpenStatus(
  hours?: Record<string, { open: string; close: string }> | null
): { open: boolean; label: string } | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const today = hours[DAY_KEYS[now.getDay()]];
  const yesterday = hours[DAY_KEYS[(now.getDay() + 6) % 7]];

  // ¿Sigue abierto desde ayer? (horario que cruza medianoche)
  if (yesterday && toMin(yesterday.close) <= toMin(yesterday.open) && cur < toMin(yesterday.close)) {
    return { open: true, label: `Abierto · hasta ${yesterday.close}` };
  }
  if (today) {
    const open = toMin(today.open);
    const close = toMin(today.close);
    const overnight = close <= open;
    if (overnight ? cur >= open : cur >= open && cur < close) {
      return { open: true, label: `Abierto · hasta ${today.close}` };
    }
    // Todavía no abre hoy — reabre más tarde el mismo día.
    if (cur < open) return { open: false, label: `Cerrado · abre hoy ${today.open}` };
  }

  // Cerrado y ya pasó el horario de hoy (o no atiende hoy) — busca el
  // próximo día con horario configurado, hasta una semana hacia adelante.
  for (let i = 1; i <= 7; i++) {
    const dayIdx = (now.getDay() + i) % 7;
    const next = hours[DAY_KEYS[dayIdx]];
    if (next) {
      const when = i === 1 ? "mañana" : DAY_SHORT[dayIdx];
      return { open: false, label: `Cerrado · abre ${when} ${next.open}` };
    }
  }

  return { open: false, label: "Cerrado" };
}
