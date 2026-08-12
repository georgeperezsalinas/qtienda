"use client";

// Aviso de "¿sigues ahí?" con cuenta regresiva circular tipo reloj — aparece
// cuando useIdleRedirect detecta inactividad, antes de volver a la puerta.

import { motion, AnimatePresence } from "framer-motion";

const SIZE = 84;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function IdleRedirectOverlay({
  visible,
  secondsLeft,
  totalSeconds,
  accentColor,
  onStay,
}: {
  visible: boolean;
  secondsLeft: number;
  totalSeconds: number;
  accentColor: string;
  onStay: () => void;
}) {
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center p-4"
          style={{ background: "rgba(20,19,15,.55)", backdropFilter: "blur(3px)" }}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-full max-w-xs rounded-3xl p-6 text-center"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)" }}
          >
            <div className="relative mx-auto mb-4" style={{ width: SIZE, height: SIZE }}>
              <svg width={SIZE} height={SIZE} className="-rotate-90">
                <circle
                  cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                  fill="none" stroke="var(--line)" strokeWidth={STROKE}
                />
                <motion.circle
                  cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
                  fill="none" stroke={accentColor} strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress) }}
                  transition={{ duration: 0.25, ease: "linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
                {secondsLeft}
              </div>
            </div>

            <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
              ¿Sigues ahí?
            </h3>
            <p className="text-xs mb-5" style={{ color: "var(--ink-3)" }}>
              Sin actividad, volvemos al inicio de la tienda en unos segundos.
            </p>

            <button
              onClick={onStay}
              className="w-full rounded-2xl py-3 font-bold text-sm text-white transition-all active:scale-[.98]"
              style={{ background: accentColor }}
            >
              Sigo aquí
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
