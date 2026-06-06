import { useState, useEffect, useRef, useMemo } from 'react';
import type { PourValidation, Marker } from '@/api/database';
import { C } from '@/constants/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropRow   = { key: string; defaultVal: string };
export type RefOption = { id: string; nom: string; site_id?: string; installation_id?: string | null };

export const SYSTEM_PROPS = ['marker-color', 'marker-size'];

// ── Badges ────────────────────────────────────────────────────────────────────

export const TYPE_META: Record<PourValidation['entity_type'], { label: string; color: string }> = {
  fichier_pdf: { label: 'Fichier PDF', color: C.accent },
  plan:        { label: 'Plan SVG',    color: C.success },
  calque:      { label: 'Calque',      color: '#CA5010' },
};

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: color + '22', color, border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export function RattachBadge({ value }: { value: boolean }) {
  return value
    ? <Pill label="Avec" color={C.accent} />
    : <Pill label="Sans" color={C.muted} />;
}

// ── Icônes ────────────────────────────────────────────────────────────────────

export function IconPdf({ size = 16, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

export function IconPlan({ size = 16, color = C.success }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/>
      <line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  );
}

export function IconCalque({ size = 16, color = '#CA5010' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 12 12 17 22 12"/>
      <polyline points="2 17 12 22 22 17"/>
    </svg>
  );
}

export function EntityIcon({ type, size = 16 }: { type: PourValidation['entity_type']; size?: number }) {
  if (type === 'fichier_pdf') return <IconPdf size={size} />;
  if (type === 'plan')        return <IconPlan size={size} />;
  return <IconCalque size={size} />;
}

// ── Formatage ─────────────────────────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'à l\'instant';
  const m = Math.floor(s / 60);
  if (m < 60)  return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function payloadNom(pv: PourValidation): string {
  return (pv.payload as { nom?: string })?.nom ?? '—';
}

// ── SVG colorisé ─────────────────────────────────────────────────────────────

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']javascript:[^"']*["']/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
}

export function ColoredSvgSmall({ url, color, size = 28 }: { url: string; color?: string | null; size?: number }) {
  const [raw, setRaw] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setRaw(''); return; }
    let live = true;
    const load = (src: string) => fetch(src).then(r => r.ok ? r.text() : null);
    load(url)
      .then(t => t ?? load('/defmarker.svg'))
      .then(t => { if (live) setRaw(t ?? ''); })
      .catch(() => { if (live) setRaw(''); });
    return () => { live = false; };
  }, [url]);
  const html = useMemo(() => {
    if (!raw) return '';
    const safe = sanitizeSvg(raw);
    if (!color) return safe;
    const skip = (v: string) => { const t = v.trim().toLowerCase(); return t === 'none' || t === 'transparent' || t.startsWith('url(') || t === 'white' || t === '#fff' || t === '#ffffff'; };
    return safe
      .replace(/\bfill(?![-a-zA-Z])\s*:\s*([^;}"'\s]+)/gi, (_, val) => skip(val) ? `fill:${val}` : `fill:${color}`)
      .replace(/\bfill="([^"]*)"/gi, (_, val) => skip(val) ? `fill="${val}"` : `fill="${color}"`);
  }, [raw, color]);
  if (raw === null) return <div style={{ width: size, height: size, background: C.border, borderRadius: 4, flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Picker de marqueur ────────────────────────────────────────────────────────

export function MarkerPickerDropdown({ markers, value, onChange }: {
  markers: Marker[];
  value: string | null;
  onChange: (path: string | null, couleur: string | null) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, [open]);

  const q        = search.trim().toLowerCase();
  const filtered = q ? markers.filter(m => m.nom.toLowerCase().includes(q) || m.mots_cles.some(k => k.includes(q))) : markers;
  const selected = value ? markers.find(m => m.storage_path === value) ?? null : null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 10px', minHeight: 36,
          background: C.bg, border: `1px solid ${open ? C.accent : C.border}`, borderRadius: 7, cursor: 'pointer',
          color: selected ? C.text : C.muted, fontSize: 12, boxSizing: 'border-box', transition: 'border-color .15s' }}>
        {selected ? (
          <>
            <ColoredSvgSmall url={selected.public_url} color={selected.couleur} size={20} />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.nom}</span>
            <span role="button" onClick={e => { e.stopPropagation(); onChange(null, null); }}
              style={{ color: C.danger, fontSize: 15, padding: '0 2px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }} title="Retirer l'icône">×</span>
          </>
        ) : (
          <span style={{ flex: 1, textAlign: 'left' }}>— Aucune icône —</span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: C.surface2,
          border: `1px solid ${C.border}`, borderRadius: 9, zIndex: 999, maxHeight: 280, display: 'flex',
          flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou mot-clé…"
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '5px 9px', fontSize: 12, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', padding: 8 }}>
            {filtered.length === 0
              ? <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, padding: '14px 0' }}>Aucun marker trouvé</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
                  {filtered.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => { onChange(m.storage_path, m.couleur); setOpen(false); setSearch(''); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px',
                        background: value === m.storage_path ? C.accent22 : C.surface,
                        border: `1px solid ${value === m.storage_path ? C.accent : C.border}`,
                        borderRadius: 8, cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
                      <ColoredSvgSmall url={m.public_url} color={m.couleur} size={32} />
                      <span style={{ fontSize: 10, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>{m.nom}</span>
                    </button>
                  ))}
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text }}>{value}</div>
    </div>
  );
}
