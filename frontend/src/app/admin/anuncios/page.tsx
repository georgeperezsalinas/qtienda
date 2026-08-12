"use client";

// Admin: anuncios manuales a vendedores (nueva función, nuevo plan, avisos
// operativos como el cambio de dominio). Reusa /admin/notifications/broadcast,
// que ya existía — llega por el mismo canal que el resto de notificaciones
// (campanita + push), sin sistema nuevo.

import { useEffect, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
}

export default function AdminAnunciosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("/dashboard");
  const [planId, setPlanId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get("/plans/")
      .then(({ data }) => setPlans(Array.isArray(data) ? data : data.items || []))
      .catch(() => {});
  }, []);

  async function send() {
    if (!title.trim() || !body.trim()) {
      toast.error("Completa el título y el mensaje");
      return;
    }
    if (
      !confirm(
        `Esto le va a llegar como notificación (con push) a ${
          planId ? "todas las tiendas del plan seleccionado" : "TODAS las tiendas activas"
        }. ¿Confirmas el envío?`
      )
    ) {
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const { data } = await apiClient.post("/admin/notifications/broadcast", {
        title: title.trim(),
        body: body.trim(),
        action_url: actionUrl.trim() || undefined,
        plan_id: planId || undefined,
      });
      setLastResult(data.targeted_stores ?? 0);
      toast.success(`Enviado a ${data.targeted_stores ?? 0} tiendas`);
      setTitle("");
      setBody("");
      setActionUrl("/dashboard");
      setPlanId("");
    } catch {
      toast.error("No se pudo enviar el anuncio");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Megaphone size={20} style={{ color: "var(--accent)" }} />
        <h1 className="font-display font-bold text-xl" style={{ color: "var(--ink)" }}>
          Anuncios
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
        Manda un aviso a los vendedores — les llega por la campanita de notificaciones y, si tienen
        la app instalada o notificaciones activadas, también como push. Úsalo para novedades,
        avisos operativos importantes o cambios que necesiten que el vendedor haga algo.
      </p>

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-3)" }}>
            Título
          </label>
          <input
            className="input"
            placeholder="Ej: Tu tienda tiene un link nuevo 🎉"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-3)" }}>
            Mensaje
          </label>
          <textarea
            className="input"
            rows={4}
            placeholder="Explica qué cambió y qué tiene que hacer el vendedor, si algo."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
          />
          <p className="text-[11px] mt-1 text-right" style={{ color: "var(--ink-4)" }}>
            {body.length}/300
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-3)" }}>
            Link al tocar la notificación (opcional)
          </label>
          <input
            className="input"
            placeholder="/dashboard"
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: "var(--ink-3)" }}>
            Destinatarios
          </label>
          <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Todas las tiendas activas</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                Solo plan {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-bold text-sm text-white transition-all active:scale-[.98] disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          <Send size={15} />
          {sending ? "Enviando…" : "Enviar anuncio"}
        </button>

        {lastResult != null && (
          <p className="text-xs text-center" style={{ color: "var(--success)" }}>
            Último envío: {lastResult} tienda{lastResult !== 1 ? "s" : ""} notificada{lastResult !== 1 ? "s" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}
