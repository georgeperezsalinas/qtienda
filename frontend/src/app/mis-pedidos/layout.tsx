"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { ShoppingBag, UserCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const NAV = [
  { href: "/mis-pedidos",        label: "Pedidos", icon: ShoppingBag, exact: true  },
  { href: "/mis-pedidos/cuenta", label: "Cuenta",  icon: UserCircle,  exact: false },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export default function CompradorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accessToken } = useAuthStore();

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--surface-2)" }}>

      {/* Top bar */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-5 pb-3.5"
        style={{
          paddingTop: "max(14px, env(safe-area-inset-top))",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(241,245,249,0.8)",
          boxShadow: "0 1px 12px rgba(15,23,42,.04)",
        }}
      >
        <Logo size="sm" />
        <Link
          href="/tiendas"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{
            background: "var(--surface-1)",
            color: "var(--ink-3)",
            border: "1px solid #E2E8F0",
          }}
        >
          Descubrir tiendas
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 pb-24">{children}</main>

      {/* Bottom nav — solo para usuarios logueados */}
      {accessToken && (
        <nav
          className="fixed bottom-0 left-0 right-0 pb-safe z-40 flex"
          style={{
            background:  "rgba(255,255,255,0.92)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderTop:   "1px solid rgba(241,245,249,0.8)",
            boxShadow:   "0 -4px 24px rgba(15,23,42,.08)",
          }}
        >
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-0.5 pt-3 pb-2 text-[10px] font-bold transition-colors"
                style={{ color: active ? "#7C3AED" : "var(--ink-3)" }}
              >
                <div
                  className="flex items-center justify-center w-10 h-7 rounded-xl transition-all"
                  style={{ background: active ? "#F5F3FF" : "transparent" }}
                >
                  <Icon size={20} />
                </div>
                {label}
                {active && (
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ background: "#7C3AED" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
