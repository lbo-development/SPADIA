import { describe, it, expect } from 'vitest';
import { extractErrorMessage, parseServerError } from './errors';

function apiErr(code: string, message?: string): unknown {
  return { response: { data: { error: { code, ...(message !== undefined ? { message } : {}) } } } };
}

describe('extractErrorMessage', () => {
  it('retourne le message serveur quand il est présent', () => {
    const err = apiErr('SOME_CODE', 'Email déjà utilisé.');
    expect(extractErrorMessage(err)).toBe('Email déjà utilisé.');
  });

  it('retourne le fallback par défaut pour undefined', () => {
    expect(extractErrorMessage(undefined)).toBe('Une erreur est survenue.');
  });
});

describe('parseServerError', () => {
  it('AUTH_ERROR + "email" → fieldErrors.email figé', () => {
    const err = apiErr('AUTH_ERROR', 'email already exists');
    expect(parseServerError(err)).toEqual({
      fieldErrors: { email: 'Cet email est déjà utilisé.' },
      globalError: null,
    });
  });

  it('INVALID_INPUT + "nom" → fieldErrors.nom avec le message serveur', () => {
    const msg = 'Le champ nom est requis.';
    const err = apiErr('INVALID_INPUT', msg);
    expect(parseServerError(err)).toEqual({
      fieldErrors: { nom: msg },
      globalError: null,
    });
  });

  it('code inconnu sans message → globalError fallback', () => {
    const err = apiErr('UNKNOWN_CODE');
    expect(parseServerError(err)).toEqual({
      fieldErrors: {},
      globalError: 'Erreur lors de la sauvegarde.',
    });
  });
});
