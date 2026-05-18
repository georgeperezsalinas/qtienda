"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import PhoneInput from "@/components/ui/PhoneInput";
import { Eye, EyeOff, ChevronLeft, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { track } from "@vercel/analytics";

const GoogleLoginButton = dynamic(
  () => import("@/components/ui/GoogleLoginButton"),
  { ssr: false }
);

interface FormData {
  full_name: string;
  email: string;
  password: string;
  phone: string;
}
type FieldErrors = Partial<Record<keyof FormData, string>>;

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const map = [
    { label: "Muy débil", color: "#EF4444" },
    { label: "Débil", color: "#F97316" },
    { label: "Regular", color: "#F59E0B" },
    { label: "Buena", color: "#10B981" },
    { label: "Excelente", color: "#059669" },
  ];
  return { score, ...map[score] };
}

function validate(form: FormData): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.full_name.trim()) errors.full_name = "Tu nombre es requerido";
  if (!form.email.trim()) errors.email = "El email es requerido";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Email inválido";
  if (form.password.length < 8) errors.password = "Mínimo 8 caracteres";
  if (form.phone && !/^\+?[\d\s\-()]{7,15}$/.test(form.phone))
    errors.phone = "Número inválido";
  return errors;
}

function ResendButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");

  async function resend() {
    setState("loading");
    try {
      await apiClient.post("/auth/resend-verification");
      setState("sent");
      toast.success(`Correo reenviado a ${email}`);
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? "Error al reenviar";
      toast.error(detail);
      setState("idle");
    }
  }

  return (
    <p className="text-xs text-slate-400 mt-4">
      ¿No llegó el correo? Revisa spam o{" "}
      <button
        onClick={resend}
        disabled={state !== "idle"}
        className="text-blue-600 font-semibold underline disabled:opacity-60 inline-flex items-center gap-1"
      >
        {state === "loading" && <RefreshCw size={11} className="animate-spin" />}
        {state === "sent" ? "¡Enviado!" : "reenviar ahora"}
      </button>
    </p>
  );
}

const STEPS = ["Cuenta", "Acceso", "Listo"];

function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm] = useState<FormData>({ full_name: "", email: "", password: "", phone: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyScreen, setVerifyScreen] = useState(false);

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  function update(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };
  }

  const currentStep = useMemo(() => {
    if (!form.full_name && !form.email) return 0;
    if (!form.password) return 1;
    return 2;
  }, [form.full_name, form.email, form.password]);

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
      const { data } = await apiClient.post("/auth/register", {
        full_name: form.full_name.trim(),
        email: form.email.toLowerCase().trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });

      setTokens(data.access_token, data.refresh_token);
      const { data: me } = await apiClient.get("/auth/me");
      setUser(me);
      track("seller_registered", {
        has_phone: !!form.phone.trim(),
      });
      setVerifyScreen(true);

    } catch (err: any) {
      const raw = err.response?.data?.detail;
      const detail = Array.isArray(raw)
        ? raw[0]?.msg ?? "Datos inválidos"
        : typeof raw === "string" ? raw : "Error al crear la cuenta";
      if (detail === "Email ya registrado") {
        setErrors({ email: "Este email ya tiene una cuenta" });
        toast.error("Ese email ya está registrado");
      } else {
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  }

  if (verifyScreen) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6"
        style={{ background: "var(--surface-2)" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-lg border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">📧</span>
          </div>
          <h1 className="font-display font-extrabold text-xl text-slate-900 mb-2">
            Verifica tu correo
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Te enviamos un enlace de verificación a<br />
            <strong className="text-slate-700">{form.email}</strong>
          </p>
          <p className="text-xs text-slate-400 mb-6">
            Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta y crear tu tienda.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[.98]"
            style={{ background: "var(--brand-600)" }}
          >
            Ir al dashboard
          </button>
          <ResendButton email={form.email} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: "var(--surface-2)" }}
    >
      {/* ── Top nav ── */}
      <nav
        className="flex items-center justify-between px-5 pt-safe py-3.5 animate-fade-in"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(226,232,240,0.6)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-semibold transition-colors"
          style={{ color: "var(--ink-3)" }}
          aria-label="Volver al inicio"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <Logo size="sm" />
        <div className="w-16" aria-hidden />
      </nav>

      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-5 text-center animate-fade-up">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: "linear-gradient(135deg, var(--brand-600), #7C3AED)",
            boxShadow: "0 6px 24px rgba(37,99,235,.3)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h1 className="font-display font-extrabold text-2xl mb-1" style={{ color: "var(--ink)" }}>
          Crea tu tienda
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          Gratis · Sin tarjeta · En 2 minutos
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={{
                    background: i <= currentStep ? "var(--brand-600)" : "var(--surface-0)",
                    color: i <= currentStep ? "white" : "var(--ink-3)",
                    border: i <= currentStep ? "none" : "1.5px solid #E2E8F0",
                    boxShadow: i === currentStep ? "0 2px 8px rgba(37,99,235,.3)" : "none",
                  }}
                >
                  {i < currentStep ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: i <= currentStep ? "var(--brand-600)" : "var(--ink-4)" }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-8 h-0.5 rounded-full mb-4 transition-all duration-500"
                  style={{ background: i < currentStep ? "var(--brand-600)" : "#E2E8F0" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex-1 px-5 max-w-sm mx-auto w-full space-y-4 pb-10"
      >
        <div className="animate-fade-up delay-50 mb-2">
          <GoogleLoginButton label="Registrarse con Google" />
        </div>

        <div className="or-divider mb-2 animate-fade-up delay-75">
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

          {form.password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="strength-bar flex-1 transition-colors duration-300"
                    style={{ background: n <= strength.score ? strength.color : "#E2E8F0" }}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </div>
          )}

          {errors.password && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--danger)" }}>
              {errors.password}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="animate-fade-up delay-250">
          <label htmlFor="phone" className="field-label">
            WhatsApp{" "}
            <span className="font-normal normal-case tracking-normal" style={{ color: "var(--ink-4)" }}>
              (opcional)
            </span>
          </label>
          <PhoneInput
            id="phone"
            value={form.phone}
            onChange={(v) => {
              setForm((f) => ({ ...f, phone: v }));
              if (errors.phone) setErrors((er) => ({ ...er, phone: undefined }));
            }}
            hasError={!!errors.phone}
          />
          {errors.phone && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--danger)" }}>
              {errors.phone}
            </p>
          )}
        </div>

        <div className="pt-2 animate-fade-up delay-300">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Creando tu tienda...
              </span>
            ) : (
              <>Crear cuenta gratis <ArrowRight size={17} /></>
            )}
          </button>
        </div>

        <p className="text-center text-sm animate-fade-up delay-300" style={{ color: "var(--ink-3)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="font-bold transition-colors" style={{ color: "var(--brand-600)" }}>
            Iniciar sesión
          </Link>
        </p>

        <p className="text-center text-xs px-4 animate-fade-up delay-400" style={{ color: "var(--ink-4)" }}>
          Al registrarte aceptas nuestros{" "}
          <span style={{ color: "var(--ink-3)" }}>Términos de uso</span>
          {" "}y{" "}
          <span style={{ color: "var(--ink-3)" }}>Política de privacidad</span>.
        </p>
      </form>
    </div>
  );
}
