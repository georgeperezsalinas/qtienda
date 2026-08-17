// src/app/dashboard/layout.tsx — qtienda v2
// Reemplaza completo. Mantiene la misma lógica de auth/router pero con la
// estructura visual nueva: sidebar minimalista en desktop, bottom nav de 4
// items en mobile, drawer para acciones secundarias.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Settings,
  LogOut,
  ExternalLink,
  LayoutGrid,
  BarChart2,
  ShoppingCart,
  HelpCircle,
} from "lucide-react";
import { getVisibleGroups, isActive, getInitials } from "@/lib/dashboardNav";
import { useAuthStore } from "@/store/authStore";
import DashboardTour, { restartQtiendaTour } from "@/components/onboarding/DashboardTour";
import NotificationBell from "@/components/ui/NotificationBell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useSellerPushSubscription } from "@/hooks/usePushSubscription";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

/* ─── Email verification banner ─── */
function VerifyBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await apiClient.post("/auth/resend-verification");
      toast.success("Correo reenviado");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al reenviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-xs"
      style={{
        background: "var(--warn-soft)",
        borderBottom: "1px solid var(--line-2)",
        color: "var(--warn)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span className="dot dot-warn" />
      <span className="flex-1 font-medium">
        Verifica <strong>{email}</strong> para crear tu tienda.
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="font-medium underline disabled:opacity-60"
      >
        {sending ? "Enviando…" : "Reenviar"}
      </button>
    </div>
  );
}

/* ─── Banner de tienda suspendida/baneada — apelación de reactivación ───
   No es descartable: es información crítica, el vendedor debe verla
   siempre que exista, en cualquier página del dashboard. */
