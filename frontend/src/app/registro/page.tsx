"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { Eye, EyeOff, ChevronLeft, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const GoogleLoginButton = dynamic(
  () => import("@/components/ui/GoogleLoginButton"),
  { ssr: false }
);
const FacebookLoginButton = dynamic(
  () => import("@/components/ui/FacebookLoginButton"),
  { ssr: false }
);

interface FormData {
  full_name: string;
  email: string;
  password: string;
}
type FieldErrors = Partial<Record<keyof FormData, string>>;

function validate(form: FormData): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.full_name.trim()) errors.full_name = "Tu nombre es requerido";
  if (!form.email.trim()) errors.email = "El email es requerido";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = "Email inválido";
  if (form.password.length < 8) errors.password = "Mínimo 8 caracteres";
  return errors;
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function RegistroPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm]         = useState<FormData>({ full_name: "", email: "", password: "" });
  const [errors, setErrors]     = useState<FieldErrors>({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  function update(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Revisa los campos marcados");
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { data } = await apiClient.post("/auth/register-buyer", {
        full_name: form.full_name.trim(),
        email: form.email.toLowerCase().trim(),
        password: form.password,
      });

      setTokens(data.access_token, data.refresh_token);
      const { data: me } = await apiClient.get("/auth/me");
      setUser(me);

      toast.success("¡Bienvenido/a!");
      if (me.role === "admin") router.push("/admin");
      else                     router.push("/mis-pedidos");
    } catch (err: any) {
      const raw = err.response?.data?.detail;
      const msg = Array.isArray(raw)
        ? raw[0]?.msg ?? "Datos inválidos"
        : typeof raw === "string" ? raw : "Error al crear la cuenta";
      if (msg === "Contraseña incorrecta para esa cuenta") {
        setErrors({ password: "Ya tienes cuenta con ese email. La contraseña no coincide." });
        toast.error("Contraseña incorrecta");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "var(--surface-2)" }}
    >
      {/* Top nav */}
      <nav
        className="flex items-center justify-between px-5 pb-3.5 animate-fade-in"
        style={{
          paddingTop: "max(14px, env(safe-area-inset-top))",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(226,232,240,0.6)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-semibold"
          style={{ color: "var(--ink-3)" }}
          aria-label="Volver al inicio"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <Logo size="sm" />
        <div className="w-16" aria-hidden />
      </nav>

      {/* Header */}
      <div className="px-5 pt-8 pb-6 text-center animate-fade-up">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-ink))",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </div>

        <h1 className="font-display font-extrabold text-2xl mb-1" style={{ color: "var(--ink)" }}>
          Crear cuenta de comprador
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          Sigue tus pedidos en todas las tiendas
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex-1 px-5 max-w-sm mx-auto w-full space-y-4 pb-10"
      >
        <div className="animate-fade-up delay-50 flex gap-2">
          <div className="flex-1"><GoogleLoginButton label="Google" mode="buyer" /></div>
          <div className="flex-1"><FacebookLoginButton label="Facebook" mode="buyer" /></div>
        </div>

        <div className="or-divider animate-fade-up delay-75">
          o regístrate con email
        </div>

        {/* Full name */}
        <div className="animate-fade-up delay-100">
          <label htmlFor="full_name" className="field-label">Nombre completo</label>
          <input
            id="full_name"
            className={`input ${errors.full_name ? "input-error" : ""}`}
            placeholder="Juan García"
            autoComplete="name"
            value={form.full_name}
            onChange={update("full_name")}
          />
          {errors.full_name && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--danger)" }}>
              {errors.full_name}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="animate-fade-up delay-150">
          <label htmlFor="reg-email" className="field-label">Email</label>
          <input
            id="reg-email"
            className={`input ${errors.email ? "input-error" : ""}`}
            type="email"
            placeholder="juan@ejemplo.com"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={update("email")}
          />
          {errors.email && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--danger)" }}>
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="animate-fade-up delay-200">
          <label htmlFor="reg-password" className="field-label">Contraseña</label>
          <div className="relative">
            <input
              id="reg-password"
              className={`input pr-12 ${errors.password ? "input-error" : ""}`}
              type={showPass ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
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
          {errors.password && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--danger)" }}>
              {errors.password}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2 animate-fade-up delay-250">
          <button type="submit" disabled={loading} className="btn-primary"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-ink))",
              boxShadow: "0 4px 16px var(--accent-ink)40",
            }}>
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Creando cuenta...
              </span>
            ) : (
              <>Crear cuenta gratis <ArrowRight size={17} /></>
            )}
          </button>
        </div>

        <p className="text-center text-sm animate-fade-up delay-300" style={{ color: "var(--ink-3)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="font-bold transition-colors" style={{ color: "var(--accent-ink)" }}>
            Iniciar sesión
          </Link>
        </p>

        <p className="text-center text-sm animate-fade-up delay-300" style={{ color: "var(--ink-3)" }}>
          ¿Eres vendedor?{" "}
          <Link href="/auth/register" className="font-bold transition-colors" style={{ color: "var(--brand-600)" }}>
            Crear tienda
          </Link>
        </p>

        <p className="text-center text-xs px-4 animate-fade-up delay-400" style={{ color: "var(--ink-4)" }}>
          Al registrarte aceptas nuestros{" "}
          <Link href="/terminos" className="font-semibold underline" style={{ color: "var(--ink-3)" }}>
            Términos de uso
          </Link>
          {" "}y{" "}
          <Link href="/privacidad" className="font-semibold underline" style={{ color: "var(--ink-3)" }}>
            Política de privacidad
          </Link>.
        </p>
      </form>
    </div>
  );
}
