"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Store, ShoppingBag, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const GoogleLoginButton = dynamic(() => import("@/components/ui/GoogleLoginButton"), { ssr: false });
const FacebookLoginButton = dynamic(() => import("@/components/ui/FacebookLoginButton"), { ssr: false });

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setUser } = useAuthStore();

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [emailErr,   setEmailErr]   = useState("");
  const [passErr,    setPassErr]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailOk = /\S+@\S+\.\S+/.test(email);
    setEmailErr(email ? (emailOk ? "" : "Ingresa un email válido") : "Ingresa tu email");
    setPassErr(password ? "" : "Ingresa tu contraseña");
    if (!email || !password || !emailOk) return;
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
      // Si venía de un link con "?next=" (ej. "Cuenta" desde una tienda),
      // vuelve ahí en vez del destino genérico por rol — solo se acepta una
      // ruta interna (empieza con "/", nunca "//" que sería otro host).
      const next = searchParams.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) router.push(next);
      else if (me.role === "admin")          router.push("/admin");
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
    <div
      className="min-h-dvh flex flex-col lg:flex-row"
      data-theme="panel-calido"
      style={{
        // Fondo cálido: brillo terracota que baja hacia el tono neutro
        background:
          "radial-gradient(ellipse 90% 45% at 50% 0%, var(--accent-soft) 0%, var(--surface-2) 60%)",
        color: "var(--ink)",
      }}
    >
      {/* Franja de marca */}
      <div
        aria-hidden
        className="h-1 w-full lg:hidden"
        style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-soft))" }}
      />

      {/* ── Panel izquierdo (solo desktop) ── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-10 flex-shrink-0 relative overflow-hidden"
        style={{
          // Colores fijos a propósito — panel de marca siempre oscuro,
          // el texto blanco de adentro no se invierte con el tema.
          background: "linear-gradient(160deg, #24160D 0%, #8A3F1F 100%)",
        }}
      >
        {/* Grid decorativo */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
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
              "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(197,97,59,.35) 0%, transparent 70%)",
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
                <CheckCircle2 size={17} style={{ color: "#F4E5D8", flexShrink: 0 }} />
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,.75)" }}>{f}</span>
              </li>
            ))}
          </ul>

          {/* Vitrina de ejemplo — misma tienda demo de la página principal
              (emoji + precio + descuento), no cuadros en blanco */}
          <div className="rounded-2xl p-4 mt-2" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Torta de chocolate", emoji: "🎂", bg: "#FBE7D6", price: 35, was: 50 },
                { name: "Brownie x6", emoji: "🍫", bg: "#E7DCEF", price: 16, was: 20 },
                { name: "Cupcake decorado", emoji: "🧁", bg: "#FDE8EE", price: 10, was: 15 },
                { name: "Kit de alfajores", emoji: "🍪", bg: "#EFE6D8", price: 22, was: 28 },
              ].map((p) => (
                <div key={p.name} className="rounded-lg p-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,.94)" }}>
                  <div
                    className="rounded flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, background: p.bg, fontSize: 16 }}
                  >
                    {p.emoji}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {/* Colores fijos: la tarjetita es blanca fija (no
                        reactiva al tema), el texto tampoco debe serlo */}
                    <p className="text-[10px] font-semibold truncate" style={{ color: "#24160D" }}>{p.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="mono font-bold" style={{ fontSize: 11, color: "#24160D" }}>S/ {p.price}</span>
                      <span className="mono" style={{ fontSize: 9, color: "#B3987A", textDecoration: "line-through" }}>S/ {p.was}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,.6)" }}>
              Así se ve tu vitrina — lista en 2 minutos
            </p>
          </div>
        </div>

        <p className="relative text-xs" style={{ color: "rgba(255,255,255,.35)" }}>© 2026 qtienda.shop</p>
      </div>

      {/* ── Panel derecho (formulario) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative">

        {/* Volver a la página principal */}
        <Link
          href="/"
          className="absolute top-5 left-5 flex items-center gap-1 text-sm font-semibold transition-colors"
          style={{ color: "var(--accent)" }}
          aria-label="Volver al inicio"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <div className="absolute top-5 right-5">
          <ThemeToggle />
        </div>

        {/* Logo mobile */}
        <div className="lg:hidden mb-6">
          <Logo size="lg" variant="brand" />
        </div>

        <div
          className="w-full max-w-md rounded-3xl p-8"
          style={{
            background: "var(--surface)",
            border: "1.5px solid var(--line-2)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="mb-7">
            <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
              ¡Hola de nuevo! 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
              Qué bueno verte por aquí. Entra a tu cuenta.
            </p>
          </div>

          <div className="flex gap-2" style={loading ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
            <div className="flex-1"><GoogleLoginButton label="Google" /></div>
            <div className="flex-1"><FacebookLoginButton label="Facebook" /></div>
          </div>

          <div className="or-divider my-5">o con tu email</div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email" className={"input" + (emailErr ? " input-error" : "")} type="email" inputMode="email"
                placeholder="tu@email.com" autoComplete="email"
                value={email} onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }}
                aria-invalid={!!emailErr} aria-describedby={emailErr ? "email-err" : undefined}
              />
              {emailErr && <p id="email-err" className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>{emailErr}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label mb-0" htmlFor="password">Contraseña</label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-semibold transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  ¿La olvidaste?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password" className={"input pr-12" + (passErr ? " input-error" : "")}
                  type={showPass ? "text" : "password"}
                  placeholder="Tu contraseña" autoComplete="current-password"
                  value={password} onChange={(e) => { setPassword(e.target.value); if (passErr) setPassErr(""); }}
                  aria-invalid={!!passErr} aria-describedby={passErr ? "pass-err" : undefined}
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
              {passErr && <p id="pass-err" className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>{passErr}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary !mt-6"
              style={{
                background: "var(--accent)",
                boxShadow: "0 6px 18px rgba(197,97,59,.35)",
              }}
            >
              {loading ? <><Spinner /> Ingresando...</> : <>Entrar <ArrowRight size={16} /></>}
            </button>
          </form>

          {/* Registro por rol */}
          <div
            className="mt-7 pt-6 grid grid-cols-2 gap-3"
            style={{ borderTop: "1.5px solid var(--line)" }}
          >
            <Link
              href="/auth/register"
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl text-center transition-all active:scale-95 hover:shadow-md"
              style={{
                background: "var(--tint)",
                border: "1.5px solid var(--line-2)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--ink)" }}
              >
                <Store size={17} color="var(--bg)" />
              </div>
              <div>
                <p className="font-display font-bold text-xs" style={{ color: "var(--ink)" }}>
                  Crear tienda
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                  Soy vendedor
                </p>
              </div>
            </Link>

            <Link
              href="/registro"
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl text-center transition-all active:scale-95 hover:shadow-md"
              style={{ background: "var(--accent-soft)", border: "1.5px solid var(--line-2)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent)" }}
              >
                <ShoppingBag size={17} color="white" />
              </div>
              <div>
                <p className="font-display font-bold text-xs" style={{ color: "var(--accent-ink)" }}>
                  Crear cuenta
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--accent-ink)" }}>
                  Soy comprador
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Solo acceso a consulta — el consentimiento ya se dio al registrarse,
            no hace falta volver a "aceptar" en cada login */}
        <p className="text-[11px] mt-5" style={{ color: "var(--ink-4)" }}>
          <Link href="/terminos" className="hover:underline">Términos de uso</Link>
          {" · "}
          <Link href="/privacidad" className="hover:underline">Política de privacidad</Link>
        </p>

        {/* Crédito QSD Soft */}
        <a
          href="https://qsdsoft.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-6 opacity-70 hover:opacity-100 transition-opacity"
        >
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            Un producto de
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_qsd_soft.png" alt="QSD Soft" style={{ height: 20, width: "auto" }} />
        </a>
      </div>
    </div>
  );
}

// useSearchParams() exige un límite de Suspense para el prerender de Next
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
