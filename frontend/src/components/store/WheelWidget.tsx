"use client";

// Ruleta de premios — botón flotante que aparece si el vendedor la activó y
// este visitante todavía no giró (1 giro por sesión, para siempre). El
// backend elige el premio antes de que el frontend anime nada — acá solo
// animamos hacia un resultado que el servidor ya decidió.

import { useEffect, useState } from "react";
import { X, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { getSessionId } from "@/lib/analyticsSession";

interface Segment {
  label: string;
  discount_type: "percent" | "fixed" | "none";
  discount_value: number;
  weight: number;
  color: string;
}

export default function WheelWidget({ slug, accentColor }: { slug: string; accentColor: string }) {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ prize_label: string; coupon_code: string | null } | null>(null);

  useEffect(() => {
    const storageKey = `qtienda_wheel_spun_${slug}`;
    if (localStorage.getItem(storageKey)) return;
    (async () => {
      try {
        const { data } = await apiClient.get(`/public/store/${slug}/wheel`, {
          params: { session_id: getSessionId() },
        });
        if (!data.enabled) return;
        if (data.already_spun) {
          localStorage.setItem(storageKey, "1");
          return;
        }
        if (Array.isArray(data.segments) && data.segments.length > 0) {
          setSegments(data.segments);
        }
      } catch {
        // silencioso — la ruleta es un extra, no debe romper la tienda si falla
      }
    })();
  }, [slug]);

  async function spin() {
    if (spinning || !segments) return;
    setSpinning(true);
    try {
      const { data } = await apiClient.post(`/public/store/${slug}/wheel/spin`, {
        session_id: getSessionId(),
      });

      const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
      const winnerIdx: number = typeof data.segment_index === "number"
        ? data.segment_index
        : Math.max(0, segments.findIndex((s) => s.label === data.prize_label));

      let angleAcc = 0;
      for (let i = 0; i < winnerIdx; i++) angleAcc += (segments[i].weight / totalWeight) * 360;
      const segAngle = (segments[winnerIdx].weight / totalWeight) * 360;
      const targetAngle = angleAcc + segAngle / 2;

      const fullSpins = 5 * 360;
      setRotation((r) => r + fullSpins + (360 - targetAngle));

      setTimeout(() => {
        setResult({ prize_label: data.prize_label, coupon_code: data.coupon_code });
        localStorage.setItem(`qtienda_wheel_spun_${slug}`, "1");
        setSpinning(false);
      }, 4200);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudo girar la ruleta, intenta de nuevo");
      setSpinning(false);
    }
  }

  function copyCode() {
    if (!result?.coupon_code) return;
    navigator.clipboard?.writeText(result.coupon_code);
    toast.success("Código copiado");
  }

  if (!segments) return null;

  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  let acc = 0;
  const gradientStops = segments.map((s) => {
    const start = (acc / totalWeight) * 360;
    acc += s.weight;
    const end = (acc / totalWeight) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  });
  const gradient = `conic-gradient(${gradientStops.join(", ")})`;

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 300 }}
        onClick={() => setOpen(true)}
        className="fixed left-3 bottom-6 z-20 w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ background: accentColor, boxShadow: `0 4px 20px ${accentColor}66` }}
        aria-label="Girar la ruleta de premios"
      >
        🎁
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[59] flex items-center justify-center p-4"
            style={{ background: "rgba(20,19,15,.6)", backdropFilter: "blur(4px)" }}
            onClick={() => !spinning && setOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl p-6 text-center"
              style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)" }}
            >
              {!spinning && (
                <button
                  onClick={() => setOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--surface-2)" }}
                  aria-label="Cerrar"
                >
                  <X size={15} style={{ color: "var(--ink-2)" }} />
                </button>
              )}

              {result ? (
                <>
                  <div className="text-4xl mb-3">{result.coupon_code ? "🎉" : "😊"}</div>
                  <h3 className="font-display font-extrabold text-lg mb-1" style={{ color: "var(--ink)" }}>
                    {result.prize_label}
                  </h3>
                  {result.coupon_code ? (
                    <>
                      <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
                        Usa este código en tu compra — válido por 48 horas
                      </p>
                      <button
                        onClick={copyCode}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold text-sm tracking-wide"
                        style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px dashed var(--line-2)" }}
                      >
                        {result.coupon_code} <Copy size={14} />
                      </button>
                    </>
                  ) : (
                    <p className="text-xs mb-2" style={{ color: "var(--ink-3)" }}>
                      Esta vez no hubo premio — ¡gracias por visitarnos!
                    </p>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full mt-4 rounded-2xl py-3 font-bold text-sm text-white"
                    style={{ background: accentColor }}
                  >
                    Listo
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-display font-extrabold text-lg mb-1" style={{ color: "var(--ink)" }}>
                    ¡Gira y gana!
                  </h3>
                  <p className="text-xs mb-5" style={{ color: "var(--ink-3)" }}>
                    Un giro gratis — puede tocarte un descuento para tu compra
                  </p>

                  <div className="relative mx-auto mb-5" style={{ width: 220, height: 220 }}>
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: gradient,
                        transform: `rotate(${rotation}deg)`,
                        transition: spinning ? "transform 4.2s cubic-bezier(.17,.67,.16,1)" : "none",
                        border: "4px solid var(--surface)",
                        boxShadow: "0 4px 20px rgba(0,0,0,.15)",
                      }}
                    />
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

                  <button
                    onClick={spin}
                    disabled={spinning}
                    className="w-full rounded-2xl py-3.5 font-extrabold text-sm text-white transition-all active:scale-[.98] disabled:opacity-60"
                    style={{ background: accentColor }}
                  >
                    {spinning ? "Girando…" : "Girar la ruleta"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
