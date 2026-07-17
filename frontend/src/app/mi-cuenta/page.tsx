"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, LogOut,
  Check, ChevronRight, Shield, Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

/* ── Helpers ── */
function getInitials(name: string, email: string): string {
  if (name) {
    return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }
  return email[0].toUpperCase();
}

/* ── Read-only field ── */
function ReadField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5"
      style={{ borderBottom: "1px solid #F8FAFC" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "#F1F5F9" }}
      >
        <Icon size={16} style={{ color: "var(--ink-3)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
          {label}
        </p>
        <p className="text-sm font-medium truncate mt-0.5" style={{ color: "var(--ink-2)" }}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   PAGE
════════════════════════════════ */
export default function MiCuentaPage() {
  const router = useRouter();
  const { user, accessToken, setUser, logout } = useAuthStore();
  const isLoggedIn = !!accessToken;

  const [fullName, setFullName] = useState("");
  const [phone,    setPhone]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const loggingOut = useRef(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    // El guard no debe pisar la redirección a "/" cuando el logout es voluntario
    if (hydrated && !isLoggedIn && !loggingOut.current) {
      router.replace("/auth/login");
    }
  }, [hydrated, isLoggedIn, router]);

  /* Load latest profile from API */
  useEffect(() => {
    if (!isLoggedIn) return;
    apiClient.get("/auth/me").then(({ data }) => {
      setUser(data);
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
    }).catch(() => {
      /* fallback to stored data */
      if (user) {
        setFullName(user.full_name ?? "");
        setPhone(user.phone ?? "");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  /* Track changes */
  useEffect(() => {
    if (!user) return;
    const changed =
      fullName.trim() !== (user.full_name ?? "") ||
      phone.trim()    !== (user.phone    ?? "");
    setDirty(changed);
  }, [fullName, phone, user]);

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    setSaving(true);
    try {
      const { data } = await apiClient.patch("/auth/me", {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      setUser(data);
      setDirty(false);
      toast.success("Perfil actualizado");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    loggingOut.current = true;
    logout();
    // Al salir se vuelve a la página principal, no al login
    router.push("/");
  }

  if (!hydrated || !isLoggedIn || !user) return null;

  const initials  = getInitials(user.full_name, user.email);
  const firstName = user.full_name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid #F1F5F9",
          boxShadow: "0 1px 12px rgba(15,23,42,.05)",
        }}
      >
        <div
          className="flex items-center gap-3 px-4 pb-3 max-w-lg mx-auto w-full"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <Link
            href="/mis-pedidos"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--surface-1)", border: "1px solid #E2E8F0" }}
          >
            <ArrowLeft size={16} style={{ color: "var(--ink-3)" }} />
          </Link>
          <h1 className="font-display font-extrabold text-base flex-1" style={{ color: "var(--ink)" }}>
            Mi perfil
          </h1>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-all"
              style={{ background: "var(--brand-600)", color: "#fff" }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {/* Avatar hero */}
        <div className="flex flex-col items-center py-6">
          <div
            className="w-24 h-24 rounded-[28px] flex items-center justify-center font-display font-extrabold text-4xl text-white mb-3"
            style={{
              background: "linear-gradient(135deg, var(--brand-600), #7C3AED)",
              boxShadow: "0 8px 24px rgba(37,99,235,.3)",
            }}
          >
            {initials}
          </div>
          <p className="font-display font-extrabold text-lg" style={{ color: "var(--ink)" }}>
            {firstName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
            {user.email}
          </p>
          {user.is_verified && (
            <span
              className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#D1FAE5", color: "#065F46" }}
            >
              <Check size={11} />
              Verificado
            </span>
          )}
        </div>

        {/* ── Personal data (editable) ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-0)",
            boxShadow: "0 1px 8px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.04)",
          }}
        >
          {/* Section header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ borderBottom: "1px solid #F1F5F9" }}
          >
            <Pencil size={14} style={{ color: "var(--brand-600)" }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
              Datos personales
            </span>
          </div>

          {/* Nombre */}
          <div className="px-4 py-3.5" style={{ borderBottom: "1px solid #F8FAFC" }}>
            <label className="field-label flex items-center gap-1.5 mb-1.5">
              <User size={12} style={{ color: "var(--ink-4)" }} />
              Nombre completo
            </label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="name"
            />
          </div>

          {/* Teléfono */}
          <div className="px-4 py-3.5">
            <label className="field-label flex items-center gap-1.5 mb-1.5">
              <Phone size={12} style={{ color: "var(--ink-4)" }} />
              Teléfono
            </label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 987654321"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
        </div>

        {/* ── Email (readonly) ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-0)",
            boxShadow: "0 1px 8px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.04)",
          }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ borderBottom: "1px solid #F1F5F9" }}
          >
            <Shield size={14} style={{ color: "var(--ink-4)" }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
              Cuenta
            </span>
          </div>
          <ReadField icon={Mail} label="Correo electrónico" value={user.email} />
          <div
            className="flex items-center gap-3.5 px-4 py-3.5"
            style={{ borderBottom: "1px solid #F8FAFC" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#F1F5F9" }}
            >
              <Shield size={16} style={{ color: "var(--ink-3)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
                Contraseña
              </p>
              <p className="text-sm font-medium mt-0.5" style={{ color: "var(--ink-3)" }}>
                ••••••••
              </p>
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--ink-4)" }}>
              Próximamente
            </span>
          </div>
        </div>

        {/* ── Save button (also shown here for convenience) ── */}
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? "Guardando…" : (
              <>
                <Check size={16} />
                Guardar cambios
              </>
            )}
          </button>
        )}

        {/* ── My orders shortcut ── */}
        <Link
          href="/mis-pedidos"
          className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all active:scale-[.98]"
          style={{
            background: "var(--surface-0)",
            boxShadow: "0 1px 8px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.04)",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand-50)" }}
          >
            <User size={16} style={{ color: "var(--brand-600)" }} />
          </div>
          <span className="flex-1 text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Mis pedidos
          </span>
          <ChevronRight size={16} style={{ color: "var(--ink-4)" }} />
        </Link>

        {/* ── Logout ── */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-colors"
          style={{
            background: "#FEF2F2",
            border: "1.5px solid #FECACA",
            color: "var(--danger)",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#FEE2E2" }}
          >
            <LogOut size={16} style={{ color: "var(--danger)" }} />
          </div>
          <span className="flex-1 text-sm font-semibold text-left">
            Cerrar sesión
          </span>
        </button>

        <div style={{ height: "max(20px, env(safe-area-inset-bottom))" }} />
      </main>
    </div>
  );
}
