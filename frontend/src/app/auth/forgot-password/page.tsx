"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Mail, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";
import { apiClient } from "@/lib/api";

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { toast.error("Ingresa tu email"); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: email.toLowerCase().trim() });
    } catch {
      // El backend responde igual exista o no el email — un error real
      // (red caída, etc.) igual muestra la confirmación para no filtrar info.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 relative"
      style={{
        background: "radial-gradient(ellipse 90% 45% at 50% 0%, var(--accent-soft) 0%, var(--surface-2) 60%)",
      }}
    >
      <Link
        href="/auth/login"
        className="absolute top-5 left-5 flex items-center gap-1 text-sm font-semibold transition-colors"
        style={{ color: "var(--accent)" }}
      >
        <ChevronLeft size={18} />
        Volver
      </Link>

      <div className="mb-6"><Logo size="lg" variant="brand" /></div>

      <div
        className="w-full max-w-md rounded-3xl p-8"
        style={{ background: "var(--surface)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-lg)" }}
      >
        {!sent ? (
          <>
            <div className="mb-7">
              <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
                Ingresa tu email y te enviamos un enlace para crear una nueva.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="field-label" htmlFor="email">Email</label>
                <input
                  id="email" className="input" type="email" inputMode="email"
                  placeholder="tu@email.com" autoComplete="email" autoFocus
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (<><Spinner /> Enviando...</>) : "Enviar enlace"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--success-soft)" }}
            >
              <Mail size={26} style={{ color: "var(--success)" }} />
            </div>
            <h1 className="font-display font-extrabold text-xl mb-2" style={{ color: "var(--ink)" }}>
              Revisa tu correo
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
              Si <strong>{email}</strong> está registrado, te enviamos un enlace para
              restablecer tu contraseña. Válido por 1 hora.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs mb-6" style={{ color: "var(--ink-4)" }}>
              <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
              Revisa también la carpeta de spam
            </div>
            <Link href="/auth/login" className="btn-primary w-full block text-center">
              Volver a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
