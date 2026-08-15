"use client";

// Barra de navegación inferior — patrón compartido entre el Mall (/tiendas)
// y cada tienda pública (StorePage.tsx), que antes no tenían ninguna. Solo
// mobile (md:hidden), igual que las otras dos barras del proyecto
// (dashboard de vendedor, mis-pedidos de comprador). No sabe nada de Mall
// ni de tienda: cada página arma sus propios tabs y acciones.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface BottomNavItem {
  key: string;
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
}

export default function PublicBottomNav({
  items,
  accentColor = "var(--accent)",
}: {
  items: BottomNavItem[];
  /** Color de marca de la tienda para el estado activo — el Mall usa el
   * default (var(--accent)), cada tienda pasa su propio color. */
  accentColor?: string;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 pb-safe z-40 flex"
      style={{
        background: "color-mix(in srgb, var(--surface) 94%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--line)",
        boxShadow: "0 -4px 20px rgba(20,19,15,.08)",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const color = item.active ? accentColor : "var(--ink-3)";
        const content = (
          <>
            <span className="relative flex items-center justify-center">
              <Icon size={19} strokeWidth={item.active ? 2.2 : 1.8} style={{ color }} />
              {!!item.badge && (
                <span
                  className="absolute flex items-center justify-center rounded-full text-white font-bold"
                  style={{ top: -5, right: -8, minWidth: 15, height: 15, fontSize: 9, padding: "0 3px", background: accentColor }}
                >
                  {item.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-bold mt-1" style={{ color }}>
              {item.label}
            </span>
          </>
        );
        const className = "flex-1 flex flex-col items-center justify-center pt-2.5 pb-1.5";
        return item.href ? (
          <Link key={item.key} href={item.href} className={className}>
            {content}
          </Link>
        ) : (
          <button key={item.key} onClick={item.onClick} className={className}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
