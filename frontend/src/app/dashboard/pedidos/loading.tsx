// src/app/dashboard/pedidos/loading.tsx
// Skeleton específico para la sección de pedidos

export default function PedidosLoading() {
  return (
    <div style={{ padding: "24px 20px", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 22, width: 100, borderRadius: 8, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: 180, borderRadius: 5 }} />
      </div>

      {/* Filtros skeleton */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 36, width: "100%", borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 10, flexShrink: 0 }} />
      </div>

      {/* Status pills skeleton */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}>
        {[80, 90, 100, 90, 80, 90].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 30, width: w, borderRadius: 20, flexShrink: 0 }} />
        ))}
      </div>

      {/* Order rows */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="skeleton" style={{ height: 14, width: 100, borderRadius: 5 }} />
              <div className="skeleton" style={{ height: 14, width: 60, borderRadius: 5 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton" style={{ height: 11, width: 120, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 11, width: 60, borderRadius: 4 }} />
            </div>
          </div>
          <div className="skeleton" style={{ height: 28, width: 88, borderRadius: 20, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
