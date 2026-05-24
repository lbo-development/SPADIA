import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiClient, setTokens, clearTokens, hasStoredSession } from '@/api/client';
import type { UserProfile } from '@/types';

const USER_KEY = 'spadia_user';

interface LoginResponse {
  jwt: string;
  refresh_token: string;
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

function loadStoredUser(): UserProfile | null {
  if (!hasStoredSession()) return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                       = useState<UserProfile | null>(loadStoredUser);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!loadStoredUser());
  const [loading, setLoading]                 = useState(false);

  const login = useCallback(async (userId: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', { userId, password });
      setTokens(data.jwt, data.session_token, data.refresh_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* nettoyage local quoi qu'il arrive */ }
    clearTokens();
    sessionStorage.removeItem(USER_KEY);
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
