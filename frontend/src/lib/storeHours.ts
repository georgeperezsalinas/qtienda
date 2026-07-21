/** Estado abierto/cerrado a partir del horario configurado por el vendedor.
 *  Soporta horario nocturno (cierre <= apertura = cruza medianoche).
 *  Compartido entre StorePage y el directorio /tiendas — una sola fuente
 *  de verdad para no duplicar la lógica de horario. */
export function getOpenStatus(
  hours?: Record<string, { open: string; close: string }> | null
): { open: boolean; label: string } | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
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
    if (cur < open) return { open: false, label: `Cerrado · abre ${today.open}` };
  }
  return { open: false, label: "Cerrado" };
}
