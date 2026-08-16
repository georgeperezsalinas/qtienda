"use client";

// Dibuja la ruleta (gradiente cónico + etiquetas + flecha) — usado tanto por
// el widget que ve el comprador (WheelWidget.tsx) como por el preview en
// vivo del editor del vendedor (dashboard/ruleta/page.tsx). Una sola fuente
// para el render evita que se desalineen entre sí.
//
// Las etiquetas muestran el valor compacto del premio ("10%", "S/5", "🙂"),
// no el texto libre completo — con 2-6 segmentos y texto largo tipo "20% de
// descuento", el texto envuelto en varias líneas y luego rotado quedaba
// mostrando de costado/al revés y se salía del círculo. Cada etiqueta se
// contra-rota en su propio eje para nunca quedar de cabeza, sin afectar su
// posición radial (esa parte del cálculo ya era correcta).

export interface WheelSegment {
  label: string;
  discount_type: "percent" | "fixed" | "none";
  discount_value: number;
  weight: number;
  color: string;
}

export function wheelSegmentValueLabel(s: WheelSegment): string {
  if (s.discount_type === "percent") return `${s.discount_value}%`;
  if (s.discount_type === "fixed") return `S/${Math.round(s.discount_value / 100)}`;
  return "🙂";
}

export default function WheelPreview({
  segments, size = 220, rotation = 0, spinning = false,
}: {
  segments: WheelSegment[];
  size?: number;
  rotation?: number;
  spinning?: boolean;
}) {
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0) || 1;
  let acc = 0;
  const segmentAngles = segments.map((s) => {
    const start = (acc / totalWeight) * 360;
    acc += s.weight;
    const end = (acc / totalWeight) * 360;
    return { start, end, mid: (start + end) / 2 };
  });
  const gradient = segments.length > 0
    ? `conic-gradient(${segments.map((s, i) => `${s.color} ${segmentAngles[i].start}deg ${segmentAngles[i].end}deg`).join(", ")})`
    : "var(--surface-2)";

  const radius = size / 2;
  const labelDistance = radius - Math.max(22, size * 0.13);
  const fontSize = size < 180 ? 11 : segments.length > 5 ? 12 : 14;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: gradient,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4.2s cubic-bezier(.17,.67,.16,1)" : "none",
          border: "4px solid var(--surface)",
          boxShadow: "0 4px 20px rgba(0,0,0,.15)",
        }}
      >
        {segments.map((s, i) => {
          const mid = segmentAngles[i].mid;
          const upsideDown = mid > 90 && mid < 270;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%, -50%) rotate(${mid}deg) translateY(-${labelDistance}px)`,
              }}
            >
              <span
                className="block font-extrabold text-white"
                style={{
                  fontSize,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  transform: upsideDown ? "rotate(180deg)" : undefined,
                  textShadow: "0 1px 2px rgba(0,0,0,.4)",
                }}
              >
                {wheelSegmentValueLabel(s)}
              </span>
            </span>
          );
        })}
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-1 w-0 h-0"
        style={{
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderTop: "16px solid var(--ink)",
          zIndex: 2,
        }}
      />
    </div>
  );
}
