import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

const KEY_JWT     = 'spadia_jwt';
const KEY_SESSION = 'spadia_session_token';

apiClient.interceptors.request.use((config) => {
  const jwt          = sessionStorage.getItem(KEY_JWT);
  const sessionToken = sessionStorage.getItem(KEY_SESSION);
  if (jwt)          config.headers['Authorization']    = `Bearer ${jwt}`;
  if (sessionToken) config.headers['X-Session-Token'] = sessionToken;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response?.data?.error?.code;
      sessionStorage.removeItem(KEY_JWT);
      sessionStorage.removeItem(KEY_SESSION);
      sessionStorage.removeItem('spadia_user');
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