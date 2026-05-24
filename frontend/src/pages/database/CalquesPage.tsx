import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db, type Calque, type Marker } from '@/api/database';
import { Modal } from '@/components/Modal';
import { C } from '@/constants/colors';

const btn = (color = C.accent, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
  borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  background: outlined ? 'transparent' : color + '22',
  border: `1px solid ${outlined ? C.border : color + '55'}`,
  color: outlined ? C.muted : color,
} as React.CSSProperties);

const iconBtn = (color = C.muted) => ({
  background: 'transparent', border: 'none', cursor: 'pointer', color,
  padding: '3px 4px', borderRadius: 5, display: 'flex', alignItems: 'center',
} as React.CSSProperties);

const inp = {
  width: '100%', padding: '8px 11px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' as const,
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function ChevronDown() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function SiteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function LayerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function SpinnerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
}
function GripIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>;
}
function ReorderIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="5" x2="20" y2="5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="19" x2="20" y2="19"/></svg>;
}

// ── Constantes ────────────────────────────────────────────────────────────────

type PropRow = { key: string; defaultVal: string };
const SYSTEM_PROPS = ['marker-color', 'marker-size'];

const GRID = '44px minmax(0,0.4fr) 130px 52px 44px minmax(0,1fr) 110px';

// ── Badges ────────────────────────────────────────────────────────────────────

function OwnerChip({ nom }: { nom: string }) {
  if (!nom) return <span style={{ fontSize: 11, color: C.muted }}>—</span>;
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90, display: 'inline-block' }}>
      {nom}
    </span>
  );
}

// ── SVG colorisé ──────────────────────────────────────────────────────────────

