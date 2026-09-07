// src/hooks/useDashboardQueries.ts — qtienda v2
//
// Centraliza todos los queries del dashboard con React Query v5.
// Reemplaza el patrón useEffect + useState + setLoading en:
//   - dashboard/page.tsx       → useStore, useDashboardStats
//   - dashboard/pedidos/page.tsx → useOrders, useOrderDetail
//   - dashboard/productos/page.tsx → useProducts, useCategories
//   - dashboard/finanzas/page.tsx  → useFinanzasStats
//
// Beneficios vs useEffect manual:
//   ✓ Caché automático — si ya cargó, no vuelve a cargar al navegar
//   ✓ Revalidación al volver a la pestaña (refetchOnWindowFocus)
//   ✓ Reintento automático en error de red
//   ✓ Estado loading/error/data en una sola línea
//   ✓ invalidateQueries para actualizar tras mutaciones

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// ── Query keys centralizados ─────────────────────────────────
// Usar constantes evita typos y facilita invalidaciones selectivas
export const QK = {
  store:       ["store", "me"]            as const,
  stats:       (from: string, to: string) => ["stats", from, to] as const,
  orders:      (filter: string, search: string, page: number) =>
                 ["orders", filter, search, page] as const,
  orderDetail: (id: string)              => ["order", id] as const,
  products:    ["products"]              as const,
  categories:  ["categories"]            as const,
  finanzas:    (period: string, from?: string, to?: string) => ["finanzas", period, from, to] as const,
  subscription: ["subscription", "my"]   as const,
  analytics:   (days: number)            => ["analytics", days] as const,
  pendingAppointments: ["appointments", "pending"] as const,
} as const;

// ── Store del vendedor ───────────────────────────────────────
export function useStore() {
  return useQuery({
    queryKey: QK.store,
    queryFn: async () => {
      const { data } = await apiClient.get("/stores/me");
      return data;
    },
    staleTime: 5 * 60 * 1000,    // 5 min — la tienda no cambia seguido
    retry: 1,
  });
}

// ── Stats del dashboard (hoy) ────────────────────────────────
// No depende de storeId: /orders/stats/summary, /orders/ y /products/ ya
// resuelven la tienda del vendedor por su token, así que puede salir en
// paralelo con useStore() en vez de esperar a que esa termine primero —
// un vendedor sin tienda todavía recibe 404 acá, inofensivo (la pantalla
// nunca llega a pintar esta sección en ese caso).
export function useDashboardStats() {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: QK.stats(today, today),
    queryFn: async () => {
      const [statsRes, ordersRes, prodsRes] = await Promise.all([
        apiClient.get("/orders/stats/summary", {
          params: { from_date: today, to_date: today },
        }),
        apiClient.get("/orders/", { params: { limit: 4, page: 1 } }),
        apiClient.get("/products/", { params: { limit: 1, page: 1 } }),
      ]);
      return {
        stats:        statsRes.data.this_month,
        recentOrders: ordersRes.data.items ?? [],
        productCount: prodsRes.data.total ?? 0,
      };
    },
    retry: 1,
    staleTime: 60 * 1000,        // 1 min — stats del día se actualizan seguido
    refetchOnWindowFocus: true,  // Al volver a la pestaña, refresca las stats
  });
}

