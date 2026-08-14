// src/components/ui/Logo.tsx — qtienda v2
// Reemplaza el archivo actual completo.

"use client";

import Link from "next/link";

type Size = "sm" | "md" | "lg" | "xl";
type Variant = "default" | "white" | "mark-only" | "brand" | "mono";

interface LogoProps {
  size?: Size;
  href?: string | null;
  className?: string;
  variant?: Variant;
}

const SIZES: Record<Size, { mark: number; text: number }> = {
  sm: { mark: 18, text: 14 },
  md: { mark: 22, text: 18 },
  lg: { mark: 30, text: 24 },
  xl: { mark: 44, text: 36 },
};

export default function Logo({
  size = "md",
  href = "/",
  className = "",
  variant = "default",
}: LogoProps) {
  const { mark, text } = SIZES[size];
  const isWhite = variant === "white";
  const isBrand = variant === "brand";
  const isMono = variant === "mono";
  // "brand": el monograma va en color de marca — para headers
  // "mono": monograma en tinta pura (impresión a 1 color)
  const color = isWhite ? "#FFFFFF" : "var(--ink)";
  const markColor = isWhite ? "#FFFFFF" : isBrand ? "var(--accent)" : isMono ? "var(--ink)" : "var(--ink)";

  const inner = (
    <span
      className={"inline-flex items-center select-none " + className}
      style={{ gap: text * 0.42, color }}
      aria-label="qtienda"
    >
      <svg
        width={mark}
        height={mark}
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          fill={markColor}
          d="M15 15 H85 V85 H15 Z M32 32 H68 V68 H32 Z"
        />
        <path fill={markColor} d="M58 58 L92 92 L100 84 L66 50 Z" />
      </svg>
      {variant !== "mark-only" && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: isBrand ? 700 : 500,
            fontSize: text,
            letterSpacing: "-0.035em",
            lineHeight: 1,
          }}
        >
          qtienda
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}
