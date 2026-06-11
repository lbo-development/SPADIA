import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, type Calque, type Marker } from '@/api/database';
import { Modal } from '@/components/Modal';
import { C } from '@/constants/colors';

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function ChevronDown() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function LayerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function UploadIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
}
function GripIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>;
}
function ReorderIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="5" x2="20" y2="5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="19" x2="20" y2="19"/></svg>;
}
function SpinnerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Plan = {
  id: string;
  site_id: string;
  installation_id: string | null;
  nom: string;
  order: number;
  description: string | null;
  actif: boolean;
  editeur: string | null;
  svg_path: string | null;
  site_nom: string;
  site_order: number;
  installation_nom: string;
  installation_order: number;
  proposedby_id: string | null;
  proposedby_nom: string;
  validateur_id: string | null;
  validateur_nom: string;
  date_propose: string | null;
  date_validation: string | null;
  created_at: string;
  updated_at: string;
};

type PropRow       = { key: string; defaultVal: string };
type CalqueFormData = { nom: string; description: string; is_downloadable: boolean; type: string; niveau_accreditation: number; zoom_min: number | null; zoom_max: number | null; icone_path: string | null; couleur: string; template_champs: Record<string, unknown> | null; owner_id: string | null };

// ── Grid + Styles ─────────────────────────────────────────────────────────────

export const GRID = '48px minmax(0,0.31fr) 183px 56px 180px minmax(0,1fr) 120px';

const btn = (color = C.accent, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  background: outlined ? 'transparent' : color + '22',
  border: `1px solid ${outlined ? C.border : color + '55'}`,
  color: outlined ? C.muted : color,
  transition: 'opacity .15s',
});

const iconBtn = (color = C.muted) => ({
  background: 'transparent', border: 'none', cursor: 'pointer', color, padding: '3px 4px', borderRadius: 5, display: 'flex', alignItems: 'center',
});

const inp = {
  width: '100%', padding: '8px 11px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' as const,
};

// ── OwnerChip ─────────────────────────────────────────────────────────────────

function OwnerChip({ nom }: { nom: string }) {
  if (!nom) return <span style={{ fontSize: 11, color: C.muted }}>—</span>;
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
      {nom}
    </span>
  );
}

// ── SVG colorisé ─────────────────────────────────────────────────────────────

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']javascript:[^"']*["']/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
}

function ColoredSvgSmall({ url, color, size = 32 }: { url: string; color?: string | null; size?: number }) {
  const [raw, setRaw] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setRaw(''); return; }
    let live = true;
    const load = (src: string) => fetch(src).then(r => r.ok ? r.text() : null);
    load(url).then(t => t ?? load('/defmarker.svg')).then(t => { if (live) setRaw(t ?? ''); }).catch(() => { if (live) setRaw(''); });
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

