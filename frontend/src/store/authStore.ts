"use client";

// src/store/authStore.ts — qtienda v2 (fix seguridad)
//
// CAMBIOS vs versión anterior:
//   - Los tokens YA NO se duplican en localStorage manualmente.
//   - Zustand persist los guarda en localStorage automáticamente con la
//     clave "qtienda-auth". El interceptor de Axios lee del store, no de
//     localStorage directamente.
//   - logout() limpia solo la clave del store, no hace localStorage.clear()
//     (que borraba datos ajenos al auth).
//   - Se agrega getAccessToken() para que api.ts lo use sin acoplarse a localStorage.

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: string;
  avatar_url?: string | null;
  is_verified?: boolean;
}

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setTokens(access, refresh) {
        // Una sola fuente de verdad: Zustand persist se encarga del localStorage
        set({ accessToken: access, refreshToken: refresh });
      },

      setUser(user) {
        set({ user });
      },

      logout() {
        set({ user: null, accessToken: null, refreshToken: null });
        // NO usar localStorage.clear() — borra datos de otras librerías
      },

      isAuthenticated: () => !!get().accessToken,

      // Helpers que api.ts usa para leer tokens sin tocar localStorage
      getAccessToken: () => get().accessToken,
      getRefreshToken: () => get().refreshToken,
    }),
    {
      name: "qtienda-auth",
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    }
  )
);