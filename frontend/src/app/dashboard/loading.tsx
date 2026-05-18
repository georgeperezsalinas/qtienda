// src/app/dashboard/loading.tsx
// Next.js App Router muestra este componente automáticamente mientras
// cualquier página del dashboard carga. Sin este archivo el usuario
// ve pantalla en blanco durante la navegación.

export default function DashboardLoading() {
  return (
    <div
      style={{
        padding: "24px 20px",
        fontFamily: "var(--font-sans)",
        maxWidth: 900,
      }}
    >
      {/* Header skeleton */}
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ height: 22, width: 160, borderRadius: 8, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: 220, borderRadius: 6 }} />
      </div>

      {/* Stats row skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "16px 14px",
            }}
          >
            <div className="skeleton" style={{ height: 12, width: 70, borderRadius: 4, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 26, width: 90, borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* List skeleton */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderBottom: i < 5 ? "1px solid var(--line)" : "none",
            }}
          >
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: "55%", borderRadius: 5, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 11, width: "35%", borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 26, width: 72, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
