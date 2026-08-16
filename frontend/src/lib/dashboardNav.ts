// Navegación del panel de vendedor, compartida entre el sidebar de
// escritorio (dashboard/layout.tsx) y la pantalla "Más" de mobile
// (dashboard/mas/page.tsx) — una sola fuente para que no diverjan.

import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Settings,
  Bike,
  BarChart2,
  Tag,
  ClipboardList,
  Sparkles,
  CalendarClock,
  CalendarCheck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null, // primer grupo, sin encabezado — es lo más obvio
    items: [
      { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/pedidos", label: "Pedidos", icon: ShoppingBag, exact: false },
      { href: "/dashboard/productos", label: "Productos", icon: Package, exact: false },
      { href: "/dashboard/finanzas", label: "Finanzas", icon: BarChart2, exact: false },
    ],
  },
  {
    label: "Servicios con cita",
    items: [
      { href: "/dashboard/servicios", label: "Servicios", icon: CalendarClock, exact: false },
      { href: "/dashboard/citas", label: "Citas", icon: CalendarCheck, exact: false },
    ],
  },
  {
    label: "Crecimiento",
    items: [
      { href: "/dashboard/cupones", label: "Cupones", icon: Tag, exact: false },
      { href: "/dashboard/ruleta", label: "Ruleta", icon: Sparkles, exact: false },
    ],
  },
  {
    label: "Operación",
    items: [
      { href: "/dashboard/delivery", label: "Delivery", icon: Bike, exact: false },
      { href: "/dashboard/reclamos", label: "Reclamos", icon: ClipboardList, exact: false },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/dashboard/configuracion", label: "Ajustes", icon: Settings, exact: false },
      { href: "/dashboard/planes", label: "Planes", icon: CreditCard, exact: false },
    ],
  },
];

/* Vendedores que solo venden productos no necesitan ver Servicios/Citas —
   para el resto (servicios, ambos, sin especificar) se muestra todo igual
   que antes de introducir personalización. */
export function getVisibleGroups(sells: string | null | undefined): NavGroup[] {
  if (sells === "productos") {
    return NAV_GROUPS.filter((g) => g.label !== "Servicios con cita");
  }
  return NAV_GROUPS;
}

export function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function getInitials(name?: string | null) {
  return (name ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