// ── Analytics de la tienda (30 días) ─────────────────────────
export function useStoreAnalytics(days = 30) {
  return useQuery({
    queryKey: QK.analytics(days),
    queryFn: async () => {
      const { data } = await apiClient.get("/stores/me/analytics", { params: { days } });
      return data;
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Citas pendientes de confirmar ────────────────────────────
// Solo hay algo que contar si el vendedor ofrece servicios con cita — en
// tiendas sin servicios esto siempre da 404/vacío, inofensivo.
export function usePendingAppointments() {
  return useQuery({
    queryKey: QK.pendingAppointments,
    queryFn: async () => {
      const { data } = await apiClient.get("/services/appointments", { params: { status: "pending" } });
      return Array.isArray(data) ? data.length : 0;
    },
    retry: 1,
    staleTime: 60 * 1000,
  });
}

// ── Lista de pedidos (con filtros) ───────────────────────────
export function useOrders(
  statusFilter: string,
  search: string,
  page: number
) {
  return useQuery({
    queryKey: QK.orders(statusFilter, search, page),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (search)       params.set("search", search);
      const { data } = await apiClient.get(`/orders/?${params}`);
      return { items: data.items as any[], total: data.total as number };
    },
    staleTime: 30 * 1000,        // 30s — los pedidos cambian con frecuencia
    refetchOnWindowFocus: true,  // Crítico: vendedor vuelve al tab y ve pedidos nuevos
    placeholderData: (prev) => prev, // Mantiene datos anteriores al cambiar filtro (no parpadea)
  });
}

// ── Detalle de un pedido ────────────────────────────────────
export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: QK.orderDetail(orderId ?? ""),
    queryFn: async () => {
      const { data } = await apiClient.get(`/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,
  });
}

// ── Mutación: cambiar estado de un pedido ───────────────────
export function useChangeOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      const { data } = await apiClient.patch(`/orders/${orderId}/status`, {
        status,
      });
      return data;
    },
    onSuccess: (_, { orderId }) => {
      // Invalida todos los queries de pedidos y el detalle del pedido modificado
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: QK.orderDetail(orderId) });
      // ["stats"] solo (sin fechas) para que matchee por prefijo la key real
      // ["stats", hoy, hoy] — QK.stats("", "") arma ["stats","",""], que
      // nunca calza como prefijo y por eso nunca invalidaba nada.
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ── Productos + Categorías ───────────────────────────────────
export function useProducts() {
  return useQuery({
    queryKey: QK.products,
    queryFn: async () => {
      const { data } = await apiClient.get("/products/?limit=100");
      return data.items as any[];
    },
    staleTime: 2 * 60 * 1000,   // 2 min — el catálogo cambia menos que los pedidos
  });
}

export function useCategories() {
  return useQuery({
    queryKey: QK.categories,
    queryFn: async () => {
      const { data } = await apiClient.get("/categories/");
      return data as any[];
    },
    staleTime: 5 * 60 * 1000,   // 5 min — las categorías cambian poco
  });
}

// ── Mutación: guardar producto ───────────────────────────────
export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string | null;
      payload: any;
    }) => {
      if (id) {
        const { data } = await apiClient.put(`/products/${id}`, payload);
        return data;
      }
      const { data } = await apiClient.post("/products/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.products });
    },
  });
}

// ── Mutación: eliminar producto ──────────────────────────────
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.delete(`/products/${productId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.products });
    },
  });
}

// ── Stats de finanzas: período elegido + período anterior (para el badge
// "+12% vs período anterior") + gráfico diario + top productos, las 4 en
// paralelo — se consumen juntas en la misma pantalla y cambian juntas
// cuando cambia el período. La lista paginada de "Movimientos" NO va acá:
// no está filtrada por período, así que reutiliza useOrders() tal cual.
export function useFinanzasStats(
  period: string,
  dates: { from: string; to: string } | null,
  prevDates: { from: string; to: string } | null,
) {
  const params = dates ? { from_date: dates.from, to_date: dates.to } : {};
  return useQuery({
    queryKey: QK.finanzas(period, dates?.from, dates?.to),
    queryFn: async () => {
      const [statsRes, prevRes, dailyRes, topRes] = await Promise.all([
        apiClient.get("/orders/stats/summary", { params }),
        prevDates
          ? apiClient.get("/orders/stats/summary", {
              params: { from_date: prevDates.from, to_date: prevDates.to },
            })
          : Promise.resolve(null),
        apiClient.get("/orders/stats/daily", { params }),
        apiClient.get("/orders/stats/top-products", { params: { ...params, limit: 10 } }),
      ]);
      return {
        stats:        statsRes.data.this_month,
        prevStats:    prevRes ? prevRes.data.this_month : null,
        daily:        dailyRes.data,
        topProducts:  topRes.data,
      };
    },
    staleTime: 60 * 1000,
  });
}

// ── Suscripción/plan actual del vendedor ─────────────────────
export function useSubscription() {
  return useQuery({
    queryKey: QK.subscription,
    queryFn: async () => {
      const { data } = await apiClient.get("/plans/my-subscription");
      return data;
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}
