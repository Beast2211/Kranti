import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken, ApiError } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

const USER_KEY = "kranti_user";

async function cacheUser(user: User | null): Promise<void> {
  if (user) await storage.setItem(USER_KEY, JSON.stringify(user));
  else await storage.removeItem(USER_KEY);
}

async function readCachedUser(): Promise<User | null> {
  const raw = await storage.getItem<string | null>(USER_KEY, null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export type Role = "super_admin" | "admin" | "member";

export interface User {
  id: string;
  full_name: string | null;
  user_id: string | null;
  mobile: string | null;
  email: string | null;
  role: Role;
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    setTokenState(t);

    // Show the app immediately using the cached user so reopening never
    // hangs on a white screen, even on a slow or offline network.
    const cached = await readCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
      // Validate/refresh in the background — don't block the UI.
      try {
        const me = await api.get("/auth/me");
        setUser(me);
        await cacheUser(me);
      } catch (e) {
        // Only log out when the server explicitly rejects the token.
        // Network/timeout errors keep the cached session intact.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await clearToken();
          await cacheUser(null);
          setUser(null);
          setTokenState(null);
        }
      }
      return;
    }

    // No cached user (e.g. first launch after update): must validate before entering.
    try {
      const me = await api.get("/auth/me");
      setUser(me);
      await cacheUser(me);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await clearToken();
        await cacheUser(null);
      }
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post("/auth/login", { identifier, password });
    await setToken(res.access_token);
    await cacheUser(res.user);
    setTokenState(res.access_token);
    setUser(res.user);
    return res.user as User;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await clearToken();
    await cacheUser(null);
    setUser(null);
    setTokenState(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me);
      await cacheUser(me);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refresh,
        isAdmin: user?.role === "admin" || user?.role === "super_admin",
        isSuperAdmin: user?.role === "super_admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
