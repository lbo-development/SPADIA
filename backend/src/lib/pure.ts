export const ACCREDITATION_BOUNDS = { min: 0, max: 3 } as const;

export function clampAccred(value: unknown): number {
  const n = parseInt(String(value ?? 0), 10);
  if (isNaN(n)) return ACCREDITATION_BOUNDS.min;
  return Math.min(ACCREDITATION_BOUNDS.max, Math.max(ACCREDITATION_BOUNDS.min, n));
}

export function pick(body: unknown, keys: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) { if (k in src) out[k] = src[k]; }
  return out;
}

export function geoBody(raw: Record<string, unknown>): Record<string, unknown> {
  const { lat, lng, ...rest } = raw;
  const body: Record<string, unknown> = { ...rest };
  if ('lat' in raw || 'lng' in raw) {
    const latN = lat !== '' && lat != null ? parseFloat(String(lat)) : NaN;
    const lngN = lng !== '' && lng != null ? parseFloat(String(lng)) : NaN;
    body.geo_point = !isNaN(latN) && !isNaN(lngN) ? `POINT(${lngN} ${latN})` : null;
  }
  return body;
}
