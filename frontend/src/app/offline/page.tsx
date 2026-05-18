// src/app/offline/page.tsx
// Página que muestra el SW cuando no hay red

import Link from "next/link";

export const metadata = { title: "Sin conexión · qtienda" };

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48 }}>📡</div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        Sin conexión
      </h1>
      <p style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 280, lineHeight: 1.5, margin: 0 }}>
        Revisa tu conexión a internet e intenta de nuevo.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 8,
          background: "var(--ink)",
          color: "var(--bg)",
          borderRadius: 12,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Reintentar
      </Link>
    </div>
  );
}
