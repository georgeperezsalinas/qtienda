"use client";

// "Ver mis citas" — sin exponer la agenda completa de la tienda, el
// comprador debe identificarse (DNI + teléfono) y verificar su teléfono por
// WhatsApp, igual que al reservar, antes de ver su propia lista de citas en
// esta tienda. Sin nombre a propósito: es mal criterio de búsqueda (una
// letra distinta, un apellido incompleto) — DNI + teléfono verificado
// alcanzan para identificar sin ese problema.

import { useState } from "react";
import { X, ChevronLeft, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import PhoneVerifyStep from "./PhoneVerifyStep";
import PhoneInput from "@/components/ui/PhoneInput";

interface MyAppointment {
  id: string;
  service_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

// Mismo criterio de color que el marcado del selector de horarios: pendiente
// y confirmada son igual de "reservada" para el comprador (ninguna se puede
// volver a tomar), solo cambia el motivo.
const STATUS_INFO: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: "Reservada · en revisión", bg: "var(--danger-soft)", fg: "var(--danger)" },
  confirmed: { label: "Reservada · confirmada", bg: "var(--danger-soft)", fg: "var(--danger)" },
  completed: { label: "Completada", bg: "var(--success-soft)", fg: "var(--success)" },
  cancelled: { label: "Cancelada", bg: "var(--surface-2)", fg: "var(--ink-4)" },
  no_show: { label: "No se presentó", bg: "var(--surface-2)", fg: "var(--ink-4)" },
};

export default function MyAppointmentsModal({
  storeSlug, accentColor, onClose,
}: {
  storeSlug: string;
  accentColor: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "verify" | "list">("form");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<MyAppointment[] | null>(null);

  function goToVerify() {
    if (!dni.trim() || !phone.trim()) {
      toast.error("Completa tu documento y teléfono");
      return;
    }
    setStep("verify");
  }

  async function loadAppointments() {
    setLoading(true);
    try {
      const { data } = await apiClient.post(`/public/store/${storeSlug}/appointments/lookup`, {
        patient_dni: dni.trim(),
        patient_phone: phone.trim(),
      });
      setAppointments(data);
      setStep("list");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudieron cargar tus citas");
    } finally {
      setLoading(false);
    }
  }

  return (
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-extrabold text-base" style={{ color: "var(--ink)" }}>
            Mis citas
          </h3>
          <button onClick={onClose}><X size={16} style={{ color: "var(--ink-3)" }} /></button>
        </div>

        {step === "verify" ? (
          <PhoneVerifyStep
            phone={phone.trim()}
            accentColor={accentColor}
            onBack={() => setStep("form")}
            onVerified={loadAppointments}
          />
        ) : step === "list" ? (
          <div>
            <button onClick={() => setStep("form")} className="flex items-center gap-1 text-xs font-bold mb-3" style={{ color: accentColor }}>
              <ChevronLeft size={13} /> Buscar con otros datos
            </button>
            {loading ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--ink-3)" }}>Cargando…</p>
            ) : !appointments || appointments.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--ink-3)" }}>
                No encontramos citas con esos datos en esta tienda.
              </p>
            ) : (
              <div className="space-y-2">
                {appointments.map((a) => {
                  const info = STATUS_INFO[a.status] || STATUS_INFO.pending;
                  const date = new Date(a.scheduled_at);
                  return (
                    <div key={a.id} className="rounded-2xl p-3" style={{ background: "var(--surface-2)" }}>
                      <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>{a.service_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                        {date.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })} a las{" "}
                        {date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <span
                        className="inline-block mt-2 text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: info.bg, color: info.fg }}
                      >
                        {info.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${accentColor}18` }}
              >
                <CalendarClock size={15} style={{ color: accentColor }} />
              </div>
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                Ingresa el documento y teléfono con los que reservaste, para ver tus citas en esta tienda sin ver la agenda de nadie más.
              </p>
            </div>
            <div className="space-y-2">
              <input className="input text-sm" placeholder="Documento de identidad (DNI, RUT, cédula...)" value={dni} onChange={(e) => setDni(e.target.value)} />
              <PhoneInput value={phone} onChange={setPhone} />
              <button onClick={goToVerify} className="btn-primary w-full" style={{ padding: "12px", background: accentColor }}>
                Continuar
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
