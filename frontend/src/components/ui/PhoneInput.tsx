"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "PE", name: "Perú",            dial: "+51",  flag: "🇵🇪" },
  { code: "CL", name: "Chile",           dial: "+56",  flag: "🇨🇱" },
  { code: "CO", name: "Colombia",        dial: "+57",  flag: "🇨🇴" },
  { code: "MX", name: "México",          dial: "+52",  flag: "🇲🇽" },
  { code: "AR", name: "Argentina",       dial: "+54",  flag: "🇦🇷" },
  { code: "EC", name: "Ecuador",         dial: "+593", flag: "🇪🇨" },
  { code: "BO", name: "Bolivia",         dial: "+591", flag: "🇧🇴" },
  { code: "PY", name: "Paraguay",        dial: "+595", flag: "🇵🇾" },
  { code: "UY", name: "Uruguay",         dial: "+598", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela",       dial: "+58",  flag: "🇻🇪" },
  { code: "PA", name: "Panamá",          dial: "+507", flag: "🇵🇦" },
  { code: "GT", name: "Guatemala",       dial: "+502", flag: "🇬🇹" },
  { code: "SV", name: "El Salvador",     dial: "+503", flag: "🇸🇻" },
  { code: "HN", name: "Honduras",        dial: "+504", flag: "🇭🇳" },
  { code: "NI", name: "Nicaragua",       dial: "+505", flag: "🇳🇮" },
  { code: "CR", name: "Costa Rica",      dial: "+506", flag: "🇨🇷" },
  { code: "DO", name: "Rep. Dominicana", dial: "+1",   flag: "🇩🇴" },
  { code: "CU", name: "Cuba",            dial: "+53",  flag: "🇨🇺" },
  { code: "ES", name: "España",          dial: "+34",  flag: "🇪🇸" },
  { code: "US", name: "EE.UU.",          dial: "+1",   flag: "🇺🇸" },
];

interface Props {
  value: string;
  onChange: (fullPhone: string) => void;
  placeholder?: string;
  id?: string;
  hasError?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = "987 654 321",
  id,
  hasError = false,
}: Props) {
  const [countryDial, setCountryDial] = useState("+51");

  // Comparar solo dígitos (no el string tal cual): si "value" llegó sin el
  // "+" (por ejemplo recuperado de localStorage de una versión vieja, o ya
  // limpiado en otro lado), "value.startsWith(countryDial)" nunca matcheaba
  // y el código de país quedaba pegado como si fuera parte del número local.
  // Cada re-render volvía a anteponer el código de país sobre ese número ya
  // "sucio", y el teléfono crecía sin límite hasta reventar el VARCHAR(20)
  // de la base de datos en el checkout.
  const dialDigits = countryDial.replace(/\D/g, "");
  const valueDigits = value.replace(/\D/g, "");
  const localNumber = valueDigits.startsWith(dialDigits)
    ? valueDigits.slice(dialDigits.length)
    : valueDigits;

  function handleCountryChange(newDial: string) {
    setCountryDial(newDial);
    onChange(newDial + localNumber);
  }

  function handleNumberChange(num: string) {
    // Tope defensivo — ningún número real supera ~12 dígitos locales; sin
    // esto, cualquier bug de concatenación futuro vuelve a crecer sin freno.
    const cleaned = num.replace(/\D/g, "").slice(0, 12);
    onChange(countryDial + cleaned);
  }

  // Tokens directos (--bg/--line-2), no los alias legacy --surface-0/1/2:
  // esos quedan congelados en el valor de :root (claro) sin importar el
  // tema o el modo oscuro activos — ver globals.css. Con ellos, este campo
  // se veía siempre claro con texto blanco encima, aunque el resto del
  // formulario sí cambiara de tema correctamente.
  const borderColor = hasError ? "var(--danger)" : "var(--line-2)";
  const bg = hasError ? "#FFF5F5" : "var(--bg)";

  return (
    <div
      className="flex w-full overflow-hidden text-sm transition-all duration-150 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,.12)]"
      style={{
        border: `1.5px solid ${borderColor}`,
        borderRadius: "var(--r-md)",
        background: bg,
      }}
    >
      <select
        value={countryDial}
        onChange={(e) => handleCountryChange(e.target.value)}
        className="flex-shrink-0 border-r bg-transparent focus:outline-none cursor-pointer font-medium"
        style={{
          borderColor: hasError ? "var(--danger)" : "var(--line-2)",
          padding: "13px 8px 13px 12px",
          color: "var(--ink)",
          fontFamily: "var(--font-dm)",
          minWidth: "88px",
          background: "var(--bg)",
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.dial}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        placeholder={placeholder}
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        autoComplete="tel-national"
        className="flex-1 bg-transparent focus:outline-none placeholder-gray-400 focus-within:bg-[var(--surface)]"
        style={{
          padding: "13px 16px",
          color: "var(--ink)",
          fontFamily: "var(--font-dm)",
          minWidth: 0,
        }}
      />
    </div>
  );
}
