import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiClient } from '@/api/client';
import type { UserProfile } from '@/types';

interface LoginResponse {
  jwt: string;
  session_token: string;
  user: UserProfile;
}

const KEY_JWT     = 'spadia_jwt';
const KEY_SESSION = 'spadia_session_token';
const KEY_USER    = 'spadia_user';

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const raw = sessionStorage.getItem(KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    Boolean(sessionStorage.getItem(KEY_JWT) && sessionStorage.getItem(KEY_SESSION))
  );

  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
      sessionStorage.setItem(KEY_JWT,     data.jwt);
      sessionStorage.setItem(KEY_SESSION, data.session_token);
      sessionStorage.setItem(KEY_USER,    JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* nettoyage */ }
    sessionStorage.removeItem(KEY_JWT);
    sessionStorage.removeItem(KEY_SESSION);
    sessionStorage.removeItem(KEY_USER);
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