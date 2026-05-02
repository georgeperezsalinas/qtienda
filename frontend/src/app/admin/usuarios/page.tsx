"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Users, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { apiClient } from "@/lib/api";

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
  admin:  { bg: "#FEE2E2", color: "#991B1B", label: "Admin"    },
  vendor: { bg: "var(--brand-50)", color: "var(--brand-700)", label: "Vendor" },
  buyer:  { bg: "#EDE9FE", color: "#5B21B6", label: "Comprador"},
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

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

      <div>
        <h1 className="font-display font-extrabold text-2xl" style={{ color: "var(--ink)" }}>
          Usuarios
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-3)" }}>
          {total} usuario{total !== 1 ? "s" : ""} registrados
        </p>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(6)].map((_, i) => <Skel key={i} h={76} />)
        ) : users.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
          >
            <Users size={32} className="mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>Sin usuarios</p>
          </div>
        ) : (
          users.map((u) => {
            const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.buyer;
            const initials = getInitials(u.full_name || u.email);
            return (
              <div
                key={u.id}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0", boxShadow: "var(--shadow-sm)" }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm text-white flex-shrink-0"
                  style={{
                    background: u.role === "admin"
                      ? "linear-gradient(135deg, #DC2626, #9F1239)"
                      : "linear-gradient(135deg, var(--brand-600), #7C3AED)",
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
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
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
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
            style={{ background: "var(--surface-0)", border: "1.5px solid #E2E8F0" }}
          >
            <ChevronRightIcon size={16} style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
      )}

    </div>
  );
}
