import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'keel-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export const selectIsAuthenticated = (state) => Boolean(state.token);
export const selectIsGerencia = (state) => state.user?.role === 'GERENCIA';
