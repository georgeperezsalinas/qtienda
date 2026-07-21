"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Users, ChevronLeft, ChevronRight as ChevronRightIcon, Ban, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ConfirmModal } from "../_components/ConfirmModal";

interface UserItem {
  id:            string;
  email:         string;
  full_name:     string;
  role:          string;
  is_active:     boolean;
  created_at:    string;
  last_login_at: string | null;
}

interface UsersResponse {
  total: number;
  page:  number;
  pages: number;
  items: UserItem[];
}

const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  admin:  { bg: "var(--danger-soft)", color: "var(--danger)", label: "Admin"    },
  vendor: { bg: "var(--accent-soft)", color: "var(--accent-ink)", label: "Vendor" },
  buyer:  { bg: "var(--surface-2)", color: "var(--ink-2)", label: "Comprador"},
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Skel({ h = 24 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 16 }} />;
}

export default function AdminUsuariosPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [users,   setUsers]   = useState<UserItem[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserItem | null>(null);
  const { user: currentUser } = useAuthStore();

  const page = Number(searchParams.get("page") ?? "1");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<UsersResponse>("/admin/users", {
        params: { page, limit: 20 },
      });
      setUsers(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/admin/usuarios?${params.toString()}`);
  }

  async function activate(u: UserItem) {
    setActing(u.id);
    try {
      await apiClient.patch(`/admin/users/${u.id}`, { is_active: true });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: true } : x));
      toast.success("Usuario activado");
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo activar");
    } finally {
      setActing(null);
    }
  }

  async function suspend(u: UserItem) {
    setActing(u.id);
    try {
      await apiClient.patch(`/admin/users/${u.id}`, { is_active: false });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, is_active: false } : x));
      toast.success("Usuario suspendido");
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? "No se pudo suspender");
    } finally {
      setActing(null);
      setSuspendTarget(null);
    }
  }

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto px-5 py-6 space-y-5">

      <div>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Usuarios
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          {total} usuario{total !== 1 ? "s" : ""} registrados
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skel key={i} h={76} />)}
        </div>
      ) : users.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
        >
          <Users size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>Sin usuarios</p>
        </div>
      ) : (
      <>
      {/* Tarjetas — móvil/tablet */}
      <div className="lg:hidden space-y-3">
        {users.map((u) => {
            const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.buyer;
            const initials = getInitials(u.full_name || u.email);
            return (
              <div
                key={u.id}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm text-white flex-shrink-0"
                  style={{
                    background: u.role === "admin"
                      ? "linear-gradient(135deg, var(--danger), var(--accent-ink))"
                      : "linear-gradient(135deg, var(--accent), var(--accent-ink))",
                    opacity: u.is_active ? 1 : 0.5,
                  }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm truncate" style={{ color: "var(--ink)" }}>
                      {u.full_name || "—"}
                    </p>
                    <span
                      className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: rs.bg, color: rs.color }}
                    >
                      {rs.label}
                    </span>
                    {!u.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-3)" }}>
                    {u.email}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-4)" }}>
                    Registro: {new Date(u.created_at).toLocaleDateString("es-PE")}
                    {u.last_login_at && (
                      <> · Login: {new Date(u.last_login_at).toLocaleDateString("es-PE")}</>
                    )}
                  </p>
                </div>

                {u.id !== currentUser?.id && (
                  u.is_active ? (
                    <button
                      disabled={acting === u.id}
                      onClick={() => setSuspendTarget(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 disabled:opacity-50"
                      style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                    >
                      <Ban size={13} />
                      Suspender
                    </button>
                  ) : (
                    <button
                      disabled={acting === u.id}
                      onClick={() => activate(u)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 disabled:opacity-50"
                      style={{ background: "var(--success-soft)", color: "var(--success)" }}
                    >
                      <CheckCircle2 size={13} />
                      Activar
                    </button>
                  )
                )}
              </div>
            );
          })}
      </div>

      {/* Tabla — escritorio */}
      <div
        className="hidden lg:block rounded-2xl overflow-x-auto"
        style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)", boxShadow: "var(--shadow-sm)" }}
      >
        <table className="w-full text-sm" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-2)" }}>
              <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Usuario</th>
              <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Rol</th>
              <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Estado</th>
              <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Registro</th>
              <th className="text-left font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Último login</th>
              <th className="text-right font-bold text-[11px] uppercase px-4 py-3" style={{ color: "var(--ink-3)" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.buyer;
              const initials = getInitials(u.full_name || u.email);
              return (
                <tr key={u.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white flex-shrink-0"
                        style={{
                          background: u.role === "admin"
                            ? "linear-gradient(135deg, var(--danger), var(--accent-ink))"
                            : "linear-gradient(135deg, var(--accent), var(--accent-ink))",
                          opacity: u.is_active ? 1 : 0.5,
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate max-w-[180px]" style={{ color: "var(--ink)" }}>{u.full_name || "—"}</p>
                        <p className="text-xs truncate max-w-[200px]" style={{ color: "var(--ink-4)" }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: rs.bg, color: rs.color }}
                    >
                      {rs.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                        Activo
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                    {new Date(u.created_at).toLocaleDateString("es-PE")}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString("es-PE") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      {u.id !== currentUser?.id && (
                        u.is_active ? (
                          <button
                            title="Suspender"
                            disabled={acting === u.id}
                            onClick={() => setSuspendTarget(u)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                          >
                            <Ban size={13} />
                          </button>
                        ) : (
                          <button
                            title="Activar"
                            disabled={acting === u.id}
                            onClick={() => activate(u)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-50"
                            style={{ background: "var(--success-soft)", color: "var(--success)" }}
                          >
                            <CheckCircle2 size={13} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      <ConfirmModal
        open={!!suspendTarget}
        variant="danger"
        title="Suspender usuario"
        message={suspendTarget && <>&quot;{suspendTarget.full_name || suspendTarget.email}&quot; no podrá iniciar sesión hasta que lo reactives.</>}
        confirmLabel="Suspender"
        loading={!!suspendTarget && acting === suspendTarget.id}
        onCancel={() => setSuspendTarget(null)}
        onConfirm={() => suspendTarget && suspend(suspendTarget)}
      />

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronLeft size={16} style={{ color: "var(--ink-2)" }} />
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
            {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid var(--line-2)" }}
          >
            <ChevronRightIcon size={16} style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
      )}

    </div>
  );
}
