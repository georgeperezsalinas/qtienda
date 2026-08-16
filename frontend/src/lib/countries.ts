// src/lib/countries.ts — países soportados al crear/configurar una tienda.
// País de la tienda: define moneda (ver getStoreCurrency en utils.ts) y los
// campos de dirección/documento en el checkout (Perú usa DNI +
// departamento/provincia/distrito; el resto, campos genéricos).
export const COUNTRIES = [
  { code: "PE", name: "🇵🇪 Perú" },
  { code: "CL", name: "🇨🇱 Chile" },
  { code: "CO", name: "🇨🇴 Colombia" },
  { code: "MX", name: "🇲🇽 México" },
  { code: "AR", name: "🇦🇷 Argentina" },
  { code: "EC", name: "🇪🇨 Ecuador" },
  { code: "BO", name: "🇧🇴 Bolivia" },
  { code: "PY", name: "🇵🇾 Paraguay" },
  { code: "UY", name: "🇺🇾 Uruguay" },
  { code: "VE", name: "🇻🇪 Venezuela" },
  { code: "PA", name: "🇵🇦 Panamá" },
  { code: "GT", name: "🇬🇹 Guatemala" },
  { code: "SV", name: "🇸🇻 El Salvador" },
  { code: "HN", name: "🇭🇳 Honduras" },
  { code: "NI", name: "🇳🇮 Nicaragua" },
  { code: "CR", name: "🇨🇷 Costa Rica" },
  { code: "DO", name: "🇩🇴 Rep. Dominicana" },
  { code: "CU", name: "🇨🇺 Cuba" },
  { code: "ES", name: "🇪🇸 España" },
  { code: "US", name: "🇺🇸 EE.UU." },
];
