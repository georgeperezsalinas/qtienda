"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Store, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const GoogleLoginButton = dynamic(() => import("@/components/ui/GoogleLoginButton"), { ssr: false });

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast.error("Completa todos los campos"); return; }
    setLoading(true);
    try {
      const { data } = await apiClient.post("/auth/login", {
        email: email.toLowerCase().trim(),
        password,
      });

      setTokens(data.access_token, data.refresh_token);
      const { data: me } = await apiClient.get("/auth/me");
      setUser(me);
      toast.success("¡Bienvenido!");
      if (me.role === "admin")          router.push("/admin");
      else if (me.role === "buyer")    router.push("/mis-pedidos");
      else if (me.role === "delivery") router.push("/delivery-app");
      else                             router.push("/dashboard");
    } catch (err: any) {
      const s      = err.response?.status;
      const detail = err.response?.data?.detail;
      const msg    = Array.isArray(detail)
        ? detail[0]?.msg ?? "Datos inválidos"
        : typeof detail === "string" ? detail : "Error al iniciar sesión";
      if (s === 401) toast.error("Email o contraseña incorrectos");
      else if (s === 403) toast.error(msg);
      else toast.error(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-dvh flex" style={{ background: "var(--surface-2)" }}>

      {/* ── Panel izquierdo (solo desktop) ── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-10 flex-shrink-0 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0F172A 0%, #1E3A8A 50%, #312E81 100%)" }}
      >
        {/* Grid decorativo */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(99,102,241,.25) 0%, transparent 70%)",
          }}
        />

        <div className="relative">
          <Logo size="md" variant="white" />
        </div>

        <div className="relative space-y-5">
          <h2 className="font-display font-extrabold text-3xl xl:text-4xl text-white leading-tight">
            Bienvenido de vuelta
          </h2>
          <ul className="space-y-3">
            {["Tu tienda siempre activa", "Pedidos en tiempo real", "Sin comisiones"].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <CheckCircle2 size={17} style={{ color: "#A5F3FC", flexShrink: 0 }} />
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,.75)" }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs" style={{ color: "rgba(255,255,255,.3)" }}>© 2025 qtienda.shop</p>
      </div>

      {/* ── Panel derecho (formulario) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">

        {/* Logo mobile */}
        <div className="lg:hidden mb-8">
          <Logo size="md" />
        </div>

        <div
          className="w-full max-w-md rounded-3xl p-8"
          style={{
            background: "var(--surface-0)",
            border: "1.5px solid #E2E8F0",
            boxShadow: "0 8px 48px rgba(15,23,42,.10)",
          }}
        >
          <div className="mb-7">
            <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
              Iniciar sesión
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
              Accede a tu cuenta de qtienda
            </p>
          </div>

          <GoogleLoginButton />

          <div className="or-divider my-5">o con tu email</div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email" className="input" type="email" inputMode="email"
                placeholder="tu@email.com" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label mb-0" htmlFor="password">Contraseña</label>
                <button
                  type="button"
                  className="text-xs font-semibold transition-colors"
                  style={{ color: "var(--brand-600)" }}
                >
                  ¿La olvidaste?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password" className="input pr-12"
                  type={showPass ? "text" : "password"}
                  placeholder="Tu contraseña" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--ink-3)" }}
                  aria-label="Mostrar contraseña"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary !mt-6">
              {loading ? <><Spinner /> Ingresando...</> : <>Entrar <ArrowRight size={16} /></>}
            </button>
          </form>

          {/* Registro por rol */}
          <div
            className="mt-7 pt-6 grid grid-cols-2 gap-3"
            style={{ borderTop: "1.5px solid #F1F5F9" }}
          >
            <Link
              href="/auth/register"
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl text-center transition-all active:scale-95 hover:shadow-md"
              style={{
                background: "var(--brand-50)",
                border: "1.5px solid var(--brand-100)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--brand-600)" }}
              >
                <Store size={17} color="white" />
              </div>
              <div>
                <p className="font-display font-bold text-xs" style={{ color: "var(--brand-700)" }}>
                  Crear tienda
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--brand-400)" }}>
                  Soy vendedor
                </p>
              </div>
            </Link>

            <Link
              href="/registro"
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl text-center transition-all active:scale-95 hover:shadow-md"
              style={{ background: "#F5F3FF", border: "1.5px solid #DDD6FE" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#7C3AED" }}
              >
                <ShoppingBag size={17} color="white" />
              </div>
              <div>
                <p className="font-display font-bold text-xs" style={{ color: "#5B21B6" }}>
                  Crear cuenta
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "#7C3AED" }}>
                  Soy comprador
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