function ColoredSvgSmall({ url, color, size = 28 }: { url: string; color?: string | null; size?: number }) {
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
    if (!color) return raw;
    const skip = (v: string) => { const t = v.trim().toLowerCase(); return t === 'none' || t === 'transparent' || t.startsWith('url(') || t === 'white' || t === '#fff' || t === '#ffffff'; };
    return raw
      .replace(/\bfill(?![-a-zA-Z])\s*:\s*([^;}"'\s]+)/gi, (_, val) => skip(val) ? `fill:${val}` : `fill:${color}`)
      .replace(/\bfill="([^"]*)"/gi, (_, val) => skip(val) ? `fill="${val}"` : `fill="${color}"`);
  }, [raw, color]);
  if (raw === null) return <div style={{ width: size, height: size, background: C.border, borderRadius: 4, flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Marker picker dropdown ────────────────────────────────────────────────────

function MarkerPickerDropdown({ markers, value, onChange }: {
  markers: Marker[];
  value: string | null;
  onChange: (path: string | null, couleur: string | null) => void;
}) {
  const [open, setOpen]     = useState(false);
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
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 10px', minHeight: 36, background: C.bg, border: `1px solid ${open ? C.accent : C.border}`, borderRadius: 7, cursor: 'pointer', color: selected ? C.text : C.muted, fontSize: 12, boxSizing: 'border-box' as const, transition: 'border-color .15s' }}
      >
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
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, zIndex: 999, maxHeight: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou mot-clé…"
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 9px', fontSize: 12, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ overflowY: 'auto', padding: 8 }}>
            {filtered.length === 0
              ? <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, padding: '14px 0' }}>Aucun marker trouvé</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
                  {filtered.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => { onChange(m.storage_path, m.couleur); setOpen(false); setSearch(''); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', background: value === m.storage_path ? C.accent22 : C.surface, border: `1px solid ${value === m.storage_path ? C.accent : C.border}`, borderRadius: 8, cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                    >
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

// ── Calque géo modal ──────────────────────────────────────────────────────────

type CalqueGeoForm = {
  nom: string; description: string; is_downloadable: boolean;
  niveau_accreditation: number; zoom_min: number | null; zoom_max: number | null;
  icone_path: string | null; couleur: string;
  template_champs: Record<string, unknown> | null;
  owner_id: string | null;
};

function CalqueGeoModal({ initial, siteId, siteNom, onSave, onClose }: {
  initial?: Partial<Calque>;
  siteId: string;
  siteNom: string;
  onSave: (data: CalqueGeoForm) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<CalqueGeoForm>({
    nom:                  initial?.nom ?? '',
    description:          initial?.description ?? '',
    is_downloadable:      initial?.is_downloadable ?? false,
    niveau_accreditation: initial?.niveau_accreditation ?? 0,
    zoom_min:             initial?.zoom_min  ?? (isEdit ? null : 1),
    zoom_max:             initial?.zoom_max  ?? (isEdit ? null : 24),
    icone_path:           initial?.icone_path ?? null,
    couleur:              initial?.couleur ?? '',
    template_champs:      initial?.template_champs ?? null,
    owner_id:             initial?.owner_id ?? null,
  });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [users,   setUsers]   = useState<{ id: string; nom: string }[]>([]);
  void siteId;

  const initTpl = initial?.template_champs as { geometry?: { type?: string }; properties?: Record<string, unknown> } | null | undefined;
  const [propsList, setPropsList] = useState<PropRow[]>(
    initTpl?.properties
      ? Object.entries(initTpl.properties).filter(([k]) => !SYSTEM_PROPS.includes(k)).map(([k, v]) => ({ key: k, defaultVal: String(v ?? '') }))
      : [],
  );

  useEffect(() => {
    db.listMarkers().then(({ data }) => setMarkers(data ?? [])).catch(() => {});
    db.listUsers().then(({ data }) => setUsers(data ?? [])).catch(() => {});
  }, []);

  function spinBtn(style: React.CSSProperties): React.CSSProperties {
    return { width: 32, height: 36, flexShrink: 0, background: 'transparent', border: 'none', fontSize: 20, fontWeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setErr('Le nom est requis.'); return; }
    if (!form.owner_id)   { setErr('Le propriétaire est requis.'); return; }
    setSaving(true); setErr('');
    const validProps = propsList.filter(p => p.key.trim());
    const userMap = Object.fromEntries(validProps.map(p => [p.key.trim(), p.defaultVal || null]));
    const existingProps = (initial?.template_champs as { properties?: Record<string, unknown> } | null)?.properties ?? {};
    const properties: Record<string, unknown> = { ...userMap };
    if (!('marker-color' in properties)) properties['marker-color'] = existingProps['marker-color'] ?? form.couleur ?? null;
    if (!('marker-size'  in properties)) properties['marker-size']  = existingProps['marker-size']  ?? 'medium';
    const template_champs = { type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties };
    try { await onSave({ ...form, template_champs }); onClose(); }
    catch (e) {
      const msg = (e as { response?: { data?: { error?: { details?: string; message?: string } } } })?.response?.data?.error;
      setErr(msg?.details ?? msg?.message ?? 'Erreur lors de la sauvegarde.');
    }
    finally { setSaving(false); }
  }

  return (
    <Modal
      title={initial?.id ? `Modifier — ${initial.nom ?? ''}` : `Nouveau calque — ${siteNom}`}
      onClose={onClose}
      maxWidth={560}
      error={err}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btn(C.muted, true)} onClick={onClose}>Annuler</button>
          <button type="submit" form="calque-geo-form" disabled={saving} style={btn(C.accent)}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      }
    >
      <form id="calque-geo-form" onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Nom *</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inp} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0, height: 36 }}>
              <div
                onClick={() => setForm(f => ({ ...f, is_downloadable: !f.is_downloadable }))}
                style={{ width: 36, height: 20, borderRadius: 10, background: form.is_downloadable ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}
              >
                <div style={{ position: 'absolute', top: 3, left: form.is_downloadable ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 13, color: C.text }}>{form.is_downloadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
            </label>
          </div>

          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Propriétaire <span style={{ color: C.danger }}>*</span></label>
            <select
              value={form.owner_id ?? ''}
              onChange={e => setForm(f => ({ ...f, owner_id: e.target.value || null }))}
              style={{ ...inp, height: 36, cursor: 'pointer', borderColor: !form.owner_id ? C.danger88 : undefined }}
            >
              <option value="">— Sélectionner un propriétaire —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.nom}</option>
              ))}
            </select>
          </div>

          {/* Icône + Couleur */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Icône</label>
              <MarkerPickerDropdown markers={markers} value={form.icone_path}
                onChange={(path, couleur) => setForm(f => ({ ...f, icone_path: path, couleur: couleur ?? f.couleur }))} />
            </div>
            <div style={{ flexShrink: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Couleur</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" value={form.couleur || '#378ADD'}
                  onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                  style={{ width: 36, height: 36, border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', padding: 2 }} />
                <input value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                  style={{ ...inp, width: 88 }} placeholder="#rrggbb" />
              </div>
            </div>
          </div>

          {/* Accréditation + Zoom mini + Zoom maxi */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Accréditation (0–3)</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden', boxSizing: 'border-box' }}>
                <button type="button" disabled={form.niveau_accreditation <= 0}
                  style={spinBtn({ color: form.niveau_accreditation <= 0 ? C.border : C.accent, cursor: form.niveau_accreditation <= 0 ? 'not-allowed' : 'pointer' })}
                  onClick={() => setForm(f => ({ ...f, niveau_accreditation: Math.max(0, f.niveau_accreditation - 1) }))}>−</button>
                <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                <input type="text" inputMode="numeric" value={String(form.niveau_accreditation)}
                  onChange={e => { const n = parseInt(e.target.value, 10); setForm(f => ({ ...f, niveau_accreditation: isNaN(n) ? 0 : Math.min(3, Math.max(0, n)) })); }}
                  style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.text, outline: 'none', minWidth: 0 }} />
                <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                <button type="button" disabled={form.niveau_accreditation >= 3}
                  style={spinBtn({ color: form.niveau_accreditation >= 3 ? C.border : C.accent, cursor: form.niveau_accreditation >= 3 ? 'not-allowed' : 'pointer' })}
                  onClick={() => setForm(f => ({ ...f, niveau_accreditation: Math.min(3, f.niveau_accreditation + 1) }))}>+</button>
              </div>
            </div>
            {(['zoom_min', 'zoom_max'] as const).map(key => (
              <div key={key} style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>{key === 'zoom_min' ? 'Zoom mini' : 'Zoom maxi'}</label>
                <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden', boxSizing: 'border-box' }}>
                  <button type="button" disabled={form[key] === null}
                    style={spinBtn({ color: form[key] === null ? C.border : C.accent, cursor: form[key] === null ? 'not-allowed' : 'pointer' })}
                    onClick={() => setForm(f => ({ ...f, [key]: f[key] === null ? null : f[key] === 0 ? null : (f[key] as number) - 1 }))}>−</button>
                  <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                  <input type="text" inputMode="numeric" value={form[key] === null ? '' : String(form[key])} placeholder="—"
                    onChange={e => { const n = parseInt(e.target.value, 10); setForm(f => ({ ...f, [key]: e.target.value === '' ? null : isNaN(n) ? f[key] : Math.min(22, Math.max(0, n)) })); }}
                    style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: form[key] === null ? C.muted : C.text, outline: 'none', minWidth: 0 }} />
                  <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                  <button type="button" disabled={form[key] !== null && (form[key] as number) >= 22}
                    style={spinBtn({ color: form[key] !== null && (form[key] as number) >= 22 ? C.border : C.accent, cursor: form[key] !== null && (form[key] as number) >= 22 ? 'not-allowed' : 'pointer' })}
                    onClick={() => setForm(f => ({ ...f, [key]: f[key] === null ? 0 : Math.min(22, (f[key] as number) + 1) }))}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Template GeoJSON */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 2px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Template GeoJSON</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Propriétés</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {propsList.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6 }}>
                  <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clé</span>
                  <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valeur par défaut</span>
                  <span />
                </div>
              )}
              {propsList.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6, alignItems: 'center' }}>
                  <input value={row.key} placeholder="nom_champ"
                    onChange={e => setPropsList(prev => prev.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                    style={{ ...inp, height: 32, fontSize: 12, fontFamily: 'monospace' }} />
                  <input value={row.defaultVal} placeholder="(vide)"
                    onChange={e => setPropsList(prev => prev.map((r, j) => j === i ? { ...r, defaultVal: e.target.value } : r))}
                    style={{ ...inp, height: 32, fontSize: 12 }} />
                  <button type="button" onClick={() => setPropsList(prev => prev.filter((_, j) => j !== i))}
                    style={{ width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.danger, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setPropsList(prev => [...prev, { key: '', defaultVal: '' }])}
                style={{ ...btn(C.accent), alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px' }}>
                <PlusIcon /> Ajouter une propriété
              </button>
            </div>
          </div>

        </div>
      </form>
    </Modal>
  );
}

// ── Site row ──────────────────────────────────────────────────────────────────

type Site = { id: string; nom: string };

function SiteRow({ site, canWrite }: { site: Site; canWrite: boolean }) {
  const [open,        setOpen]        = useState(false);
  const [calques,     setCalques]     = useState<Calque[] | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [addModal,    setAddModal]    = useState(false);
  const [editCalque,  setEditCalque]  = useState<Calque | null>(null);
  const [delCalque,   setDelCalque]   = useState<Calque | null>(null);
  const [reorderModal,    setReorderModal]    = useState(false);
  const [reorderList,     setReorderList]     = useState<Calque[]>([]);
  const [reordering,      setReordering]      = useState(false);
  const [dragOverIdx,     setDragOverIdx]     = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await db.listCalquesGeo(site.id); setCalques(data ?? []); }
    catch { setCalques([]); }
    finally { setLoading(false); }
  }, [site.id]);

  useEffect(() => { load(); }, [load]);

  async function saveCalque(form: CalqueGeoForm, calque?: Calque) {
    const payload = {
      ...form,
      site_id:  site.id,
      type:     'geographique',
      couleur:  form.couleur || null,
      owner_id: form.owner_id || null,
    };
    if (calque) await db.updateCalque(calque.id, payload as Record<string, unknown>);
    else        await db.createCalque(payload as Record<string, unknown>);
    await load();
  }

  async function confirmDelete() {
    if (!delCalque) return;
    await db.removeCalque(delCalque.id);
    setDelCalque(null);
    await load();
  }

  function openReorder() { setReorderList([...(calques ?? [])]); setReorderModal(true); }
  function onDragStart(i: number) { dragIdx.current = i; }
  function onDragEnter(i: number) { if (dragIdx.current !== null && dragIdx.current !== i) setDragOverIdx(i); }
  function onDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    const src = dragIdx.current;
    if (src !== null && src !== i) setReorderList(prev => { const n = [...prev]; const [it] = n.splice(src, 1); n.splice(i, 0, it); return n; });
    dragIdx.current = null; setDragOverIdx(null);
  }
  function onDragEnd() { dragIdx.current = null; setDragOverIdx(null); }

  async function saveOrder() {
    setReordering(true);
    try { await Promise.all(reorderList.map((c, i) => db.updateCalque(c.id, { order: i }))); setReorderModal(false); await load(); }
    catch { }
    finally { setReordering(false); }
  }

  const count = calques?.length ?? 0;

  return (
    <>
      {/* Ligne site */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 42, borderBottom: `1px solid ${C.border22}` }}>
        {/* col1: chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setOpen(v => !v)} style={iconBtn(C.muted)}>{open ? <ChevronDown /> : <ChevronRight />}</button>
          <span style={{ display: 'flex', color: C.accent }}><SiteIcon /></span>
        </div>
        {/* col2: nom + badge count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', paddingRight: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.nom}</span>
          {count > 0 && (
            <span style={{ fontSize: 10, color: C.muted, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>{count}</span>
          )}
        </div>
        {/* col3–6: vides pour alignement */}
        <span /><span /><span />
        <span style={{ fontSize: 12, color: C.muted }}>{count === 0 ? 'Aucun calque' : ''}</span>
        {/* col7: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {canWrite && (
            <>
              <button title="Ajouter un calque" onClick={() => setAddModal(true)} style={iconBtn(C.success)}><PlusIcon /></button>
              {count > 1 && <button title="Réordonner" onClick={openReorder} style={iconBtn(C.muted)}><ReorderIcon /></button>}
            </>
          )}
        </div>
      </div>

      {/* Sous-lignes calques */}
      {open && (
        <div style={{ paddingBottom: 4 }}>
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 12px' }}>
              <div /><div style={{ padding: '8px 0', fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}><SpinnerIcon /> Chargement…</div>
            </div>
          )}
          {!loading && calques?.length === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 12px' }}>
              <div />
              <div style={{ padding: '8px 0', fontSize: 12, color: C.muted, gridColumn: '2 / -1' }}>
                Aucun calque géographique.{canWrite && ' Cliquez sur + pour en ajouter un.'}
              </div>
            </div>
          )}
          {!loading && calques?.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', minHeight: 36, borderBottom: `1px solid ${C.border18}`, paddingLeft: 12, paddingRight: 12 }}>
              {/* col1: layer icon — indent via paddingLeft pour garder l'alignement des autres colonnes */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 24, paddingRight: 4 }}>
                <span style={{ color: C.muted, display: 'flex' }}><LayerIcon /></span>
              </div>
              {/* col2: nom */}
              <span style={{ fontSize: 12, color: '#8AB4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{c.nom}</span>
              {/* col3: propriétaire */}
              <span title={c.owner_nom || undefined}><OwnerChip nom={c.owner_nom} /></span>
              {/* col4: accréditation */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: C.accent33, border: `1px solid ${C.accent66}`, fontSize: 11, fontWeight: 700, color: C.accent }}>{c.niveau_accreditation}</span>
              </div>
              {/* col5: icône SVG du calque */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.icone_public_url
                  ? <ColoredSvgSmall url={c.icone_public_url} color={c.icone_path ? (c.couleur || undefined) : (c.couleur || '#378ADD')} size={28} />
                  : null}
              </div>
              {/* col6: description */}
              <span title={c.description || undefined} style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 16, paddingRight: 8 }}>
                {c.description ? c.description.slice(0, 60) + (c.description.length > 60 ? '…' : '') : '—'}
              </span>
              {/* col7: actions */}
              <div style={{ display: 'flex', gap: 1 }}>
                {canWrite && (
                  <>
                    <button title="Modifier" onClick={() => setEditCalque(c)} style={iconBtn(C.muted)}><PencilIcon /></button>
                    <button title="Supprimer" onClick={() => setDelCalque(c)} style={iconBtn(C.danger)}><TrashIcon /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addModal && (
        <CalqueGeoModal siteId={site.id} siteNom={site.nom} onSave={form => saveCalque(form)} onClose={() => setAddModal(false)} />
      )}
      {editCalque && (
        <CalqueGeoModal initial={editCalque ?? undefined} siteId={site.id} siteNom={site.nom} onSave={form => saveCalque(form, editCalque)} onClose={() => setEditCalque(null)} />
      )}
      {delCalque && (
        <Modal
          title="Confirmation"
          onClose={() => setDelCalque(null)}
          maxWidth={400}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={() => setDelCalque(null)}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDelete}>Supprimer</button>
            </div>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer le calque « ${delCalque.nom} » ?`}</p>
        </Modal>
      )}
      {reorderModal && (
        <Modal
          title="Ordre — Calques"
          onClose={() => setReorderModal(false)}
          maxWidth={420}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btn(C.muted, true)} onClick={() => setReorderModal(false)} disabled={reordering}>Annuler</button>
              <button style={btn(C.accent)} onClick={saveOrder} disabled={reordering}>
                {reordering ? <><SpinnerIcon /> Sauvegarde…</> : 'Sauvegarder'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reorderList.map((c, i) => (
              <div key={c.id} draggable onDragStart={() => onDragStart(i)} onDragEnter={() => onDragEnter(i)}
                onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, i)} onDragEnd={onDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.surface, border: `1px solid ${dragOverIdx === i ? C.accent : C.border}`, borderRadius: 8, cursor: 'grab', userSelect: 'none', transition: 'border-color 0.1s', ...(dragOverIdx === i ? { background: '#12213A' } : {}) }}>
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex' }}><GripIcon /></span>
                <span style={{ fontSize: 13, color: '#8AB4D4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: C.muted }}>{site.nom}</p>
        </Modal>
      )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function CalquesPage() {
  const { user } = useAuth();
  const canWrite = user?.role === ROLES.ADMIN_APP || user?.role === ROLES.ADMIN_DATA;

  const [sites,   setSites]   = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    setLoading(true);
    db.list('sites')
      .then(({ data }) => setSites(data as Site[]))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? sites.filter(s => s.nom.toLowerCase().includes(search.trim().toLowerCase()))
    : sites;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Calques géographiques</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un site…"
          style={{ height: 34, padding: '0 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', width: 220, boxSizing: 'border-box' }} />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* En-tête colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 36, background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
          <span />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nom</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Propriétaire</span>
          <span />
          <span />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 16 }}>Description</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</span>
        </div>

        {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Chargement…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucun site trouvé.</div>}
        {!loading && filtered.map(s => <SiteRow key={s.id} site={s} canWrite={canWrite} />)}
      </div>
    </div>
  );
}
