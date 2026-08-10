"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Store, Users, LogOut, ChevronRight, ShieldCheck, Smartphone, ScrollText, ShoppingBag, MessageCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const NAV = [
  { href: "/admin",           label: "Dashboard",  icon: LayoutDashboard, exact: true  },
  { href: "/admin/tiendas",   label: "Tiendas",    icon: Store,            exact: false },
  { href: "/admin/pedidos",   label: "Pedidos",    icon: ShoppingBag,      exact: false },
  { href: "/admin/usuarios",  label: "Usuarios",   icon: Users,            exact: false },
  { href: "/admin/pagos",     label: "Pagos",      icon: Smartphone,       exact: false },
  { href: "/admin/campana",   label: "Campaña",    icon: MessageCircle,    exact: false },
  { href: "/admin/auditoria", label: "Auditoría",  icon: ScrollText,       exact: false },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function getInitials(name?: string) {
  return (name ?? "A").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuthStore();

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) { router.replace("/auth/login"); return; }
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [hydrated, accessToken, user, router]);

  if (!hydrated || !accessToken || user?.role !== "admin") return null;

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  const initials = getInitials(user?.full_name);

  return (
    <div className="min-h-dvh md:flex" style={{ background: "var(--surface-2)" }}>

      {/* ── SIDEBAR ── */}
      <aside
        className="hidden md:flex flex-col sticky top-0 h-screen"
        style={{
          width: 232,
          background: "var(--surface-0)",
          borderRight: "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: "var(--brand-600)" }} />
            <span className="font-display font-extrabold text-xl">
              <span style={{ color: "var(--brand-600)" }}>q</span>
              <span style={{ color: "var(--ink)" }}>admin</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  borderLeft: active ? "3px solid var(--brand-600)" : "3px solid transparent",
                }}
              >
                <Icon size={18} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto" style={{ color: "var(--brand-400)" }} />}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 pb-5" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3 px-3 py-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-xs text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--danger), var(--accent-ink))" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>
                {user?.full_name}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--ink-3)" }}>Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 min-w-0" style={{ minHeight: "100dvh" }}>

        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: "var(--surface-0)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "var(--brand-600)" }} />
            <span className="font-display font-extrabold text-base">
              <span style={{ color: "var(--brand-600)" }}>q</span>
              <span style={{ color: "var(--ink)" }}>admin</span>
            </span>
          </div>
          <button onClick={handleLogout} style={{ color: "var(--ink-3)" }}>
            <LogOut size={18} />
          </button>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 pb-safe z-40 flex"
          style={{
            background: "var(--surface-0)",
            borderTop: "1px solid var(--line)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-0.5 pt-3 pb-2 text-[10px] font-bold transition-colors"
                style={{ color: active ? "var(--brand-600)" : "var(--ink-3)" }}
              >
                <div
                  className="flex items-center justify-center w-10 h-7 rounded-xl transition-all"
                  style={{ background: active ? "var(--brand-50)" : "transparent" }}
                >
                  <Icon size={20} />
                </div>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="pb-20 md:pb-0">{children}</div>
      </main>
    </div>
  );
}
