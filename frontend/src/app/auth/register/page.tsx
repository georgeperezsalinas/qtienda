"use client";

import { useState, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
const FacebookLoginButton = dynamic(
  () => import("@/components/ui/FacebookLoginButton"),
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
    <p className="text-xs mt-4" style={{ color: "var(--ink-4)" }}>
      ¿No llegó el correo? Revisa spam o{" "}
      <button
        onClick={resend}
        disabled={state !== "idle"}
        className="font-semibold underline disabled:opacity-60 inline-flex items-center gap-1"
        style={{ color: "var(--ink)" }}
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

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = (searchParams.get("ref") ?? "").trim().toUpperCase();
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
        referral_code: referralCode || undefined,
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
        <div className="w-full max-w-sm rounded-3xl p-8 text-center" style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "var(--accent-soft)" }}>
            <span className="text-3xl">📧</span>
          </div>
          <h1 className="font-display font-extrabold text-xl mb-2" style={{ color: "var(--ink)" }}>
            Verifica tu correo
          </h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--ink-3)" }}>
            Te enviamos un enlace de verificación a<br />
            <strong style={{ color: "var(--ink-2)" }}>{form.email}</strong>
          </p>
          <p className="text-xs mb-6" style={{ color: "var(--ink-4)" }}>
            Revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta y crear tu tienda.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary w-full"
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
      style={{
        // Mismo fondo cálido del login: resplandor terracota sobre neutro
        background:
          "radial-gradient(ellipse 90% 45% at 50% 0%, var(--accent-soft) 0%, var(--surface-2) 60%)",
      }}
    >
      {/* Franja de marca */}
      <div
        aria-hidden
        className="h-1"
        style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }}
      />

      {/* ── Top nav ── */}
      <nav
        className="flex items-center justify-between px-5 pt-safe py-3.5 animate-fade-in"
        style={{
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(20,19,15,.05)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-semibold transition-colors"
          style={{ color: "var(--accent)" }}
          aria-label="Volver al inicio"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <Logo size="sm" variant="brand" />
        <div className="w-16" aria-hidden />
      </nav>

      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-5 text-center animate-fade-up">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-ink))",
            boxShadow: "0 6px 18px rgba(197,97,59,.35)",
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
        {referralCode && (
          <p
            className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2 px-3 py-1.5 rounded-full"
            style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
          >
            🎁 Un amigo te invitó · código {referralCode}
          </p>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={{
                    background: i <= currentStep ? "var(--accent)" : "var(--surface)",
                    color: i <= currentStep ? "white" : "var(--ink-3)",
                    border: i <= currentStep ? "none" : "1.5px solid var(--line-2)",
                    boxShadow: i === currentStep ? "0 2px 8px rgba(197,97,59,.35)" : "none",
                  }}
                >
                  {i < currentStep ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: i <= currentStep ? "var(--ink)" : "var(--ink-4)" }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-8 h-0.5 rounded-full mb-4 transition-all duration-500"
                  style={{ background: i < currentStep ? "var(--ink)" : "var(--line-2)" }}
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
        <div className="animate-fade-up delay-50 mb-2 flex gap-2">
          <div className="flex-1"><GoogleLoginButton label="Google" /></div>
          <div className="flex-1"><FacebookLoginButton label="Facebook" /></div>
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
                    style={{ background: n <= strength.score ? strength.color : "var(--line-2)" }}
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
          <Link href="/auth/login" className="font-bold transition-colors" style={{ color: "var(--ink)" }}>
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

// useSearchParams() exige un límite de Suspense para el prerender de Next
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
