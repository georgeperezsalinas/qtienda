"use client";

// src/components/ui/ErrorBoundary.tsx — qtienda v2
//
// Uso:
//   1. Global en layout.tsx → captura cualquier crash de la app
//   2. Por sección → mensaje específico ("Error en tus pedidos")
//
// Ejemplo en layout.tsx:
//   import ErrorBoundary from "@/components/ui/ErrorBoundary";
//   <ErrorBoundary><QueryProvider>...</QueryProvider></ErrorBoundary>
//
// Ejemplo por sección:
//   <ErrorBoundary label="pedidos">
//     <PedidosPage />
//   </ErrorBoundary>

import React from "react";

interface Props {
  children: React.ReactNode;
  // Etiqueta para mensajes y para reportar al equipo (ej: "pedidos", "productos")
  label?: string;
  // UI alternativa personalizada cuando ocurre un error
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Aquí puedes enviar a Sentry, LogRocket, etc.
    console.error(`[qtienda ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // UI personalizada si se pasa como prop
    if (this.props.fallback) return this.props.fallback;

    // UI por defecto — usa design tokens de qtienda
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 280,
          padding: "32px 24px",
          textAlign: "center",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>

        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--ink)",
            margin: "0 0 8px",
            letterSpacing: "-0.015em",
          }}
        >
          Algo salió mal
          {this.props.label ? ` en ${this.props.label}` : ""}
        </h2>

        <p
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            maxWidth: 300,
            lineHeight: 1.5,
            margin: "0 0 24px",
          }}
        >
          Ocurrió un error inesperado. Puedes intentar recargar o volver al
          inicio.
        </p>

        {/* Detalle técnico colapsado — útil en desarrollo */}
        {process.env.NODE_ENV === "development" && this.state.error && (
          <details
            style={{
              width: "100%",
              maxWidth: 480,
              textAlign: "left",
              marginBottom: 20,
              background: "var(--danger-soft)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--danger)",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 6 }}>
              Error técnico
            </summary>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack?.split("\n").slice(0, 6).join("\n")}
            </pre>
          </details>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={this.handleRetry}
            style={{
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>

          <a
            href="/dashboard"
            style={{
              background: "transparent",
              color: "var(--ink-2)",
              border: "1.5px solid var(--line)",
              borderRadius: 12,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }
}
