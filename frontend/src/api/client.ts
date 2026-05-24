import axios, { type InternalAxiosRequestConfig } from 'axios';

const SK = { jwt: 'spadia_jwt', session: 'spadia_st', refresh: 'spadia_rt' } as const;

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

let _jwt:          string | null = sessionStorage.getItem(SK.jwt);
let _sessionToken: string | null = sessionStorage.getItem(SK.session);
let _refreshToken: string | null = sessionStorage.getItem(SK.refresh);
let _refreshing:   Promise<boolean> | null = null;

export function setTokens(jwt: string, sessionToken: string, refreshToken: string) {
  _jwt = jwt;
  _sessionToken = sessionToken;
  _refreshToken = refreshToken;
  sessionStorage.setItem(SK.jwt, jwt);
  sessionStorage.setItem(SK.session, sessionToken);
  sessionStorage.setItem(SK.refresh, refreshToken);
}

export function clearTokens() {
  _jwt = null; _sessionToken = null; _refreshToken = null;
  (Object.values(SK) as string[]).forEach(k => sessionStorage.removeItem(k));
}

export function hasStoredSession(): boolean {
  return !!(sessionStorage.getItem(SK.jwt) && sessionStorage.getItem(SK.session));
}

async function tryRefresh(): Promise<boolean> {
  if (!_refreshToken || !_sessionToken) return false;
  try {
    const { data } = await axios.post<{ jwt: string; refresh_token: string }>(
      '/api/v1/auth/refresh',
      { refresh_token: _refreshToken },
      { headers: { 'X-Session-Token': _sessionToken } },
    );
    setTokens(data.jwt, _sessionToken, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _isRetry?: boolean };

apiClient.interceptors.request.use((config) => {
  if (_jwt)          config.headers['Authorization']   = `Bearer ${_jwt}`;
  if (_sessionToken) config.headers['X-Session-Token'] = _sessionToken;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const code   = error.response?.data?.error?.code as string | undefined;
    const config = error.config as RetryableConfig;

    if (error.response?.status === 401 && code === 'UNAUTHENTICATED' && !config?._isRetry) {
      if (!_refreshing) _refreshing = tryRefresh().finally(() => { _refreshing = null; });
      const ok = await _refreshing;
      if (ok) {
        config._isRetry = true;
        config.headers['Authorization'] = `Bearer ${_jwt}`;
        return apiClient(config);
      }
    }

    if (error.response?.status === 401) {
      clearTokens();
      const messages: Record<string, string> = {
        SESSION_INVALIDATED: 'Votre session a été fermée car une connexion a été ouverte sur un autre poste.',
        SESSION_EXPIRED:     'Votre session a expiré. Veuillez vous reconnecter.',
        UNAUTHENTICATED:     'Veuillez vous connecter.',
      };
      const reason = encodeURIComponent(messages[code ?? ''] ?? messages['UNAUTHENTICATED']);
      window.location.href = `/login?reason=${reason}`;
    }
    return Promise.reject(error);
  },
);
