import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Persisting to localStorage solves Safari/iPhone logout-on-refresh issue.
// Safari blocks cross-origin httpOnly cookies (even with SameSite=None + Secure),
// so the refresh token cookie never gets sent back on page reload.
// Storing the access token in localStorage means the session survives page refreshes
// without needing the cookie round-trip. Trade-off is acceptable for an internal tool.
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      login: (user, accessToken) => set({ user, accessToken }),
      logout: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'crm-auth-v1',
      // Only persist user and accessToken — nothing sensitive beyond what's already in the token
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
