// src/components/ui/Logo.tsx — qtienda v2
// Reemplaza el archivo actual completo.

"use client";

import Link from "next/link";

type Size = "sm" | "md" | "lg" | "xl";
type Variant = "default" | "white" | "mark-only";

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
  const color = isWhite ? "#FFFFFF" : "var(--ink)";
  const accent = isWhite ? "#FFFFFF" : "var(--accent)";

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
        fill="none"
        aria-hidden="true"
      >
        <circle cx="38" cy="38" r="28" stroke="currentColor" strokeWidth="8" />
        <path
          d="M58 58 L82 82"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="84" cy="84" r="7.6" fill={accent} />
      </svg>
      {variant !== "mark-only" && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
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
