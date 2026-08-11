"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
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

function ResetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword]  = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "var(--danger-soft)" }}
        >
          <span className="text-3xl">❌</span>
        </div>
        <h1 className="font-display font-extrabold text-xl mb-2" style={{ color: "var(--ink)" }}>
          Enlace inválido
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
          Este enlace no es válido. Solicita uno nuevo.
        </p>
        <Link href="/auth/forgot-password" className="btn-primary w-full block text-center">
          Solicitar enlace
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "var(--success-soft)" }}
        >
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="font-display font-extrabold text-xl mb-2" style={{ color: "var(--ink)" }}>
          ¡Contraseña actualizada!
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--ink-3)" }}>
          Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <Link href="/auth/login" className="btn-primary w-full block text-center">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      toast.success("Contraseña actualizada");
      setDone(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "El enlace expiró o ya fue utilizado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Crea una nueva contraseña
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          Mínimo 8 caracteres.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="field-label" htmlFor="password">Nueva contraseña</label>
          <div className="relative">
            <input
              id="password" className="input pr-12"
              type={showPass ? "text" : "password"}
              placeholder="Mínimo 8 caracteres" autoComplete="new-password" autoFocus
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--ink-4)" }}
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            id="confirmPassword" className="input"
            type={showPass ? "text" : "password"}
            placeholder="Repite tu contraseña" autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? (<><Spinner /> Guardando...</>) : "Guardar contraseña"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
        <Suspense fallback={<p className="text-sm text-center" style={{ color: "var(--ink-3)" }}>Cargando…</p>}>
          <ResetContent />
        </Suspense>
      </div>
    </div>
  );
}
