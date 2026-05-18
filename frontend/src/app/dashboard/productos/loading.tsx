// src/app/dashboard/productos/loading.tsx
// Skeleton específico para la sección de productos

export default function ProductosLoading() {
  return (
    <div style={{ padding: "24px 20px", fontFamily: "var(--font-sans)" }}>
      {/* Header + botón añadir */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div className="skeleton" style={{ height: 22, width: 120, borderRadius: 8, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 13, width: 160, borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ height: 38, width: 130, borderRadius: 12 }} />
      </div>

      {/* Búsqueda + filtro */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 38, flex: 1, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 38, width: 110, borderRadius: 10, flexShrink: 0 }} />
      </div>

      {/* Product cards */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            background: "var(--surface)",
            border: "1.5px solid var(--line)",
            borderRadius: 16,
            padding: "12px",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Thumbnail */}
          <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 10, flexShrink: 0 }} />

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: 5, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 13, width: "35%", borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: "25%", borderRadius: 4 }} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
