"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
        className="sticky top-0 z-10 flex items-center justify-between px-5 pt-safe py-4"
        style={{ background: "var(--surface-0)", borderBottom: "1px solid #F1F5F9" }}
      >
        <Link href="/" className="font-display font-extrabold text-lg">
          <span style={{ color: "var(--brand-600)" }}>q</span>
          <span style={{ color: "var(--ink)" }}>tienda</span>
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: "var(--surface-1)", color: "var(--ink-3)" }}
        >
          Ir a tiendas
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom nav — solo para usuarios logueados */}
      {accessToken && (
        <nav
          className="fixed bottom-0 left-0 right-0 pb-safe z-40 flex"
          style={{
            background:  "var(--surface-0)",
            borderTop:   "1px solid #F1F5F9",
            boxShadow:   "0 -4px 16px rgba(15,23,42,.06)",
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
                {active && (
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ background: "var(--brand-600)" }}
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
