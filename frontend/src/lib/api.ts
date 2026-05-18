// src/lib/api.ts — qtienda v2 (fix seguridad)
//
// CAMBIOS vs versión anterior:
//   - El interceptor de request ya NO lee localStorage directamente.
//     Lee el token desde useAuthStore.getState() — una sola fuente de verdad.
//   - El interceptor de refresh también usa getState() para leer y escribir tokens.
//   - logout en el catch usa useAuthStore.getState().logout() en vez de
//     localStorage.clear() (que borraba datos ajenos al auth).
//   - Timeout aumentado a 15s para conexiones móviles lentas en LatAm.

import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE,
  timeout: 15_000, // 15s — conexiones móviles lentas en LatAm
});

// ── Attach JWT en cada request ───────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Lee del store, NO de localStorage directamente
    const token = useAuthStore.getState().getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auto-refresh en 401 ──────────────────────────────────────
apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        // Lee refresh token del store
        const refresh = useAuthStore.getState().getRefreshToken();
        if (!refresh) throw new Error("No refresh token");

        const { data } = await axios.post(`${BASE}/auth/refresh`, {
          refresh_token: refresh,
        });

        // Actualiza el store (Zustand persist sincroniza con localStorage)
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token);

        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        // Refresh falló → logout limpio
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
      }
    }

    return Promise.reject(error);
  }
);