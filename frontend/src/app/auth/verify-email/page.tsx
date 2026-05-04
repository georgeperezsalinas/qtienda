"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type State = "loading" | "success" | "error" | "expired";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { setUser }  = useAuthStore();
  const [state, setState] = useState<State>("loading");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) { setState("error"); return; }

    apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async () => {
        try {
          const { data: me } = await apiClient.get("/auth/me");
          setUser(me);
        } catch { /* no session open — still show success */ }
        setState("success");
      })
      .catch((err) => {
        const msg: string = err.response?.data?.detail ?? "";
        if (msg.includes("expiró")) {
          setState("expired");
        } else {
          setState("error");
        }
        setDetail(msg);
      });
  }, [searchParams, setUser]);

  return (
    <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-lg border border-slate-100">
      {state === "loading" && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-5">
            <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
          <p className="font-semibold text-slate-700">Verificando tu correo…</p>
        </>
      )}

      {state === "success" && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="font-display font-extrabold text-xl text-slate-900 mb-2">
            ¡Correo verificado!
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Tu cuenta está activa. Ya puedes crear tu tienda y empezar a vender.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[.98]"
            style={{ background: "var(--brand-600)" }}
          >
            Ir a mi dashboard
          </button>
        </>
      )}

      {(state === "error" || state === "expired") && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">{state === "expired" ? "⏰" : "❌"}</span>
          </div>
          <h1 className="font-display font-extrabold text-xl text-slate-900 mb-2">
            {state === "expired" ? "Enlace expirado" : "Enlace inválido"}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {state === "expired"
              ? "El enlace de verificación expiró (24 h). Inicia sesión y solicita uno nuevo desde tu dashboard."
              : "El enlace ya fue utilizado o no es válido."}
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[.98]"
            style={{ background: "var(--brand-600)" }}
          >
            Iniciar sesión
          </button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6"
         style={{ background: "var(--surface-2)" }}>
      <div className="mb-8"><Logo size="md" /></div>
      <Suspense fallback={
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-lg border border-slate-100">
          <p className="text-slate-500 text-sm">Cargando…</p>
        </div>
      }>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
