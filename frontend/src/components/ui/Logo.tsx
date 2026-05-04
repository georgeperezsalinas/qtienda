import Link from "next/link";

interface Props {
  size?: "sm" | "md" | "lg";
  href?: string;
  invertOnDark?: boolean;
}

const heights = { sm: 24, md: 32, lg: 40 };

export default function Logo({ size = "md", href = "/", invertOnDark = false }: Props) {
  const h = heights[size];

  const inner = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo_qtienda.png"
      alt="qtienda"
      style={{
        height: h,
        width: "auto",
        display: "block",
        filter: invertOnDark ? "brightness(0) invert(1)" : "none",
      }}
    />
  );

  if (!href) return inner;

  return (
    <Link href={href} aria-label="qtienda inicio">
      {inner}
    </Link>
  );
}
