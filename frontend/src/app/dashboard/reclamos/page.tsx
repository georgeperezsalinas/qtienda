"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ChevronDown, Send } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useStoreCurrency } from "@/hooks/useStoreCurrency";

interface Claim {
  id: string;
  claim_number: string;
  type: "reclamo" | "queja";
  consumer_name: string;
  consumer_dni: string;
  consumer_address: string;
  consumer_phone?: string | null;
  consumer_email?: string | null;
  order_id?: string | null;
  detail: string;
  claimed_amount_cents?: number | null;
  vendor_response?: string | null;
  status: "open" | "responded" | "closed";
  created_at: string;
  responded_at?: string | null;
}

function Skel({ h = 90 }: { h?: number }) {
  return <div className="skeleton rounded-2xl" style={{ height: h }} />;
}

function ClaimRow({ claim, onRespond, currency, locale }: {
  claim: Claim;
  onRespond: (id: string, response: string) => Promise<void>;
  currency: string;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState(claim.vendor_response || "");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!response.trim()) { toast.error("Escribe una respuesta"); return; }
    setSending(true);
    try {
      await onRespond(claim.id, response.trim());
      toast.success("Respuesta enviada");
    } catch {
      toast.error("No se pudo enviar la respuesta");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-4 text-left">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: claim.type === "reclamo" ? "var(--danger-soft)" : "var(--warn-soft)" }}
        >
          <ClipboardList size={18} style={{ color: claim.type === "reclamo" ? "var(--danger)" : "var(--warn)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display font-extrabold text-sm" style={{ color: "var(--ink)" }}>
              {claim.claim_number}
            </p>
            <span className={`badge text-[10px] ${claim.type === "reclamo" ? "badge-danger" : "badge-warn"}`}>
              {claim.type === "reclamo" ? "Reclamo" : "Queja"}
            </span>
            <span className={`badge text-[10px] ${claim.status === "responded" ? "badge-success" : "badge-mute"}`}>
              {claim.status === "responded" ? "Respondido" : "Abierto"}
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
            {claim.consumer_name} · {new Date(claim.created_at).toLocaleDateString("es-PE")}
          </p>
        </div>
        <ChevronDown
          size={16}
          style={{ color: "var(--ink-4)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="pt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <p style={{ color: "var(--ink-3)" }}>Documento: <span style={{ color: "var(--ink)" }}>{claim.consumer_dni}</span></p>
            {claim.consumer_phone && <p style={{ color: "var(--ink-3)" }}>Teléfono: <span style={{ color: "var(--ink)" }}>{claim.consumer_phone}</span></p>}
            {claim.consumer_email && <p style={{ color: "var(--ink-3)" }}>Email: <span style={{ color: "var(--ink)" }}>{claim.consumer_email}</span></p>}
            {claim.claimed_amount_cents != null && (
              <p style={{ color: "var(--ink-3)" }}>Monto: <span style={{ color: "var(--ink)" }}>{formatPrice(claim.claimed_amount_cents, currency, locale)}</span></p>
            )}
            <p className="col-span-2" style={{ color: "var(--ink-3)" }}>Dirección: <span style={{ color: "var(--ink)" }}>{claim.consumer_address}</span></p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>Detalle</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{claim.detail}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
              {claim.status === "responded" ? "Tu respuesta" : "Responder"}
            </p>
            <textarea
              className="input"
              rows={3}
              placeholder="Escribe tu respuesta al consumidor…"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              disabled={claim.status === "responded"}
            />
            {claim.status !== "responded" && (
              <button
                onClick={submit}
                disabled={sending}
                className="btn-primary mt-2 disabled:opacity-60"
                style={{ width: "auto", padding: "8px 16px" }}
              >
                <Send size={13} /> {sending ? "Enviando…" : "Enviar respuesta"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReclamosPage() {
  const { code: currency, locale } = useStoreCurrency();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/claims/");
      setClaims(data);
    } catch {
      toast.error("No se pudieron cargar los reclamos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function respond(id: string, response: string) {
    const { data } = await apiClient.post(`/claims/${id}/respond`, { vendor_response: response });
    setClaims((cs) => cs.map((c) => (c.id === id ? data : c)));
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      <div
        className="sticky top-0 z-10 px-5 pt-[max(20px,env(safe-area-inset-top))] md:pt-[max(28px,env(safe-area-inset-top))] pb-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
      >
        <h1 className="font-display font-extrabold text-xl" style={{ color: "var(--ink)" }}>
          Libro de Reclamaciones
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
          {claims.length} registro{claims.length !== 1 ? "s" : ""} — visible para tus compradores en el pie de tu tienda
        </p>
      </div>

      <div className="px-5 pt-4 pb-8 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {loading ? (
          [...Array(3)].map((_, i) => <Skel key={i} />)
        ) : claims.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center animate-fade-in lg:col-span-2">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--surface-2)" }}>
              <ClipboardList size={36} style={{ color: "var(--ink-4)" }} />
            </div>
            <h3 className="font-display font-bold text-base mb-1" style={{ color: "var(--ink)" }}>
              Sin reclamos ni quejas
            </h3>
            <p className="text-sm max-w-xs" style={{ color: "var(--ink-3)" }}>
              Cuando un comprador registre un reclamo desde tu tienda, aparecerá aquí para que lo respondas.
            </p>
          </div>
        ) : (
          claims.map((c) => (
            <ClaimRow key={c.id} claim={c} onRespond={respond} currency={currency} locale={locale} />
          ))
        )}
      </div>
    </div>
  );
}
