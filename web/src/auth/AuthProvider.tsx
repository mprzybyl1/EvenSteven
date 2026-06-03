import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type User } from "../lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  claim: (token: string, email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { displayName?: string; avatarEmoji?: string | null }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // Źródło prawdy o zalogowaniu: /api/auth/me. 401 -> niezalogowany (user = null).
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: User }>("/auth/me");
        return res.user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const refresh = (user: User) => qc.setQueryData(["me"], user);

  const value: AuthContextValue = {
    user: data ?? null,
    loading: isLoading,
    login: async (email, password) => {
      const res = await api.post<{ user: User }>("/auth/login", { email, password });
      refresh(res.user);
    },
    register: async (email, displayName, password) => {
      const res = await api.post<{ user: User }>("/auth/register", { email, displayName, password });
      refresh(res.user);
    },
    claim: async (token, email, displayName, password) => {
      const res = await api.post<{ user: User }>("/auth/claim", { token, email, displayName, password });
      refresh(res.user);
    },
    logout: async () => {
      await api.post("/auth/logout");
      qc.setQueryData(["me"], null);
      qc.clear();
    },
    updateProfile: async (input) => {
      const res = await api.patch<{ user: User }>("/auth/me", input);
      refresh(res.user);
    },
    changePassword: async (currentPassword, newPassword) => {
      await api.post("/auth/change-password", { currentPassword, newPassword });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi być wewnątrz <AuthProvider>");
  return ctx;
}
