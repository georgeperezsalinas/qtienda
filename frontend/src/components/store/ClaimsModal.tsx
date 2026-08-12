"use client";

// Libro de Reclamaciones Virtual — requisito legal en Perú para tiendas
// online. Botón de texto en el footer + modal con el formulario mínimo que
// pide un libro de reclamaciones estándar (datos del consumidor, tipo,
// detalle de los hechos, monto reclamado si aplica).

import { useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

const EMPTY_FORM = {
  type: "reclamo" as "reclamo" | "queja",
  consumer_name: "",
  consumer_dni: "",
  consumer_address: "",
  consumer_phone: "",
  consumer_email: "",
  detail: "",
  claimed_amount: "",
};

export default function ClaimsModal({ slug, accentColor }: { slug: string; accentColor: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [claimNumber, setClaimNumber] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setTimeout(() => { setForm(EMPTY_FORM); setClaimNumber(null); }, 250);
  }

  async function submit() {
    if (!form.consumer_name.trim() || !form.consumer_dni.trim() || !form.consumer_address.trim() || !form.detail.trim()) {
      toast.error("Completa nombre, documento, dirección y el detalle");
      return;
    }
    setSending(true);
    try {
      const { data } = await apiClient.post(`/public/store/${slug}/claims`, {
        type: form.type,
        consumer_name: form.consumer_name.trim(),
        consumer_dni: form.consumer_dni.trim(),
        consumer_address: form.consumer_address.trim(),
        consumer_phone: form.consumer_phone.trim() || undefined,
        consumer_email: form.consumer_email.trim() || undefined,
        detail: form.detail.trim(),
        claimed_amount_cents: form.claimed_amount ? Math.round(Number(form.claimed_amount) * 100) : undefined,
      });
      setClaimNumber(data.claim_number);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudo registrar el reclamo");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium"
        style={{ color: "var(--ink-4)" }}
      >
        <ClipboardList size={12} /> Libro de Reclamaciones
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[59] flex items-center justify-center p-4"
            style={{ background: "rgba(20,19,15,.45)", backdropFilter: "blur(4px)" }}
            onClick={close}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl p-6 overflow-y-auto"
              style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", maxHeight: "85vh" }}
            >
              <button
                onClick={close}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--surface-2)" }}
                aria-label="Cerrar"
              >
                <X size={15} style={{ color: "var(--ink-2)" }} />
              </button>

              {claimNumber ? (
                <div className="text-center py-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                    style={{ background: "var(--success-soft)" }}
                  >
                    <ClipboardList size={22} style={{ color: "var(--success)" }} />
                  </div>
                  <h3 className="font-display font-extrabold text-lg mb-1" style={{ color: "var(--ink)" }}>
                    Registrado — {claimNumber}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                    Guarda este número como constancia. La tienda tiene hasta 30 días para responder.
                  </p>
                  <button
                    onClick={close}
                    className="w-full mt-5 rounded-2xl py-3 font-bold text-sm text-white"
                    style={{ background: accentColor }}
                  >
                    Listo
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${accentColor}12` }}
                  >
                    <ClipboardList size={22} style={{ color: accentColor }} />
                  </div>
                  <h3 className="font-display font-extrabold text-lg mb-1" style={{ color: "var(--ink)" }}>
                    Libro de Reclamaciones
                  </h3>
                  <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
                    Conforme al Código de Protección y Defensa del Consumidor.
                  </p>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {(["reclamo", "queja"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setForm((f) => ({ ...f, type: t }))}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all capitalize"
                          style={{
                            background: form.type === t ? "var(--ink)" : "var(--surface-2)",
                            color: form.type === t ? "var(--bg)" : "var(--ink-2)",
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <input
                      className="input" placeholder="Nombre completo *"
                      value={form.consumer_name}
                      onChange={(e) => setForm((f) => ({ ...f, consumer_name: e.target.value }))}
                    />
                    <input
                      className="input" placeholder="DNI / documento *"
                      value={form.consumer_dni}
                      onChange={(e) => setForm((f) => ({ ...f, consumer_dni: e.target.value }))}
                    />
                    <input
                      className="input" placeholder="Dirección *"
                      value={form.consumer_address}
                      onChange={(e) => setForm((f) => ({ ...f, consumer_address: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input" placeholder="Teléfono" inputMode="tel"
                        value={form.consumer_phone}
                        onChange={(e) => setForm((f) => ({ ...f, consumer_phone: e.target.value }))}
                      />
                      <input
                        className="input" placeholder="Email" type="email"
                        value={form.consumer_email}
                        onChange={(e) => setForm((f) => ({ ...f, consumer_email: e.target.value }))}
                      />
                    </div>
                    <input
                      className="input" placeholder="Monto reclamado (S/, opcional)" type="number" inputMode="decimal"
                      value={form.claimed_amount}
                      onChange={(e) => setForm((f) => ({ ...f, claimed_amount: e.target.value }))}
                    />
                    <textarea
                      className="input" placeholder="Detalle de los hechos *" rows={4}
                      value={form.detail}
                      onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                    />
                  </div>

                  <button
                    onClick={submit}
                    disabled={sending}
                    className="w-full mt-4 rounded-2xl py-3.5 font-bold text-sm text-white transition-all active:scale-[.98] disabled:opacity-60"
                    style={{ background: accentColor }}
                  >
                    {sending ? "Enviando…" : "Registrar"}
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
