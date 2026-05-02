"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ShoppingBag, Package,
  Settings, LogOut, ExternalLink,
  ChevronRight, X, UserCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

/* ── Nav items ── */
const NAV = [
  { href: "/dashboard",               label: "Inicio",    icon: LayoutDashboard, exact: true  },
  { href: "/dashboard/pedidos",        label: "Pedidos",   icon: ShoppingBag,     exact: false },
  { href: "/dashboard/productos",      label: "Productos", icon: Package,         exact: false },
  { href: "/dashboard/configuracion",  label: "Config.",   icon: Settings,        exact: false },
];

/* ── Helpers ── */
function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

/* ── User avatar initials ── */
function getInitials(name?: string) {
  return (name ?? "U")
    .split(" ").slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();
}

/* ════════════════════════════════════════
   LAYOUT
════════════════════════════════════════ */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuthStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated,   setHydrated]   = useState(false);

  /* Esperar a que Zustand rehidrate desde localStorage antes de verificar auth */
  useEffect(() => { setHydrated(true); }, []);

  /* Redirigir si no autenticado — solo después de hidratación */
  useEffect(() => {
    if (hydrated && !accessToken) router.replace("/auth/login");
  }, [hydrated, accessToken, router]);

  /* Close drawer on route change */
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  if (!hydrated || !accessToken) return null;

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  const initials  = getInitials(user?.full_name);
  const firstName = user?.full_name?.split(" ")[0] ?? "vendedor";

  return (
    <div
      className="min-h-dvh md:flex"
      style={{ background: "var(--surface-2)" }}
    >

      {/* ══════════════════════════════
          DESKTOP SIDEBAR
      ══════════════════════════════ */}
      <aside
        className="hidden md:flex flex-col sticky top-0 h-screen"
        style={{
          width: 232,
          background: "var(--surface-0)",
          borderRight: "1px solid #F1F5F9",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <span
            className="font-display font-extrabold text-xl"
            style={{ color: "var(--brand-600)" }}
          >
            q<span style={{ color: "var(--ink)" }}>tienda</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                           font-semibold transition-all"
                style={{
                  background: active ? "var(--brand-50)" : "transparent",
                  color:      active ? "var(--brand-700)" : "var(--ink-2)",
                  borderLeft: active
                    ? "3px solid var(--brand-600)"
                    : "3px solid transparent",
                }}
              >
                <Icon size={18} />
                {label}
                {active && (
                  <ChevronRight
                    size={14}
                    className="ml-auto"
                    style={{ color: "var(--brand-400)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Store link */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid #F1F5F9" }}>
          <a
            href="/tienda/mi-tienda"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm
                       font-semibold transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            <ExternalLink size={16} />
            Ver mi tienda
          </a>
        </div>

        {/* User info + logout */}
        <div className="px-3 pb-5" style={{ borderTop: "1px solid #F1F5F9" }}>
          <div className="flex items-center gap-3 px-3 py-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center
                         font-display font-bold text-xs text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--brand-600), #7C3AED)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-bold truncate"
                style={{ color: "var(--ink)" }}
              >
                {user?.full_name}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--ink-3)" }}>
                {user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl
                       text-sm font-semibold transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════
          MAIN CONTENT
      ══════════════════════════════ */}
      <main
        className="flex-1 min-w-0 pb-20 md:pb-0"
        style={{ minHeight: "100dvh" }}
      >
        {children}
      </main>

      {/* ══════════════════════════════
          MOBILE BOTTOM NAV
      ══════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 pb-safe z-40"
        style={{
          background:  "var(--surface-0)",
          borderTop:   "1px solid #F1F5F9",
          boxShadow:   "0 -4px 16px rgba(15,23,42,.06)",
        }}
      >
        <div className="flex">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-0.5 pt-3 pb-2
                           text-[10px] font-bold transition-colors"
                style={{ color: active ? "var(--brand-600)" : "var(--ink-3)" }}
              >
                <div
                  className="flex items-center justify-center w-10 h-7 rounded-xl
                             transition-all"
                  style={{
                    background: active ? "var(--brand-50)" : "transparent",
                  }}
                >
                  <Icon size={20} />
                </div>
                {label}
                {active && (
                  <span
                    className="w-1 h-1 rounded-full mt-0.5"
                    style={{ background: "var(--brand-600)" }}
                  />
                )}
              </Link>
            );
          })}

          {/* Botón de cuenta / cerrar sesión */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 pt-3 pb-2
                       text-[10px] font-bold transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            <div className="flex items-center justify-center w-10 h-7 rounded-xl">
              <UserCircle size={20} />
            </div>
            Cuenta
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════
          MOBILE DRAWER (hamburger)
          — Optional, for overflow items
      ══════════════════════════════ */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />

          {/* Drawer panel */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl
                       animate-scale-in"
            style={{
              background: "var(--surface-0)",
              padding: "20px 20px 40px",
              boxShadow: "0 -8px 40px rgba(15,23,42,.16)",
            }}
          >
            {/* Handle */}
            <div
              className="w-10 h-1 rounded-full mx-auto mb-5"
              style={{ background: "var(--ink-4)" }}
            />

            {/* User block */}
            <div className="flex items-center gap-3 mb-5 px-1">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center
                           font-display font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--brand-600), #7C3AED)" }}
              >
                {initials}
              </div>
              <div>
                <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                  {user?.full_name}
                </p>
                <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3.5 rounded-2xl
                         text-sm font-semibold transition-colors"
              style={{
                background: "#FEE2E2",
                color: "var(--danger)",
              }}
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
