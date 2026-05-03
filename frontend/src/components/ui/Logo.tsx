import Link from "next/link";

interface Props {
  size?: "sm" | "md" | "lg";
  href?: string;
  invertOnDark?: boolean;
}

const sizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export default function Logo({ size = "md", href = "/", invertOnDark = false }: Props) {
  const inner = (
    <span
      className={`font-display font-extrabold tracking-tight ${sizes[size]}`}
      style={{ color: invertOnDark ? "rgba(255,255,255,.9)" : "var(--brand-600)" }}
    >
      q<span style={{ color: invertOnDark ? "rgba(255,255,255,.5)" : "var(--ink)" }}>tienda</span>
    </span>
  );

  if (!href) return inner;

  return (
    <Link href={href} aria-label="qtienda inicio">
      {inner}
    </Link>
  );
}
