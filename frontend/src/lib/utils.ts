// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface StoreCurrency {
  code: string;
  locale: string;
}

// Mismos países que el selector de configuracion/page.tsx (COUNTRIES) — el
// vendedor solo puede elegir uno de estos, así que el mapeo no necesita más.
// EC/PA/SV usan USD como moneda oficial (dolarizados).
const CURRENCY_BY_COUNTRY: Record<string, StoreCurrency> = {
  PE: { code: "PEN", locale: "es-PE" },
  CL: { code: "CLP", locale: "es-CL" },
  CO: { code: "COP", locale: "es-CO" },
  MX: { code: "MXN", locale: "es-MX" },
  AR: { code: "ARS", locale: "es-AR" },
  EC: { code: "USD", locale: "es-EC" },
  BO: { code: "BOB", locale: "es-BO" },
  PY: { code: "PYG", locale: "es-PY" },
  UY: { code: "UYU", locale: "es-UY" },
  VE: { code: "VES", locale: "es-VE" },
  PA: { code: "USD", locale: "es-PA" },
  GT: { code: "GTQ", locale: "es-GT" },
  SV: { code: "USD", locale: "es-SV" },
  HN: { code: "HNL", locale: "es-HN" },
  NI: { code: "NIO", locale: "es-NI" },
  CR: { code: "CRC", locale: "es-CR" },
  DO: { code: "DOP", locale: "es-DO" },
  CU: { code: "CUP", locale: "es-CU" },
  ES: { code: "EUR", locale: "es-ES" },
  US: { code: "USD", locale: "en-US" },
};

/** Deriva moneda+locale de una tienda a partir de su país (y su `currency`
 *  si vino seteada explícita). Sin store/country, cae a PEN/es-PE — el
 *  comportamiento de siempre, para no romper vistas que agregan varias
 *  tiendas (ej. KPIs globales del admin). */
export function getStoreCurrency(
  store?: { currency?: string | null; country?: string | null } | null
): StoreCurrency {
  const byCountry = CURRENCY_BY_COUNTRY[store?.country || "PE"] || CURRENCY_BY_COUNTRY.PE;
  return store?.currency ? { code: store.currency, locale: byCountry.locale } : byCountry;
}

export function formatPrice(cents: number, currency = "PEN", locale = "es-PE"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
