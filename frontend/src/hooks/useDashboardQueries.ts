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
  finanzas:    (period: string)          => ["finanzas", period] as const,
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
export function useDashboardStats(storeId: string | undefined) {
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
    enabled: !!storeId,          // Solo consulta cuando la tienda ya cargó
    staleTime: 60 * 1000,        // 1 min — stats del día se actualizan seguido
    refetchOnWindowFocus: true,  // Al volver a la pestaña, refresca las stats
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
      qc.invalidateQueries({ queryKey: QK.stats("", "") }); // refresca stats también
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

// ── Stats de finanzas ────────────────────────────────────────
export function useFinanzasStats(period: string, from?: string, to?: string) {
  return useQuery({
    queryKey: QK.finanzas(period),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from_date = from;
      if (to)   params.to_date   = to;
      const [statsRes, ordersRes, subRes] = await Promise.all([
        apiClient.get("/orders/stats/summary", { params }),
        apiClient.get("/orders/", {
          params: { ...params, limit: 10, page: 1 },
        }),
        apiClient.get("/subscriptions/me").catch(() => ({ data: null })),
      ]);
      return {
        stats:        statsRes.data,
        orders:       ordersRes.data.items ?? [],
        subscription: subRes.data,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}
