"use client";

// src/components/dashboard/PageHeader.tsx
//
// Header único para todas las pantallas del dashboard — antes cada página
// armaba su propio encabezado (sticky vs no, extrabold vs bold, con o sin
// borde, con o sin padding de safe-area), así que el panel se sentía como
// varias apps pegadas entre sí. Este componente es el único lugar donde
// se define cómo se ve un título de página.

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Contenido extra debajo del título (buscador, filtros, tabs...) */
  children?: React.ReactNode;
}) {
  return (
    <div
      className="sticky top-0 z-10 px-5 pt-[max(20px,env(safe-area-inset-top))] md:pt-[max(28px,env(safe-area-inset-top))] pb-4"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
    >
      <div
        className="flex items-center justify-between gap-2 flex-wrap"
        style={children ? { marginBottom: 16 } : undefined}
      >
        <div className="min-w-0">
          <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
