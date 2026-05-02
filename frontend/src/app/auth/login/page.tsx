"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ChevronLeft, Store } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const GoogleLoginButton = dynamic(
  () => import("@/components/ui/GoogleLoginButton"),
  { ssr: false }
);


export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]  = useState(false);
  const [focused, setFocused]  = useState<string | null>(null);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.email || !form.password) {
      toast.error("Completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/login", {
        email: form.email.toLowerCase().trim(),
        password: form.password,
      });

      setTokens(data.access_token, data.refresh_token);

      const { data: me } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setUser(me);

      toast.success("¡Bienvenido de vuelta!");
      if (me.role === "admin")        router.push("/admin");
      else if (me.role === "buyer")  router.push("/mis-pedidos");
      else                           router.push("/dashboard");
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) toast.error("Email o contraseña incorrectos");
      else if (status === 403) toast.error("Cuenta suspendida. Contacta soporte.");
      else toast.error("Error al iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "var(--surface-2)" }}
    >
      {/* ── Top nav ── */}
      <nav className="flex items-center justify-between px-5 pt-safe pt-4 pb-2 animate-fade-in">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-semibold transition-colors"
          style={{ color: "var(--ink-2)" }}
          aria-label="Volver al inicio"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <span
          className="font-display font-extrabold text-lg"
          style={{ color: "var(--brand-600)" }}
        >
          q<span style={{ color: "var(--ink)" }}>tienda</span>
        </span>
        <div className="w-16" aria-hidden /> {/* spacer */}
      </nav>

      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-6 text-center animate-fade-up">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--brand-600)", boxShadow: "var(--shadow-brand)" }}
        >
          <Store size={28} color="white" />
        </div>
        <h1
          className="font-display font-extrabold text-2xl mb-1"
          style={{ color: "var(--ink)" }}
        >
          Bienvenido
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          Entra a tu panel de vendedor
        </p>
      </div>

      {/* ── Form ── */}
      <div className="flex-1 px-5 max-w-sm mx-auto w-full">

        {/* Social login */}
        <div className="animate-fade-up delay-100 mb-5">
          <GoogleLoginButton />
        </div>

        {/* Divider */}
        <div className="or-divider mb-5 animate-fade-up delay-150">
          o inicia con tu email
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Email */}
          <div className="animate-fade-up delay-150">
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              className={`input ${focused === "email" ? "ring-2 ring-[--brand-500]/20" : ""}`}
              type="email"
              placeholder="juan@ejemplo.com"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={update("email")}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
            />
          </div>

          {/* Password */}
          <div className="animate-fade-up delay-200">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="field-label mb-0">Contraseña</label>
              <button
                type="button"
                className="text-xs font-semibold transition-colors"
                style={{ color: "var(--brand-600)" }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                className="input pr-12"
                type={showPass ? "text" : "password"}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                value={form.password}
                onChange={update("password")}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--ink-3)" }}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 animate-fade-up delay-250">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Ingresando...
                </span>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </div>

        </form>

        <p
          className="text-center text-sm mt-6 mb-8 animate-fade-up delay-300"
          style={{ color: "var(--ink-3)" }}
        >
          ¿No tienes cuenta?{" "}
          <Link
            href="/auth/register"
            className="font-bold transition-colors"
            style={{ color: "var(--brand-600)" }}
          >
            Regístrate gratis
          </Link>
        </p>

      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
