// src/components/ui/BrandSpinner.tsx
// Spinner de marca — mismo trazo de la lupa del logo, con un anillo del
// color de acento girando alrededor. Componente de servidor (sin "use
// client"): es CSS puro, así se puede usar directo en loading.tsx sin
// sumar JS extra a la carga que se supone que está acelerando.

interface BrandSpinnerProps {
  label?: string;
  fullScreen?: boolean;
  size?: number;
}

export default function BrandSpinner({ label, fullScreen = true, size = 56 }: BrandSpinnerProps) {
  return (
    <div
      className={fullScreen ? "min-h-dvh flex flex-col items-center justify-center gap-4" : "flex flex-col items-center justify-center gap-4 py-16"}
      style={{ background: fullScreen ? "var(--bg)" : undefined }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${Math.max(2, Math.round(size / 18))}px solid var(--line)`,
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${Math.max(2, Math.round(size / 18))}px solid transparent`,
            borderTopColor: "var(--accent)",
            animation: "qt-spin 0.85s linear infinite",
          }}
        />
        <svg
          width={size * 0.42}
          height={size * 0.42}
          viewBox="0 0 100 100"
          fill="none"
          className="absolute top-1/2 left-1/2"
          style={{ transform: "translate(-50%, -50%)" }}
          aria-hidden
        >
          <circle cx="38" cy="38" r="28" stroke="var(--ink)" strokeWidth="8" />
          <path d="M58 58 L82 82" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
          <circle cx="84" cy="84" r="7.6" fill="var(--accent)" />
        </svg>
      </div>
      {label && (
        <p className="text-sm font-medium" style={{ color: "var(--ink-3)" }}>
          {label}
        </p>
      )}
    </div>
  );
}
