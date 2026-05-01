"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Store, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = "Nombre requerido";
    if (!form.email.trim()) e.email = "Email requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    if (form.password.length < 8) e.password = "Mínimo 8 caracteres";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
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

      // Fetch user profile
      const { data: me } = await apiClient.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setUser(me);

      toast.success("¡Bienvenido a qtienda!");
      router.push("/dashboard");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === "Email ya registrado") {
        setErrors({ email: "Este email ya tiene cuenta" });
      } else {
        toast.error(detail || "Error al registrarse");
      }
    } finally {
      setLoading(false);
    }
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [key]: e.target.value }),
    };
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white mb-4">
          <Store size={26} />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Crea tu tienda</h1>
        <p className="text-gray-500 text-sm mt-1">Gratis. Sin tarjeta. En 2 minutos.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-5 space-y-4 max-w-sm mx-auto w-full">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Nombre completo
          </label>
          <input className="input" placeholder="Juan García" autoComplete="name" {...field("full_name")} />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Email
          </label>
          <input
            className="input"
            type="email"
            placeholder="juan@ejemplo.com"
            autoComplete="email"
            {...field("email")}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              className="input pr-11"
              type={showPass ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              {...field("password")}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            WhatsApp <span className="text-gray-400 font-normal normal-case">(opcional)</span>
          </label>
          <input
            className="input"
            type="tel"
            placeholder="987 654 321"
            autoComplete="tel"
            {...field("phone")}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2 bg-brand-600">
          {loading ? "Creando cuenta..." : (
            <>Crear cuenta gratis <ArrowRight size={16} /></>
          )}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="text-brand-600 font-semibold">
            Iniciar sesión
          </Link>
        </p>
      </form>

      <p className="text-center text-xs text-gray-400 px-5 pb-8 mt-6">
        Al registrarte aceptas nuestros Términos de uso y Política de privacidad.
      </p>
    </div>
  );
}
