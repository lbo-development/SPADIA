export interface ParsedError {
  fieldErrors: Record<string, string>;
  globalError: string | null;
}

type ApiError = { response?: { data?: { error?: { code?: string; message?: string } } } };

export function parseServerError(err: unknown): ParsedError {
  const resp  = (err as ApiError)?.response?.data?.error;
  const code    = resp?.code    ?? '';
  const message = resp?.message ?? 'Erreur lors de la sauvegarde.';
  const lc = message.toLowerCase();

  if (code === 'AUTH_ERROR') {
    if (lc.includes('already') || lc.includes('exist') || lc.includes('email'))
      return { fieldErrors: { email: 'Cet email est déjà utilisé.' }, globalError: null };
    if (lc.includes('password') || lc.includes('mot de passe'))
      return { fieldErrors: { password: message }, globalError: null };
  }
  if (code === 'INVALID_INPUT') {
    if (lc.includes('email'))    return { fieldErrors: { email: message },    globalError: null };
    if (lc.includes('nom'))      return { fieldErrors: { nom: message },      globalError: null };
    if (lc.includes('password')) return { fieldErrors: { password: message }, globalError: null };
  }
  return { fieldErrors: {}, globalError: message };
}

export function extractErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
  return (err as ApiError)?.response?.data?.error?.message ?? fallback;
}
