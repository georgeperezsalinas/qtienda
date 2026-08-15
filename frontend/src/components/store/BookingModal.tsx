"use client";

// Flujo de reserva de una cita: fecha → horarios disponibles → datos del
// paciente → confirmar. Selector simple de los próximos 14 días, sin
// librería de calendario externa.

import { useEffect, useState } from "react";
import { X, Clock, Check, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import PhoneVerifyStep from "./PhoneVerifyStep";
import PhoneInput from "@/components/ui/PhoneInput";

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price_cents?: number | null;
  image_url?: string | null;
}

const DAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function nextDays(n: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingModal({
  service, storeSlug, storeCurrency = "PEN", storeLocale = "es-PE", accentColor, onClose,
}: {
  service: Service;
  storeSlug: string;
  storeCurrency?: string;
  storeLocale?: string;
  accentColor: string;
  onClose: () => void;
}) {
  const [days] = useState(() => nextDays(14));
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [pendingSlots, setPendingSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"slots" | "form" | "verify" | "done">("slots");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingSlots(true);
    setSlots(null);
    setTakenSlots([]);
    setPendingSlots([]);
    setSelectedSlot(null);
    apiClient
      .get(`/public/store/${storeSlug}/services/${service.id}/availability`, {
        params: { date_param: toISODate(selectedDate) },
      })
      .then(({ data }) => {
        setSlots(data.slots || []);
        setTakenSlots(data.taken_slots || []);
        setPendingSlots(data.pending_slots || []);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, service.id, storeSlug]);

  function goToVerify() {
    if (!name.trim() || !phone.trim() || !dni.trim() || !selectedSlot) {
      toast.error("Completa tu nombre, documento y teléfono");
      return;
    }
    setStep("verify");
  }

  async function confirmBooking() {
    setSubmitting(true);
    try {
      const [h, m] = selectedSlot!.split(":").map(Number);
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(h, m, 0, 0);
      await apiClient.post(`/public/store/${storeSlug}/appointments`, {
        service_id: service.id,
        patient_name: name.trim(),
        patient_phone: phone.trim(),
        patient_dni: dni.trim(),
        scheduled_at: scheduledAt.toISOString(),
      });
      // Para mostrar "Ya reservaste" en la tarjeta del servicio sin tener que
      // volver a preguntarle nada — mismo espíritu que la ruleta (localStorage).
      localStorage.setItem(`qtienda_booked_${storeSlug}_${service.id}`, "1");
      setStep("done");
    } catch (err: any) {
      const detail: string = err.response?.data?.detail || "";
      if (detail.startsWith("PHONE_NOT_VERIFIED")) {
        // La verificación expiró justo en el medio — que la repita en vez
        // de solo mostrarle un error genérico sin salida.
        toast.error("Tu verificación expiró, verifica tu teléfono de nuevo");
        setStep("verify");
      } else {
        toast.error(detail || "Ese horario ya no está disponible, elige otro");
        setStep("slots");
        setSelectedSlot(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[92] flex items-center justify-center p-4"
        style={{ background: "rgba(20,19,15,.55)" }}
        onClick={onClose}
      >
      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-[93] w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-extrabold text-base" style={{ color: "var(--ink)" }}>
            Reservar: {service.name}
          </h3>
          <button onClick={onClose}><X size={16} style={{ color: "var(--ink-3)" }} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
          {service.duration_minutes} min
          {service.price_cents != null && <> · {formatPrice(service.price_cents, storeCurrency, storeLocale)}</>}
        </p>

        {step === "verify" ? (
          <PhoneVerifyStep
            phone={phone.trim()}
            accentColor={accentColor}
            onBack={() => setStep("form")}
            onVerified={confirmBooking}
          />
        ) : step === "done" ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--success-soft)" }}>
              <Check size={22} style={{ color: "var(--success)" }} />
            </div>
            <p className="font-bold text-sm mb-1" style={{ color: "var(--ink)" }}>¡Cita reservada!</p>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              {selectedDate.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })} a las {selectedSlot}
            </p>
            <button onClick={onClose} className="btn-primary w-full" style={{ padding: "12px" }}>Listo</button>
          </div>
        ) : step === "form" ? (
          <div>
            <button onClick={() => setStep("slots")} className="flex items-center gap-1 text-xs font-bold mb-3" style={{ color: accentColor }}>
              <ChevronLeft size={13} /> Volver
            </button>
            <p className="text-xs font-bold mb-3" style={{ color: "var(--ink)" }}>
              {selectedDate.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })} a las {selectedSlot}
            </p>
            <div className="space-y-2">
              <input className="input text-sm" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <PhoneInput value={phone} onChange={setPhone} />
              <input className="input text-sm" placeholder="Documento de identidad (DNI, RUT, cédula...)" value={dni} onChange={(e) => setDni(e.target.value)} />
              <button onClick={goToVerify} disabled={submitting} className="btn-primary w-full" style={{ padding: "12px", background: accentColor }}>
                Continuar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {days.map((d) => {
                const active = toISODate(d) === toISODate(selectedDate);
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    className="flex-shrink-0 flex flex-col items-center rounded-xl px-2.5 py-2"
                    style={{ background: active ? accentColor : "var(--surface-2)", color: active ? "#fff" : "var(--ink-2)" }}
                  >
                    <span className="text-[9px] font-bold uppercase">{DAY_LABELS[d.getDay()]}</span>
                    <span className="text-sm font-extrabold">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            {loadingSlots ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--ink-3)" }}>Buscando horarios…</p>
            ) : (slots && slots.length > 0) || takenSlots.length > 0 || pendingSlots.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ...slots!.map((s) => ({ time: s, state: "free" as const })),
                    ...takenSlots.map((s) => ({ time: s, state: "taken" as const })),
                    ...pendingSlots.map((s) => ({ time: s, state: "pending" as const })),
                  ]
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map(({ time, state }) => (
                      <button
                        key={time}
                        disabled={state !== "free"}
                        onClick={() => { setSelectedSlot(time); setStep("form"); }}
                        title={
                          state === "taken" ? "Ya reservado — elige otro horario"
                          : state === "pending" ? "En revisión del vendedor — puede liberarse"
                          : undefined
                        }
                        className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold disabled:cursor-not-allowed"
                        style={
                          state === "taken"
                            ? { background: "var(--danger-soft)", color: "var(--danger)", opacity: 0.85, textDecoration: "line-through" }
                            : state === "pending"
                            ? { background: "var(--danger-soft)", color: "var(--danger)", opacity: 0.55, textDecoration: "line-through" }
                            : { background: "var(--surface-2)", color: "var(--ink)" }
                        }
                      >
                        <Clock size={11} /> {time}
                      </button>
                    ))}
                </div>
                {/* Ambos estados se pintan en rojo — un horario pendiente de
                    confirmación tampoco se puede volver a reservar, así que
                    debe leerse igual de "ocupado" que uno ya confirmado; solo
                    cambia el motivo, que se explica en el tooltip de arriba. */}
                {(takenSlots.length > 0 || pendingSlots.length > 0) && (
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {takenSlots.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-4)" }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: "var(--danger)" }} /> Reservado
                      </span>
                    )}
                    {pendingSlots.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-4)" }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: "var(--danger)", opacity: 0.55 }} /> En revisión
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-center py-6" style={{ color: "var(--ink-3)" }}>
                No hay horarios disponibles este día — prueba con otra fecha.
              </p>
            )}
          </>
        )}
      </motion.div>
      </motion.div>
    </>
  );
}