function SuspendedBanner({
  status,
  reactivationRequestedAt,
  onRequested,
}: {
  status: string;
  reactivationRequestedAt: string | null;
  onRequested: (at: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!message.trim()) {
      toast.error("Explica brevemente tu solicitud");
      return;
    }
    setSending(true);
    try {
      const { data } = await apiClient.post("/stores/me/request-reactivation", { message: message.trim() });
      toast.success("Solicitud enviada — el equipo la va a revisar");
      onRequested(data.reactivation_requested_at);
      setOpen(false);
      setMessage("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "No se pudo enviar la solicitud");
    } finally {
      setSending(false);
    }
  }

  const label = status === "banned" ? "baneada" : "suspendida";

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-2.5 text-xs"
        style={{
          background: "var(--danger-soft)",
          borderBottom: "1px solid var(--line-2)",
          color: "var(--danger)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <span className="dot dot-danger flex-shrink-0" />
        <span className="flex-1 font-medium">
          Tu tienda está <strong>{label}</strong> — tu tienda pública no es visible para compradores.
          Agregar productos o cambiar la configuración no la reactiva.
          {reactivationRequestedAt && (
            <> Ya enviaste tu solicitud el {new Date(reactivationRequestedAt).toLocaleDateString("es-PE", { day: "numeric", month: "short" })} — el equipo la está revisando.</>
          )}
        </span>
        {!reactivationRequestedAt && (
          <button onClick={() => setOpen(true)} className="font-medium underline flex-shrink-0">
            Solicitar reactivación
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[90]" style={{ background: "rgba(20,19,15,.5)" }} onClick={() => !sending && setOpen(false)} />
          <div
            className="fixed z-[91] left-1/2 top-1/2 w-[90vw] max-w-sm rounded-2xl p-5"
            style={{ background: "var(--surface)", boxShadow: "var(--shadow-float)", transform: "translate(-50%,-50%)" }}
          >
            <h3 className="font-display font-extrabold text-base mb-1" style={{ color: "var(--ink)" }}>
              Solicitar reactivación
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--ink-3)" }}>
              Explica brevemente qué pasó o por qué debería reactivarse tu tienda. El equipo la revisa y te responde.
            </p>
            <textarea
              className="input text-sm"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej: No sabía que esto incumplía las reglas, ya lo corregí..."
              maxLength={500}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setOpen(false)}
                disabled={sending}
                className="btn-secondary flex-1"
                style={{ padding: "10px" }}
              >
                Cancelar
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="rounded-xl font-bold text-sm text-white flex-1 disabled:opacity-60"
                style={{ background: "var(--danger)", padding: "10px" }}
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Bottom nav: solo 4 items (lo importante) ───
   El ítem activo se muestra como botón elevado con color de acento */
// Finanzas se revisa a diario igual que Pedidos/Productos — antes quedaba
// a 2 toques (detrás del drawer "Cuenta"). Delivery y Ajustes se quedan ahí:
// no todos los vendedores tienen repartidores, y Ajustes es de uso esporádico.
const BOTTOM_NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: ShoppingBag, exact: false },
  { href: "/dashboard/productos", label: "Productos", icon: Package, exact: false },
  { href: "/dashboard/finanzas", label: "Finanzas", icon: BarChart2, exact: false },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuthStore();

  const [hydrated, setHydrated] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeStatus, setStoreStatus] = useState<string | null>(null);
  const [sells, setSells] = useState<string | null>(null);
  const [reactivationRequestedAt, setReactivationRequestedAt] = useState<string | null>(null);
  const loggingOut = useRef(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // El avatar de la top bar mobile es un acceso rápido a "mi cuenta"
  // (perfil + salir) — antes abría la pantalla completa de "Más" (toda
  // la navegación), que ya tiene su propio botón en la bottom nav.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    if (accountMenuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [accountMenuOpen]);

  useSellerPushSubscription(user?.email);

  // Antes este guard solo verificaba que hubiera un token — con eso
  // alcanzaba para cargar el shell del panel de vendedor con una sesión de
  // comprador (mismo authStore global para toda la app). El rol también
  // tiene que calificar.
  const isAllowedRole = user?.role === "vendor" || user?.role === "admin";

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    // El guard no debe pisar la redirección a "/" cuando el logout es voluntario
    if (hydrated && !accessToken && !loggingOut.current) router.replace("/auth/login");
    else if (hydrated && accessToken && user && !isAllowedRole) router.replace("/");
  }, [hydrated, accessToken, user, isAllowedRole, router]);
  useEffect(() => {
    if (hydrated && accessToken)
      apiClient
        .get("/stores/me")
        .then(({ data }) => {
          setStoreSlug(data.slug);
          setStoreStatus(data.status);
          setSells(data.sells ?? null);
          setReactivationRequestedAt(data.reactivation_requested_at ?? null);
        })
        .catch(() => {});
  }, [hydrated, accessToken]);

  if (!hydrated || !accessToken) return null;
  if (user && !isAllowedRole) return null;

  function handleLogout() {
    loggingOut.current = true;
    logout();
    // Al salir se vuelve a la página principal, no al login
    router.push("/");
  }

  const initials = getInitials(user?.full_name);
  const firstName = user?.full_name?.split(" ")[0] ?? "vendedor";

  /* Relanza el tour; si no estamos en el inicio, navega primero
     (los elementos resaltados viven en /dashboard) */
  function handleRestartTour() {
    if (pathname === "/dashboard") {
      restartQtiendaTour();
    } else {
      router.push("/dashboard");
      setTimeout(restartQtiendaTour, 700);
    }
  }

  return (
    <div className="min-h-dvh md:flex" data-theme="panel-calido" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      {/* ═════════ Sidebar (desktop) ═════════ */}
      <aside
        className="hidden md:flex flex-col sticky top-0 h-screen"
        style={{
          width: 240,
          background: "var(--surface)",
          borderRight: "1px solid var(--line)",
          flexShrink: 0,
          padding: "20px 14px",
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: "4px 8px 22px" }}>
          <Logo size="md" variant="brand" />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell align="left" />
          </div>
        </div>

        <nav className="flex-1 flex flex-col">
          {getVisibleGroups(sells).map((group, gi) => (
            <div key={group.label ?? gi} className={gi > 0 ? "mt-3" : ""}>
              {group.label && (
                <p
                  className="text-[10px] font-bold uppercase tracking-wide px-2.5 mb-1"
                  style={{ color: "var(--ink-4)" }}
                >
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, exact }) => {
                  const active = isActive(pathname, href, exact);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        background: active ? "var(--accent-soft)" : "transparent",
                        color: active ? "var(--accent-ink)" : "var(--ink-2)",
                      }}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.7}
                        style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}
                      />
                      <span style={{ flex: 1 }}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <a
            href={storeSlug ? `https://${storeSlug}.qtienda.shop/` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            <ExternalLink size={15} strokeWidth={1.7} />
            <span style={{ flex: 1 }}>Ver mi tienda</span>
          </a>
          <Link
            href="/mis-pedidos"
            className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            <ShoppingCart size={15} strokeWidth={1.7} />
            <span style={{ flex: 1 }}>Mis compras</span>
          </Link>

          <div
            className="mt-3 px-3 py-2.5 flex items-center gap-2.5 rounded-xl"
            style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
          >
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                background: "var(--ink)",
                color: "var(--bg)",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                className="text-xs font-medium truncate"
                style={{ color: "var(--ink)" }}
              >
                {user?.full_name}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--ink-3)" }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center rounded-md"
              style={{
                width: 22,
                height: 22,
                color: "var(--ink-3)",
              }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={13} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </aside>

      {/* ═════════ Main ═════════ */}
      <main
        className="flex-1 min-w-0 pb-24 md:pb-0"
        style={{ minHeight: "100dvh" }}
      >
        {/* ═════════ Top bar (mobile) — visible en todas las páginas ═════════ */}
        <div
          className="md:hidden"
          style={{
            // Superficie propia + sombra: que se lea como header, no como fondo
            background: "var(--surface)",
            padding: "12px 22px",
            borderBottom: "1px solid var(--line)",
            boxShadow: "0 2px 12px rgba(20,19,15,.06)",
          }}
        >
          <div className="flex items-center justify-between">
            <Link href="/dashboard" aria-label="Ir al inicio">
              <Logo size="md" variant="brand" href={null} />
            </Link>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRestartTour}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                }}
                aria-label="Ver recorrido del panel"
              >
                <HelpCircle size={16} strokeWidth={1.7} style={{ color: "var(--ink-2)" }} />
              </button>
              <ThemeToggle />
              <NotificationBell directLink />
              <Link
                href="/dashboard/configuracion"
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                }}
                aria-label="Ajustes de tienda"
              >
                <Settings size={16} strokeWidth={1.7} style={{ color: "var(--ink-2)" }} />
              </Link>
              <div ref={accountMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--ink)",
                    color: "var(--bg)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  aria-label="Mi cuenta"
                  aria-expanded={accountMenuOpen}
                >
                  {initials}
                </button>
                {accountMenuOpen && (
                  <div
                    className="card overflow-hidden animate-fade-in"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      width: 220,
                      background: "var(--surface)",
                      zIndex: 50,
                    }}
                  >
                    <div className="flex items-center gap-2.5 p-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
                      <div
                        className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{ width: 32, height: 32, background: "var(--ink)", color: "var(--bg)", fontSize: 11, fontWeight: 500 }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>{user?.full_name}</p>
                        <p className="text-[10px] truncate" style={{ color: "var(--ink-3)" }}>{user?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-3 text-sm font-medium"
                      style={{ color: "var(--danger)" }}
                    >
                      <LogOut size={15} strokeWidth={1.7} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {user && user.is_verified === false && <VerifyBanner email={user.email} />}
        {(storeStatus === "suspended" || storeStatus === "banned") && (
          <SuspendedBanner
            status={storeStatus}
            reactivationRequestedAt={reactivationRequestedAt}
            onRequested={setReactivationRequestedAt}
          />
        )}
        {storeStatus === "pending" && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 text-xs"
            style={{ background: "var(--warn-soft)", borderBottom: "1px solid var(--line-2)", color: "var(--warn)" }}
          >
            <span className="dot dot-warn flex-shrink-0" />
            <span className="font-medium">Tu tienda está en revisión antes de publicarse.</span>
          </div>
        )}
        {children}

        {/* Tour de bienvenida: solo en el inicio, donde están sus targets */}
        {pathname === "/dashboard" && <DashboardTour firstName={firstName} />}
      </main>

      {/* ═════════ Bottom nav (mobile) ═════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: "var(--bg)",
          borderTop: "1px solid var(--line)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-start" style={{ padding: "10px 20px 0" }}>
          {BOTTOM_NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center"
                style={{ gap: 4 }}
              >
                {active ? (
                  /* Ítem activo: botón elevado con color de acento */
                  <span
                    className="flex items-center justify-center rounded-2xl transition-transform active:scale-95"
                    style={{
                      width: 46,
                      height: 46,
                      marginTop: -22,
                      background: "var(--accent)",
                      border: "3px solid var(--bg)",
                      boxShadow: "0 6px 16px rgba(197,97,59,.4)",
                    }}
                  >
                    <Icon size={22} strokeWidth={2} style={{ color: "#fff" }} />
                  </span>
                ) : (
                  <Icon size={20} strokeWidth={1.6} style={{ color: "var(--ink-3)" }} />
                )}
                <span
                  className="text-[10px] leading-none"
                  style={{
                    color: active ? "var(--accent)" : "var(--ink-3)",
                    fontWeight: active ? 700 : 500,
                    marginTop: active ? -1 : 0,
                  }}
                >
                  {label}
                </span>
                <span style={{ width: 4, height: 4, marginTop: 2 }} />
              </Link>
            );
          })}
          <Link
            href="/dashboard/mas"
            className="flex-1 flex flex-col items-center"
            style={{ gap: 4 }}
            aria-label="Más opciones"
          >
            {isActive(pathname, "/dashboard/mas") ? (
              <span
                className="flex items-center justify-center rounded-2xl transition-transform active:scale-95"
                style={{
                  width: 46,
                  height: 46,
                  marginTop: -22,
                  background: "var(--accent)",
                  border: "3px solid var(--bg)",
                  boxShadow: "0 6px 16px rgba(197,97,59,.4)",
                }}
              >
                <LayoutGrid size={22} strokeWidth={2} style={{ color: "#fff" }} />
              </span>
            ) : (
              <LayoutGrid size={20} strokeWidth={1.6} style={{ color: "var(--ink-3)" }} />
            )}
            <span
              className="text-[10px] leading-none"
              style={{
                color: isActive(pathname, "/dashboard/mas") ? "var(--accent)" : "var(--ink-3)",
                fontWeight: isActive(pathname, "/dashboard/mas") ? 700 : 500,
                marginTop: isActive(pathname, "/dashboard/mas") ? -1 : 0,
              }}
            >
              Más
            </span>
            <span style={{ width: 4, height: 4, marginTop: 2 }} />
          </Link>
        </div>
      </nav>
    </div>
  );
}
