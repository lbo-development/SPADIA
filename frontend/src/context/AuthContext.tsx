import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiClient, setTokens, clearTokens } from '@/api/client';
import type { UserProfile } from '@/types';

interface LoginResponse {
  jwt: string;
  session_token: string;
  user: UserProfile;
}

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (userId: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading]             = useState(false);

  const login = useCallback(async (userId: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', { userId, password });
      setTokens(data.jwt, data.session_token);
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* nettoyage */ }
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être dans AuthProvider');
  return ctx;
}
