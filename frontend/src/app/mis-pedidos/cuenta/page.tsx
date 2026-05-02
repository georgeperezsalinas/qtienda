"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShoppingBag, Mail, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";

export default function CompradorCuentaPage() {
  const router = useRouter();
  const { user, accessToken, logout } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const [orderCount, setOrderCount] = useState<number | null>(null);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) { router.replace("/registro"); return; }
  }, [hydrated, accessToken, router]);

  useEffect(() => {
    if (!accessToken) return;
    apiClient.get("/buyer/orders")
      .then(({ data }) => setOrderCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setOrderCount(0));
  }, [accessToken]);

  function handleLogout() {
    logout();
    router.push("/");
  }

  if (!hydrated || !accessToken) return null;

  function getInitials(name?: string) {
    return (name ?? "U").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  const initials = getInitials(user?.full_name);

  return (
    <div className="px-5 pt-6 pb-10 max-w-sm mx-auto space-y-5">

      {/* Avatar + nombre */}
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--brand-600), #7C3AED)" }}
        >
          {initials}
        </div>
        <div>
          <p className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>
            {user?.full_name}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-3)" }}>
            Comprador
          </p>
        </div>
      </div>

      {/* Info */}
      <div
        className="rounded-2xl divide-y"
        style={{
          background: "var(--surface-0)",
          border: "1.5px solid #E2E8F0",
          divideColor: "#F1F5F9",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand-50)" }}
          >
            <User size={15} style={{ color: "var(--brand-600)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
              Nombre
            </p>
            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
              {user?.full_name ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#EDE9FE" }}
          >
            <Mail size={15} style={{ color: "#7C3AED" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
              Email
            </p>
            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
              {user?.email ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#D1FAE5" }}
          >
            <ShoppingBag size={15} style={{ color: "#059669" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-4)" }}>
              Pedidos realizados
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {orderCount === null ? "—" : `${orderCount} pedido${orderCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </div>

      {/* Ver pedidos */}
      <Link
        href="/mis-pedidos"
        className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all"
        style={{
          background: "var(--brand-600)",
          color: "#fff",
          boxShadow: "var(--shadow-brand)",
        }}
      >
        <ShoppingBag size={16} />
        Ver mis pedidos
      </Link>

      {/* Cerrar sesión */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all"
        style={{ background: "#FEE2E2", color: "var(--danger)" }}
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>

    </div>
  );
}
