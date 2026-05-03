"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import {
  LayoutDashboard, ShoppingBag, Package,
  Settings, LogOut, ExternalLink,
  ChevronRight, UserCircle, ShoppingCart,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

/* ── Nav items ── */
const NAV = [
  { href: "/dashboard",               label: "Inicio",    icon: LayoutDashboard, exact: true  },
  { href: "/dashboard/pedidos",        label: "Pedidos",   icon: ShoppingBag,     exact: false },
  { href: "/dashboard/productos",      label: "Productos", icon: Package,         exact: false },
  { href: "/dashboard/configuracion",  label: "Config.",   icon: Settings,        exact: false },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

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

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace("/auth/login");
  }, [hydrated, accessToken, router]);

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
          width: 240,
          background: "var(--surface-0)",
          borderRight: "1px solid #F1F5F9",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <Logo size="md" />
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: active ? "var(--brand-50)" : "transparent",
                  color:      active ? "var(--brand-700)" : "var(--ink-2)",
                  borderLeft: active
                    ? "3px solid var(--brand-600)"
                    : "3px solid transparent",
                }}
              >
                <Icon size={17} />
                {label}
                {active && (
                  <ChevronRight
                    size={13}
                    className="ml-auto opacity-60"
                    style={{ color: "var(--brand-400)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Links secundarios */}
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: "1px solid #F1F5F9" }}>
          <a
            href="/tienda/mi-tienda"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-50"
            style={{ color: "var(--ink-3)" }}
          >
            <ExternalLink size={15} />
            Ver mi tienda
          </a>
          <Link
            href="/mis-pedidos"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-50"
            style={{ color: "var(--ink-3)" }}
          >
            <ShoppingCart size={15} />
            Mis compras
          </Link>
        </div>

        {/* User info + logout */}
        <div className="px-3 pb-5 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ background: "var(--surface-1)" }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center
                         font-display font-bold text-xs text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--brand-600), #7C3AED)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>
                {user?.full_name}
              </p>
              <p className="text-[11px] truncate" style={{ color: "var(--ink-3)" }}>
                {user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl
                       text-sm font-semibold transition-colors hover:bg-red-50"
            style={{ color: "var(--danger)" }}
          >
            <LogOut size={15} />
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
          background:  "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop:   "1px solid rgba(241,245,249,0.8)",
          boxShadow:   "0 -4px 24px rgba(15,23,42,.08)",
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
                  className="flex items-center justify-center w-10 h-7 rounded-xl transition-all"
                  style={{
                    background: active ? "var(--brand-50)" : "transparent",
                  }}
                >
                  <Icon size={20} />
                </div>
                {label}
                {active && (
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ background: "var(--brand-600)" }}
                  />
                )}
              </Link>
            );
          })}

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
          MOBILE DRAWER
      ══════════════════════════════ */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
            style={{ backdropFilter: "blur(4px)" }}
          />

          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px]
                       animate-scale-in"
            style={{
              background: "var(--surface-0)",
              padding: "8px 20px 40px",
              boxShadow: "0 -8px 48px rgba(15,23,42,.18)",
            }}
          >
            {/* Handle */}
            <div
              className="w-10 h-1 rounded-full mx-auto mt-3 mb-6"
              style={{ background: "var(--ink-4)" }}
            />

            {/* User block */}
            <div
              className="flex items-center gap-4 mb-6 p-4 rounded-2xl"
              style={{ background: "var(--surface-1)" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center
                           font-display font-bold text-lg text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--brand-600), #7C3AED)" }}
              >
                {initials}
              </div>
              <div>
                <p className="font-display font-bold text-sm" style={{ color: "var(--ink)" }}>
                  {user?.full_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {user?.email}
                </p>
                <span
                  className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--brand-50)", color: "var(--brand-700)" }}
                >
                  Vendedor
                </span>
              </div>
            </div>

            {/* Quick links */}
            <div className="space-y-2 mb-3">
              <Link
                href="/mis-pedidos"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-colors"
                style={{ background: "var(--surface-1)", color: "var(--ink-2)" }}
              >
                <ShoppingCart size={18} />
                Mis compras
                <ChevronRight size={15} className="ml-auto opacity-40" />
              </Link>
              <a
                href="/tienda/mi-tienda"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-colors"
                style={{ background: "var(--surface-1)", color: "var(--ink-2)" }}
              >
                <ExternalLink size={18} />
                Ver mi tienda
                <ChevronRight size={15} className="ml-auto opacity-40" />
              </a>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3.5 rounded-2xl
                         text-sm font-semibold transition-colors"
              style={{
                background: "#FEF2F2",
                color: "var(--danger)",
                border: "1.5px solid #FECACA",
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
