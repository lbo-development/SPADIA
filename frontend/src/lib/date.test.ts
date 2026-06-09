import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fmtDate, relativeTime } from './date';

// Référence fixe : 1er juin 2024 à 12h UTC
const NOW = new Date('2024-06-01T12:00:00.000Z').getTime();

describe('fmtDate', () => {
  it('retourne — pour null', () => {
    expect(fmtDate(null)).toBe('—');
  });

  it('retourne — pour une chaîne vide', () => {
    expect(fmtDate('')).toBe('—');
  });

  it('formate une date ISO en jj/mm/aaaa', () => {
    expect(fmtDate('2024-01-15')).toBe('15/01/2024');
  });
});

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retourne "à l\'instant" pour 30 secondes', () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("à l'instant");
  });

  it('retourne "il y a 45 min" pour 45 minutes', () => {
    const iso = new Date(NOW - 45 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe('il y a 45 min');
  });

  it('retourne "il y a 3 j" pour 3 jours', () => {
    const iso = new Date(NOW - 3 * 24 * 60 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe('il y a 3 j');
  });
});
