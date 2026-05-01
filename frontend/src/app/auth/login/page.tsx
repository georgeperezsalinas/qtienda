"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Store } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

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

      router.push("/dashboard");
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) toast.error("Email o contraseña incorrectos");
      else if (status === 403) toast.error("Cuenta suspendida. Contacta soporte.");
      else toast.error("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <div className="px-5 pt-12 pb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white mb-4">
          <Store size={26} />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Bienvenido</h1>
        <p className="text-gray-500 text-sm mt-1">Entra a tu panel de vendedor</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-5 space-y-4 max-w-sm mx-auto w-full">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Email
          </label>
          <input
            className="input"
            type="email"
            placeholder="juan@ejemplo.com"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              className="input pr-11"
              type={showPass ? "text" : "password"}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full bg-brand-600">
          {loading ? "Entrando..." : "Iniciar sesión"}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{" "}
          <Link href="/auth/register" className="text-brand-600 font-semibold">
            Regístrate gratis
          </Link>
        </p>
      </form>
    </div>
  );
}
