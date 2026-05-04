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

  const localNumber = value.startsWith(countryDial)
    ? value.slice(countryDial.length)
    : value;

  function handleCountryChange(newDial: string) {
    const local = value.startsWith(countryDial) ? value.slice(countryDial.length) : value;
    setCountryDial(newDial);
    onChange(newDial + local);
  }

  function handleNumberChange(num: string) {
    const cleaned = num.replace(/[^\d\s\-]/g, "");
    onChange(countryDial + cleaned);
  }

  const borderColor = hasError ? "var(--danger)" : "#E2E8F0";
  const bg = hasError ? "#FFF5F5" : "var(--surface-1)";

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
          borderColor: hasError ? "var(--danger)" : "#E2E8F0",
          padding: "13px 8px 13px 12px",
          color: "var(--ink)",
          fontFamily: "var(--font-dm)",
          minWidth: "88px",
          background: "var(--surface-1)",
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
        className="flex-1 bg-transparent focus:outline-none placeholder-gray-400 focus-within:bg-[var(--surface-0)]"
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
