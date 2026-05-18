import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

let _jwt: string | null = null;
let _sessionToken: string | null = null;

export function setTokens(jwt: string, sessionToken: string) {
  _jwt = jwt;
  _sessionToken = sessionToken;
}

export function clearTokens() {
  _jwt = null;
  _sessionToken = null;
}

apiClient.interceptors.request.use((config) => {
  if (_jwt)          config.headers['Authorization']    = `Bearer ${_jwt}`;
  if (_sessionToken) config.headers['X-Session-Token'] = _sessionToken;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response?.data?.error?.code;
      clearTokens();
      const messages: Record<string, string> = {
        SESSION_INVALIDATED: 'Votre session a été fermée car une connexion a été ouverte sur un autre poste.',
        SESSION_EXPIRED:     'Votre session a expiré. Veuillez vous reconnecter.',
        UNAUTHENTICATED:     'Veuillez vous connecter.',
      };
      const reason = encodeURIComponent(messages[code] || messages['UNAUTHENTICATED']);
      window.location.href = `/login?reason=${reason}`;
    }
    return Promise.reject(error);
  }
);
