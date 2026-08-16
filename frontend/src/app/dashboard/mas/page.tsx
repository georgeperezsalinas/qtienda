"use client";

// Pantalla "Más" — reemplaza el drawer chico que antes dumpeaba 9 items
// sueltos bajo el nombre confuso "Cuenta". Solo se enlaza desde la bottom
// nav / top bar mobile (dashboard/layout.tsx); en desktop ya existe el
// sidebar completo, por eso el contenido va dentro de un wrapper md:hidden.

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ShoppingCart,
  LogOut,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { getVisibleGroups, isActive, getInitials } from "@/lib/dashboardNav";

export default function MasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [sells, setSells] = useState<string | null>(null);
  const [citasHoy, setCitasHoy] = useState<number | null>(null);
  const [reclamosAbiertos, setReclamosAbiertos] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get("/stores/me")
      .then(({ data }) => {
        setStoreSlug(data.slug);
        setSells(data.sells ?? null);
      })
      .catch(() => {});
    apiClient
      .get("/services/appointments", { params: { today: true } })
      .then(({ data }) => setCitasHoy(Array.isArray(data) ? data.length : null))
      .catch(() => {});
    apiClient
      .get("/claims/")
      .then(({ data }) => {
        const open = Array.isArray(data) ? data.filter((c: any) => c.status === "open").length : null;
        setReclamosAbiertos(open);
      })
      .catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    router.push("/");
  }

  const initials = getInitials(user?.full_name);
  const badges: Record<string, number | null> = {
    "/dashboard/citas": citasHoy,
    "/dashboard/reclamos": reclamosAbiertos,
  };

  return (
    <div className="md:hidden" style={{ minHeight: "100dvh", background: "var(--bg)", paddingBottom: 40 }}>
      <div
        className="flex items-center gap-3 sticky top-0 z-10"
        style={{
          background: "var(--surface)",
          padding: "12px 20px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, background: "var(--surface-2)" }}
          aria-label="Volver"
        >
          <ArrowLeft size={16} strokeWidth={1.8} style={{ color: "var(--ink-2)" }} />
        </button>
        <h1 className="font-display font-extrabold text-base" style={{ color: "var(--ink)" }}>
          Más
        </h1>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        {/* User block */}
        <div
          className="card flex items-center gap-3 p-3 mb-5"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 44, height: 44, background: "var(--ink)", color: "var(--bg)", fontSize: 14, fontWeight: 500 }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
              {user?.full_name}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--ink-3)" }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Grupos de navegación, agrupados igual que el sidebar de escritorio */}
        {getVisibleGroups(sells).map((group, gi) => (
          <div key={group.label ?? gi} className={gi > 0 ? "mt-4" : ""}>
            {group.label && (
              <p
                className="text-[10px] font-bold uppercase tracking-wide px-1 mb-1.5"
                style={{ color: "var(--ink-4)" }}
              >
                {group.label}
              </p>
            )}
            <div className="card overflow-hidden">
              {group.items.map(({ href, label, icon: Icon, exact }, ii) => {
                const badge = badges[href];
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-3.5 py-3.5"
                    style={{
                      color: "var(--ink-2)",
                      borderTop: ii > 0 ? "1px solid var(--line)" : "none",
                      background: isActive(pathname, href, exact) ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <Icon size={18} strokeWidth={1.7} style={{ color: "var(--ink-3)" }} />
                    <span className="text-sm font-medium" style={{ flex: 1 }}>{label}</span>
                    {!!badge && (
                      <span className="badge badge-accent">{badge}</span>
                    )}
                    <ChevronRight size={15} style={{ color: "var(--ink-4)" }} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bloque final — igual que el "user block" del sidebar de escritorio */}
        <div className="mt-4 card overflow-hidden">
          <Link
            href="/mis-pedidos"
            className="flex items-center gap-3 px-3.5 py-3.5"
            style={{ color: "var(--ink-2)" }}
          >
            <ShoppingCart size={18} strokeWidth={1.7} style={{ color: "var(--ink-3)" }} />
            <span className="text-sm font-medium" style={{ flex: 1 }}>Mis compras</span>
            <ChevronRight size={15} style={{ color: "var(--ink-4)" }} />
          </Link>
          <a
            href={storeSlug ? `https://${storeSlug}.qtienda.shop/` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3.5 py-3.5"
            style={{ color: "var(--ink-2)", borderTop: "1px solid var(--line)" }}
          >
            <ExternalLink size={18} strokeWidth={1.7} style={{ color: "var(--ink-3)" }} />
            <span className="text-sm font-medium" style={{ flex: 1 }}>Ver mi tienda</span>
            <ChevronRight size={15} style={{ color: "var(--ink-4)" }} />
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3.5 py-3.5 rounded-xl text-sm font-medium mt-4"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <LogOut size={17} strokeWidth={1.7} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