// ── Marker picker ─────────────────────────────────────────────────────────────

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
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 10px', minHeight: 36, background: C.bg, border: `1px solid ${open ? C.accent : C.border}`, borderRadius: 7, cursor: 'pointer', color: selected ? C.text : C.muted, fontSize: 12, boxSizing: 'border-box', transition: 'border-color .15s' }}>
        {selected ? (
          <>
            <ColoredSvgSmall url={selected.public_url} color={selected.couleur} size={22} />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.nom}</span>
            <span role="button" onClick={e => { e.stopPropagation(); onChange(null, null); }} style={{ color: C.danger, fontSize: 15, padding: '0 2px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }} title="Retirer l'icône">×</span>
          </>
        ) : (
          <span style={{ flex: 1, textAlign: 'left' }}>— Aucune icône —</span>
        )}
        <ChevronDown />
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
                    <button key={m.id} type="button" onClick={() => { onChange(m.storage_path, m.couleur); setOpen(false); setSearch(''); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', background: value === m.storage_path ? C.accent22 : C.surface, border: `1px solid ${value === m.storage_path ? C.accent : C.border}`, borderRadius: 8, cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
                      <ColoredSvgSmall url={m.public_url} color={m.couleur} size={34} />
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

// ── CalqueModal ───────────────────────────────────────────────────────────────

const SYSTEM_PROPS = ['marker-color', 'marker-size'];

function CalqueModal({ initial, planId, planNom, onSave, onClose }: {
  initial?: Partial<Calque>;
  planId: string;
  planNom: string;
  onSave: (data: CalqueFormData) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<CalqueFormData>({
    nom:                  initial?.nom ?? '',
    description:          initial?.description ?? '',
    type:                 initial?.type ?? 'non_geographique',
    niveau_accreditation: initial?.niveau_accreditation ?? 0,
    zoom_min:             initial?.zoom_min  ?? (isEdit ? null : 1),
    zoom_max:             initial?.zoom_max  ?? (isEdit ? null : 24),
    icone_path:           initial?.icone_path ?? null,
    couleur:              initial?.couleur ?? '',
    template_champs:      initial?.template_champs ?? null,
    owner_id:             initial?.owner_id ?? null,
    is_downloadable:      initial?.is_downloadable ?? false,
  });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [users,   setUsers]   = useState<{ id: string; nom: string }[]>([]);
  void planId;

  const initTpl = initial?.template_champs as { geometry?: { type?: string }; properties?: Record<string, unknown> } | null | undefined;
  const [propsList, setPropsList] = useState<PropRow[]>(
    initTpl?.properties
      ? Object.entries(initTpl.properties)
          .filter(([k]) => !SYSTEM_PROPS.includes(k))
          .map(([k, v]) => ({ key: k, defaultVal: String(v ?? '') }))
      : [],
  );

  useEffect(() => {
    db.listMarkers().then(({ data }) => setMarkers(data ?? [])).catch(() => {});
    db.listUsers().then(({ data }) => setUsers(data ?? [])).catch(() => {});
  }, []);

  const set = (k: keyof CalqueFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

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
      title={initial?.id ? `Modifier — ${initial.nom ?? ''}` : `Nouveau calque — ${planNom}`}
      onClose={onClose} maxWidth={560} error={err}
      footer={
        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>Annuler</button>
          <button type="button" className="modal-btn modal-btn-save" disabled={saving} onClick={submit as unknown as React.MouseEventHandler}>{saving ? <><SpinnerIcon /> Enregistrement…</> : 'Enregistrer'}</button>
        </div>
      }
    >
      <form onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Nom *</label>
              <input value={form.nom} onChange={set('nom')} style={inp} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0, height: 36 }}>
              <div onClick={() => setForm(f => ({ ...f, is_downloadable: !f.is_downloadable }))}
                style={{ width: 36, height: 20, borderRadius: 10, background: form.is_downloadable ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: 3, left: form.is_downloadable ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 13, color: C.text }}>{form.is_downloadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
            </label>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={set('description')} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Propriétaire <span style={{ color: C.danger }}>*</span></label>
            <select value={form.owner_id ?? ''} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value || null }))}
              style={{ ...inp, height: 36, cursor: 'pointer', borderColor: !form.owner_id ? C.danger88 : undefined }}>
              <option value="">— Sélectionner un propriétaire —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Icône</label>
              <MarkerPickerDropdown markers={markers} value={form.icone_path}
                onChange={(path, couleur) => setForm(f => ({ ...f, icone_path: path, couleur: couleur ?? f.couleur }))} />
            </div>
            <div style={{ flexShrink: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Couleur</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" value={form.couleur || '#378ADD'} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                  style={{ width: 36, height: 36, border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                <input value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))} style={{ ...inp, width: 88 }} placeholder="#rrggbb" />
              </div>
            </div>
          </div>

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
            {(['zoom_min', 'zoom_max'] as const).map(key => {
              const val = form[key];
              const setter = (v: number | null) => setForm(f => ({ ...f, [key]: v }));
              return (
                <div key={key} style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>{key === 'zoom_min' ? 'Zoom mini' : 'Zoom maxi'}</label>
                  <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden', boxSizing: 'border-box' }}>
                    <button type="button" disabled={val === null} style={spinBtn({ color: val === null ? C.border : C.accent, cursor: val === null ? 'not-allowed' : 'pointer' })}
                      onClick={() => setter(val === null ? null : val === 0 ? null : val - 1)}>−</button>
                    <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                    <input type="text" inputMode="numeric" value={val === null ? '' : String(val)} placeholder="—"
                      onChange={e => { const n = parseInt(e.target.value, 10); setter(e.target.value === '' ? null : isNaN(n) ? val : Math.min(22, Math.max(0, n))); }}
                      style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: val === null ? C.muted : C.text, outline: 'none', minWidth: 0 }} />
                    <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                    <button type="button" disabled={val !== null && val >= 22} style={spinBtn({ color: val !== null && val >= 22 ? C.border : C.accent, cursor: val !== null && val >= 22 ? 'not-allowed' : 'pointer' })}
                      onClick={() => setter(val === null ? 0 : Math.min(22, val + 1))}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

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
                  <input value={row.key} onChange={e => setPropsList(prev => prev.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                    placeholder="nom_champ" style={{ ...inp, height: 32, fontSize: 12, fontFamily: 'monospace' }} />
                  <input value={row.defaultVal} onChange={e => setPropsList(prev => prev.map((r, j) => j === i ? { ...r, defaultVal: e.target.value } : r))}
                    placeholder="(vide)" style={{ ...inp, height: 32, fontSize: 12 }} />
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

// ── PlanRow ───────────────────────────────────────────────────────────────────

export function PlanRow({ plan, canWrite, onEdit, onDelete, onUploadSvg }: {
  plan: Plan;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUploadSvg: (file: File) => Promise<void>;
}) {
  const [open,          setOpen]          = useState(false);
  const [calques,       setCalques]       = useState<Calque[] | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [svgDragOver,   setSvgDragOver]   = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [editCalque,    setEditCalque]    = useState<Calque | null>(null);
  const [deleteCalque,       setDeleteCalque]       = useState<Calque | null>(null);
  const [deleteCalqueStats,  setDeleteCalqueStats]  = useState<{ pointCount: number } | null>(null);
  const [deleteCalqueStatsL, setDeleteCalqueStatsL] = useState(false);
  const [addCalque,     setAddCalque]     = useState(false);

  const [calqueReorderModal, setCalqueReorderModal] = useState(false);
  const [calqueReorderList,  setCalqueReorderList]  = useState<Calque[]>([]);
  const [calqueReordering,   setCalqueReordering]   = useState(false);
  const [calqueDragOverIdx,  setCalqueDragOverIdx]  = useState<number | null>(null);
  const calqueDragIdx = useRef<number | null>(null);

  const loadCalques = useCallback(async () => {
    setLoading(true);
    try { const { data } = await db.listCalques(plan.id); setCalques(data ?? []); }
    catch { setCalques([]); }
    finally { setLoading(false); }
  }, [plan.id]);

  useEffect(() => { loadCalques(); }, [loadCalques]);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setSvgDragOver(false);
    const file = e.dataTransfer.files[0]; if (!file) return;
    setUploading(true);
    try { await onUploadSvg(file); if (!open) setOpen(true); }
    finally { setUploading(false); }
  }

  async function handleSvgClick() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      setUploading(true);
      try { await onUploadSvg(file); }
      finally { setUploading(false); }
    };
    input.click();
  }

  async function saveCalque(data: CalqueFormData, isEdit: boolean, calque?: Calque) {
    const planContext = { plan_id: plan.id, site_id: null, installation_id: null };
    if (isEdit && calque) await db.updateCalque(calque.id, { ...data, ...planContext } as Record<string, unknown>);
    else await db.createCalque({ ...data, ...planContext } as Record<string, unknown>);
    await loadCalques();
  }

  async function requestDeleteCalque(calque: Calque) {
    setDeleteCalque(calque);
    setDeleteCalqueStats(null);
    setDeleteCalqueStatsL(true);
    try {
      const { data } = await db.listPoints(calque.id);
      setDeleteCalqueStats({ pointCount: (data ?? []).length });
    } catch {
      setDeleteCalqueStats({ pointCount: 0 });
    } finally {
      setDeleteCalqueStatsL(false);
    }
  }

  async function confirmDeleteCalque() {
    if (!deleteCalque) return;
    await db.removeCalque(deleteCalque.id);
    setDeleteCalque(null);
    setDeleteCalqueStats(null);
    await loadCalques();
  }

  function openCalqueReorder() { setCalqueReorderList([...(calques ?? [])]); setCalqueReorderModal(true); }
  function onCalqueDragStart(idx: number) { calqueDragIdx.current = idx; }
  function onCalqueDragEnter(idx: number) { if (calqueDragIdx.current !== null && calqueDragIdx.current !== idx) setCalqueDragOverIdx(idx); }
  function onCalqueDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const src = calqueDragIdx.current;
    if (src !== null && src !== targetIdx) {
      setCalqueReorderList(prev => { const next = [...prev]; const [item] = next.splice(src, 1); next.splice(targetIdx, 0, item); return next; });
    }
    calqueDragIdx.current = null; setCalqueDragOverIdx(null);
  }
  function onCalqueDragEnd() { calqueDragIdx.current = null; setCalqueDragOverIdx(null); }

  async function handleSaveCalqueOrder() {
    setCalqueReordering(true);
    try {
      await Promise.all(calqueReorderList.map((c, i) => db.updateCalque(c.id, { order: i })));
      setCalqueReorderModal(false);
      await loadCalques();
    } catch { }
    finally { setCalqueReordering(false); }
  }

  return (
    <>
      <div
        onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setSvgDragOver(true); }}
        onDragLeave={() => setSvgDragOver(false)}
        onDrop={handleDrop}
        style={{ background: svgDragOver ? C.accent18 : 'transparent', border: svgDragOver ? `1px solid ${C.accent55}` : '1px solid transparent', borderRadius: 8, transition: 'background .15s' }}
      >
        {/* Plan row */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 42, borderBottom: `1px solid ${C.border22}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setOpen(v => !v)} style={iconBtn(C.muted)}>{open ? <ChevronDown /> : <ChevronRight />}</button>
            <span title={plan.svg_path ? `SVG : ${plan.svg_path}` : 'Aucun SVG chargé'} style={{ width: 10, height: 10, borderRadius: '50%', background: plan.svg_path ? C.success : C.danger, flexShrink: 0, display: 'inline-block' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', paddingRight: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.nom}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: plan.actif ? '#2A7A4B33' : '#8B1A1A33', color: plan.actif ? '#2A7A4B' : '#8B1A1A' }}>
              {plan.actif ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{plan.site_nom || '—'}</span>
          <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{plan.installation_nom || '—'}</span>
          <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
            {plan.description ? plan.description.slice(0, 80) + (plan.description.length > 80 ? '…' : '') : '—'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start' }}>
            {uploading && <span style={{ color: '#9BA8C0', display: 'flex', alignItems: 'center', marginRight: 4, transform: 'scale(1.4)', transformOrigin: 'center' }}><SpinnerIcon /></span>}
            {canWrite && (
              <>
                <button title="Charger un SVG" onClick={handleSvgClick} style={iconBtn(C.accent)}><UploadIcon /></button>
                <button title="Ajouter un calque" onClick={() => setAddCalque(true)} style={iconBtn(C.success)}><PlusIcon /></button>
                <button title="Modifier le plan" onClick={onEdit} style={iconBtn(C.muted)}><PencilIcon /></button>
                <button title="Supprimer le plan" onClick={onDelete} style={iconBtn(C.danger)}><TrashIcon /></button>
                {calques !== null && calques.length > 0 && (
                  <button title="Réordonner les calques" onClick={openCalqueReorder} style={{ ...iconBtn(C.muted), marginLeft: 10 }}><ReorderIcon /></button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Calques */}
        {open && (
          <div style={{ paddingBottom: 4 }}>
            {loading && (
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 12px' }}>
                <div /><div style={{ padding: '8px 0', fontSize: 12, color: C.muted }}>Chargement…</div>
              </div>
            )}
            {!loading && calques?.length === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 12px' }}>
                <div />
                <div style={{ padding: '8px 0', fontSize: 12, color: C.muted, gridColumn: '2 / -1' }}>
                  Aucun calque.{canWrite && ' Cliquez sur + pour en ajouter un.'}
                </div>
              </div>
            )}
            {!loading && calques?.map(c => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 36, borderBottom: `1px solid ${C.border18}`, paddingLeft: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: C.muted }}><LayerIcon /></span>
                </div>
                <span style={{ fontSize: 12, color: '#8AB4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{c.nom}</span>
                <div style={{ minWidth: 0, overflow: 'hidden' }}><OwnerChip nom={c.owner_nom} /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span title="Niveau d'accréditation" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: C.accent33, border: `1px solid ${C.accent66}`, fontSize: 11, fontWeight: 700, color: C.accent, cursor: 'default' }}>{c.niveau_accreditation}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.icone_public_url && <ColoredSvgSmall url={c.icone_public_url} color={c.icone_path ? (c.couleur || undefined) : (c.couleur || '#378ADD')} size={30} />}
                </div>
                <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {c.description ? c.description.slice(0, 60) + (c.description.length > 60 ? '…' : '') : '—'}
                </span>
                <div style={{ display: 'flex', gap: 1, justifyContent: 'flex-start' }}>
                  {canWrite && (
                    <>
                      <button title="Modifier" onClick={() => setEditCalque(c)} style={iconBtn(C.muted)}><PencilIcon /></button>
                      <button title="Supprimer" onClick={() => requestDeleteCalque(c)} style={iconBtn(C.danger)}><TrashIcon /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addCalque && (
        <CalqueModal planId={plan.id} planNom={plan.nom} onSave={data => saveCalque(data, false)} onClose={() => setAddCalque(false)} />
      )}
      {editCalque && (
        <CalqueModal initial={editCalque} planId={plan.id} planNom={plan.nom} onSave={data => saveCalque(data, true, editCalque)} onClose={() => setEditCalque(null)} />
      )}
      {deleteCalque && (
        <Modal title="Confirmation" onClose={() => { setDeleteCalque(null); setDeleteCalqueStats(null); }}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={() => { setDeleteCalque(null); setDeleteCalqueStats(null); }}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDeleteCalque} disabled={deleteCalqueStatsL}>Supprimer</button>
            </div>
          }
        >
          {deleteCalqueStatsL ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted }}><SpinnerIcon /> Chargement…</div>
          ) : deleteCalqueStats && deleteCalqueStats.pointCount > 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: C.text }}>
              {`Supprimer le calque « ${deleteCalque.nom} » et ses ${deleteCalqueStats.pointCount} point${deleteCalqueStats.pointCount > 1 ? 's' : ''} ?`}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer le calque « ${deleteCalque.nom} » ?`}</p>
          )}
        </Modal>
      )}

      {calqueReorderModal && (
        <Modal title="Ordre — Calques" onClose={() => setCalqueReorderModal(false)} maxWidth={420}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btn(C.muted, true)} onClick={() => setCalqueReorderModal(false)} disabled={calqueReordering}>Annuler</button>
              <button style={btn(C.accent)} onClick={handleSaveCalqueOrder} disabled={calqueReordering}>
                {calqueReordering ? <><SpinnerIcon /> Sauvegarde…</> : 'Sauvegarder'}
              </button>
            </div>
          }
        >
          <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted }}>{plan.nom}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {calqueReorderList.map((c, i) => (
              <div key={c.id} draggable
                onDragStart={() => onCalqueDragStart(i)}
                onDragEnter={() => onCalqueDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onCalqueDrop(e, i)}
                onDragEnd={onCalqueDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.surface, border: `1px solid ${calqueDragOverIdx === i ? C.accent : C.border}`, borderRadius: 8, cursor: 'grab', userSelect: 'none', transition: 'border-color 0.1s', ...(calqueDragOverIdx === i ? { background: '#12213A' } : {}) }}
              >
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex' }}><GripIcon /></span>
                <span style={{ fontSize: 13, color: '#8AB4D4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
