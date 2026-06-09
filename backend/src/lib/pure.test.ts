import { clampAccred, pick, geoBody } from './pure';

describe('clampAccred', () => {
  it('clamp -1 → 0 (en dessous du min)', () => {
    expect(clampAccred(-1)).toBe(0);
  });

  it('clamp 5 → 3 (au dessus du max)', () => {
    expect(clampAccred(5)).toBe(3);
  });

  it('clamp "abc" → 0 (NaN → min)', () => {
    expect(clampAccred('abc')).toBe(0);
  });
});

describe('pick', () => {
  it('retourne uniquement les clés demandées', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toEqual({ a: 1, b: 2 });
  });

  it('retourne {} si body est null', () => {
    expect(pick(null, ['a'])).toEqual({});
  });
});

describe('geoBody', () => {
  it('construit geo_point en format WKT POINT(lng lat)', () => {
    const result = geoBody({ lat: 48.8, lng: 2.3, nom: 'X' });
    expect(result.geo_point).toBe('POINT(2.3 48.8)');
    expect(result.nom).toBe('X');
    expect('lat' in result).toBe(false);
    expect('lng' in result).toBe(false);
  });

  it('geo_point est null si lat et lng sont des chaînes vides', () => {
    const result = geoBody({ lat: '', lng: '' });
    expect(result.geo_point).toBeNull();
  });

  it('ne produit pas de champ geo_point si lat et lng sont absents', () => {
    const result = geoBody({ nom: 'X' });
    expect('geo_point' in result).toBe(false);
  });
});
