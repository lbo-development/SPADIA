import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db, type FichierPdf } from '@/api/database';
import { Modal } from '@/components/Modal';

const C = {
  bg:      '#0E1117',
  surface: '#161B27',
  surface2:'#1C2333',
  border:  '#232B3E',
  text:    '#E8EDF5',
  muted:   '#6B7A99',
  accent:  '#378ADD',
  danger:  '#E05252',
  success: '#3DB07A',
  warn:    '#D4A017',
};

// ── Icons ────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function ChevronDown() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function FolderIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function FileIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
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
function GripIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>; }
function EyeIcon()     { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function ReorderIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="5" x2="20" y2="5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="19" x2="20" y2="19"/></svg>; }
function SpinnerIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>; }

// ── Types ────────────────────────────────────────────────────────────────────

type Option = { value: string; label: string; [key: string]: string };

type Dossier = {
  id: string;
  site_id: string;
  installation_id: string | null;
  nom: string;
  order: number;
  description: string | null;
  actif: boolean;
  site_nom: string;
  site_order: number;
  installation_nom: string;
  installation_order: number;
  created_at: string;
  updated_at: string;
};

const STATUT_LABELS: Record<string, string> = {
  'En attente':  'En attente',
  'A compléter': 'A compléter',
  'Validé':      'Validé',
  'Rejeté':      'Rejeté',
};
const STATUT_COLORS: Record<string, string> = {
  'En attente':  '#8B1A1A',
  'A compléter': '#C96A00',
  'Validé':      '#2A7A4B',
  'Rejeté':      '#6A3DB8',
};

// ── Statut badge ─────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: STATUT_COLORS[statut] + '22', color: STATUT_COLORS[statut] ?? C.muted, letterSpacing: 0.2 }}>
      {STATUT_LABELS[statut] ?? statut}
    </span>
  );
}

// ── Grid layout ──────────────────────────────────────────────────────────────
// col1: 48px (chevron+icon) | col2: 2fr NOM | col3: 160px SITE | col4: 150px INSTALL | col5: 1fr DESC | col6: 96px ACTIONS
const GRID = '48px minmax(0,0.31fr) 72px 154px 180px minmax(0,1fr) 96px';

// ── Shared styles ─────────────────────────────────────────────────────────────

const btn = (color = C.accent, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  background: outlined ? 'transparent' : color + '22',
  border: `1px solid ${outlined ? C.border : color + '55'}`,
  color: outlined ? C.muted : color,
  transition: 'opacity .15s',
});

const iconBtn = (color = C.muted) => ({
  background: 'transparent', border: 'none', cursor: 'pointer', color, padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center',
});

const inp = {
  width: '100%', padding: '8px 11px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' as const,
};

const sel = {
  height: 34, padding: '0 10px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', cursor: 'pointer',
} as const;

// ── Dossier modal (create / edit) ─────────────────────────────────────────────

type DossierFormData = { site_id: string; installation_id: string; nom: string; description: string; actif: boolean };

function DossierModal({
  initial, siteOptions, installOptions, onSave, onClose,
}: {
  initial?: Partial<Dossier>;
  siteOptions: Option[];
  installOptions: Option[];
  onSave: (data: DossierFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DossierFormData>({
    site_id:         initial?.site_id ?? '',
    installation_id: initial?.installation_id ?? '',
    nom:             initial?.nom ?? '',
    description:     initial?.description ?? '',
    actif:           initial?.actif !== undefined ? initial.actif : true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const filteredInstalls = form.site_id
    ? installOptions.filter(i => i.site_id === form.site_id)
    : [];

  const set = (k: keyof DossierFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (k === 'site_id') setForm(f => ({ ...f, site_id: e.target.value, installation_id: '' }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim() || !form.site_id) { setErr('Nom et Site sont requis.'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch { setErr('Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  }

  const title = initial?.id ? 'Modifier le dossier' : 'Nouveau dossier';

  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btn(C.muted, true)} onClick={onClose}>Annuler</button>
          <button type="submit" form="dossier-form" disabled={saving} style={btn(C.accent)}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      }
    >
      <form id="dossier-form" onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Site *</label>
            <select value={form.site_id} onChange={set('site_id')} style={{ ...inp, height: 36 }}>
              <option value="">Sélectionner un site</option>
              {siteOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Installation</label>
            <select value={form.installation_id} onChange={set('installation_id')} disabled={!form.site_id} style={{ ...inp, height: 36, opacity: form.site_id ? 1 : 0.4, cursor: form.site_id ? 'pointer' : 'not-allowed' }}>
              <option value="">Lié au site uniquement</option>
              {filteredInstalls.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Nom *</label>
            <input value={form.nom} onChange={set('nom')} style={inp} placeholder="Nom du dossier" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={set('description')} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Description…" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
              style={{ width: 36, height: 20, borderRadius: 10, background: form.actif ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}
            >
              <div style={{ position: 'absolute', top: 3, left: form.actif ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 13, color: C.text }}>Actif</span>
          </label>
        </div>
        {err && <p style={{ color: C.danger, fontSize: 12, margin: '12px 0 0' }}>{err}</p>}
      </form>
    </Modal>
  );
}

// ── Fichier modal (edit) ──────────────────────────────────────────────────────

type FichierFormData = { nom: string; description: string; statut: string; niveau_accreditation: number; is_uploadable: boolean };

function FichierModal({ fichier, onSave, onClose }: {
  fichier: FichierPdf;
  onSave: (data: FichierFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FichierFormData>({
    nom:                  fichier.nom,
    description:          fichier.description ?? '',
    statut:               fichier.statut,
    niveau_accreditation: fichier.niveau_accreditation,
    is_uploadable:        fichier.is_uploadable,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof FichierFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: k === 'niveau_accreditation' ? Number(e.target.value) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setErr('Le nom est requis.'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch { setErr('Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      title="Modifier le fichier"
      onClose={onClose}
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btn(C.muted, true)} onClick={onClose}>Annuler</button>
          <button type="submit" form="fichier-form" disabled={saving} style={btn(C.accent)}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      }
    >
      <form id="fichier-form" onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Nom *</label>
            <input value={form.nom} onChange={set('nom')} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={set('description')} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Statut</label>
              <select value={form.statut} onChange={set('statut')} style={{ ...inp, height: 36 }}>
                {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Niveau d'accréditation (0-4)</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
                <button type="button"
                  style={{ width: 38, height: 38, flexShrink: 0, background: 'transparent', border: 'none', color: form.niveau_accreditation <= 0 ? C.border : C.accent, fontSize: 20, fontWeight: 300, cursor: form.niveau_accreditation <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  disabled={form.niveau_accreditation <= 0}
                  onClick={() => setForm(f => ({ ...f, niveau_accreditation: Math.max(0, f.niveau_accreditation - 1) }))}
                >−</button>
                <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />
                <input
                  type="text" inputMode="numeric"
                  value={String(form.niveau_accreditation)}
                  onChange={e => { const n = parseInt(e.target.value, 10); setForm(f => ({ ...f, niveau_accreditation: isNaN(n) ? 0 : Math.min(4, Math.max(0, n)) })); }}
                  style={{ flex: 1, height: 38, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.text, outline: 'none', minWidth: 0 }}
                />
                <span style={{ fontSize: 10, color: C.muted, padding: '0 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>0–4</span>
                <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />
                <button type="button"
                  style={{ width: 38, height: 38, flexShrink: 0, background: 'transparent', border: 'none', color: form.niveau_accreditation >= 4 ? C.border : C.accent, fontSize: 20, fontWeight: 300, cursor: form.niveau_accreditation >= 4 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  disabled={form.niveau_accreditation >= 4}
                  onClick={() => setForm(f => ({ ...f, niveau_accreditation: Math.min(4, f.niveau_accreditation + 1) }))}
                >+</button>
              </div>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => setForm(f => ({ ...f, is_uploadable: !f.is_uploadable }))}
              style={{ width: 36, height: 20, borderRadius: 10, background: form.is_uploadable ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}
            >
              <div style={{ position: 'absolute', top: 3, left: form.is_uploadable ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 13, color: C.text }}>{form.is_uploadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
          </label>
        </div>
        {err && <p style={{ color: C.danger, fontSize: 12, margin: '12px 0 0' }}>{err}</p>}
      </form>
    </Modal>
  );
}

// ── Fichier details modal ─────────────────────────────────────────────────────

function FichierDetailsModal({ fichier, onClose }: { fichier: FichierPdf; onClose: () => void }) {
  const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('fr-FR') : null;
  const fmtDateTime = (v: string | null) => v ? new Date(v).toLocaleString('fr-FR') : '—';

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '10px 0', borderBottom: `1px solid ${C.border}22`,
  };
  const labelStyle: React.CSSProperties = {
    width: 140, flexShrink: 0, fontSize: 11, fontWeight: 600,
    color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, paddingTop: 2,
  };
  const valStyle: React.CSSProperties = { fontSize: 13, color: C.text, flex: 1 };

  return (
    <Modal
      title={fichier.nom}
      onClose={onClose}
      maxWidth={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={btn(C.muted, true)} onClick={onClose}>Fermer</button>
        </div>
      }
    >
      <div>
        {/* L1 — Dossier */}
        <div style={rowStyle}>
          <span style={labelStyle}>Dossier</span>
          <span style={valStyle}>{fichier.dossier_nom || '—'}</span>
        </div>

        {/* L2 — Description */}
        <div style={rowStyle}>
          <span style={labelStyle}>Description</span>
          <span style={{ ...valStyle, color: fichier.description ? C.text : C.muted, fontStyle: fichier.description ? 'normal' : 'italic' }}>
            {fichier.description || 'Aucune description'}
          </span>
        </div>

        {/* L3 — Proposé par … le … */}
        <div style={rowStyle}>
          <span style={labelStyle}>Proposé par</span>
          <span style={valStyle}>
            {fichier.proposedby_nom
              ? <>{fichier.proposedby_nom}{fichier.date_propose && <span style={{ marginLeft: 12, fontSize: 12, color: C.muted }}>le {fmtDate(fichier.date_propose)}</span>}</>
              : <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>
            }
          </span>
        </div>

        {/* L4 — Validé par … le … */}
        <div style={rowStyle}>
          <span style={labelStyle}>Validé par</span>
          <span style={valStyle}>
            {fichier.validateur_nom
              ? <>{fichier.validateur_nom}{fichier.date_validation && <span style={{ marginLeft: 12, fontSize: 12, color: C.muted }}>le {fmtDate(fichier.date_validation)}</span>}</>
              : <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>
            }
          </span>
        </div>

        {/* L5 — Statut */}
        <div style={rowStyle}>
          <span style={labelStyle}>Statut</span>
          <div style={{ flex: 1 }}><StatutBadge statut={fichier.statut} /></div>
        </div>

        {/* L6 — Niveau accréditation + Téléchargeable */}
        <div style={rowStyle}>
          <span style={labelStyle} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span title="Niveau d'accréditation" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: C.accent + '33', border: `1px solid ${C.accent}66`, fontSize: 11, fontWeight: 700, color: C.accent }}>
                {fichier.niveau_accreditation}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>Niveau d'accréditation</span>
            </div>
            {fichier.is_uploadable && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#C96A0033', color: '#C96A00' }}>Téléchargeable</span>
            )}
          </div>
        </div>

        {/* L7 — Dernière modification */}
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Dernière modif.</span>
          <span style={{ ...valStyle, color: C.muted, fontSize: 12 }}>{fmtDateTime(fichier.updated_at)}</span>
        </div>
      </div>
    </Modal>
  );
}

// ── Dossier row ───────────────────────────────────────────────────────────────

function DossierRow({
  dossier, canWrite, onEdit, onDelete, onAddFile,
}: {
  dossier: Dossier;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddFile: (file: File) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [fichiers, setFichiers] = useState<FichierPdf[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [editFichier,    setEditFichier]    = useState<FichierPdf | null>(null);
  const [deleteFichier,  setDeleteFichier]  = useState<FichierPdf | null>(null);
  const [detailsFichier, setDetailsFichier] = useState<FichierPdf | null>(null);
  const [uploading, setUploading] = useState(false);

  const [fichierReorderModal,  setFichierReorderModal]  = useState(false);
  const [fichierReorderList,   setFichierReorderList]   = useState<FichierPdf[]>([]);
  const [fichierReordering,    setFichierReordering]    = useState(false);
  const [fichierDragOverIdx,   setFichierDragOverIdx]   = useState<number | null>(null);
  const fichierDragIdx = useRef<number | null>(null);

  const loadFichiers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await db.listFichiersPdf(dossier.id);
      setFichiers(data ?? []);
    } catch { setFichiers([]); }
    finally { setLoading(false); }
  }, [dossier.id]);

  useEffect(() => { loadFichiers(); }, [loadFichiers]);

  function toggle() { setOpen(v => !v); }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setFileDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setUploading(true);
    try { await onAddFile(file); await loadFichiers(); if (!open) setOpen(true); }
    finally { setUploading(false); }
  }

  async function handleAddClick() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      setUploading(true);
      try { await onAddFile(file); await loadFichiers(); if (!open) setOpen(true); }
      finally { setUploading(false); }
    };
    input.click();
  }

  async function saveFichier(data: FichierFormData) {
    if (!editFichier) return;
    await db.updateFichier(editFichier.id, data as Record<string, unknown>);
    await loadFichiers();
  }

  async function confirmDeleteFichier() {
    if (!deleteFichier) return;
    await db.removeFichier(deleteFichier.id);
    setDeleteFichier(null);
    await loadFichiers();
  }

  async function openFichierReorder() {
    let list = fichiers;
    if (list === null) {
      setLoading(true);
      try { const { data } = await db.listFichiersPdf(dossier.id); list = data ?? []; setFichiers(list); }
      catch { list = []; }
      finally { setLoading(false); }
    }
    setFichierReorderList([...list]);
    setFichierReorderModal(true);
  }

  function onFichierReorderDragStart(idx: number) { fichierDragIdx.current = idx; }
  function onFichierReorderDragEnter(idx: number) {
    if (fichierDragIdx.current !== null && fichierDragIdx.current !== idx) setFichierDragOverIdx(idx);
  }
  function onFichierReorderDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const src = fichierDragIdx.current;
    if (src !== null && src !== targetIdx) {
      setFichierReorderList(prev => {
        const next = [...prev]; const [item] = next.splice(src, 1); next.splice(targetIdx, 0, item); return next;
      });
    }
    fichierDragIdx.current = null; setFichierDragOverIdx(null);
  }
  function onFichierReorderDragEnd() { fichierDragIdx.current = null; setFichierDragOverIdx(null); }

  async function handleSaveFichierOrder() {
    setFichierReordering(true);
    try {
      await Promise.all(fichierReorderList.map((f, i) => db.updateFichier(f.id, { order: i })));
      setFichierReorderModal(false);
      await loadFichiers();
    } catch { /* géré par l'intercepteur */ }
    finally { setFichierReordering(false); }
  }

  return (
    <>
      <div
        onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
        onDragLeave={() => setFileDragOver(false)}
        onDrop={handleDrop}
        style={{ background: fileDragOver ? C.accent + '18' : 'transparent', border: fileDragOver ? `1px solid ${C.accent}55` : '1px solid transparent', borderRadius: 8, transition: 'background .15s' }}
      >
        {/* Dossier row — grid aligned with header */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 42, borderBottom: `1px solid ${C.border}22` }}>
          {/* col1: chevron + folder icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={toggle} style={iconBtn(C.muted)}>{open ? <ChevronDown /> : <ChevronRight />}</button>
            <span style={{ color: C.accent, display: 'flex', alignItems: 'center' }}><FolderIcon /></span>
          </div>
          {/* col2: NOM */}
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{dossier.nom}</span>
          {/* col3: ACTIF */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: dossier.actif ? '#2A7A4B33' : '#8B1A1A33', color: dossier.actif ? '#2A7A4B' : '#8B1A1A' }}>{dossier.actif ? 'Actif' : 'Inactif'}</span>
          </div>
          {/* col4: SITE */}
          <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{dossier.site_nom || '—'}</span>
          {/* col5: INSTALLATION */}
          <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{dossier.installation_nom || '—'}</span>
          {/* col6: DESCRIPTION */}
          <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
            {dossier.description ? dossier.description.slice(0, 80) + (dossier.description.length > 80 ? '…' : '') : '—'}
          </span>
          {/* col6: ACTIONS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-start' }}>
            {uploading && <span style={{ fontSize: 10, color: C.muted, marginRight: 4 }}>…</span>}
            {canWrite && (
              <>
                <button title="Ajouter un fichier PDF" onClick={handleAddClick} style={iconBtn(C.accent)}><UploadIcon /></button>
                <button title="Modifier le dossier" onClick={onEdit} style={iconBtn(C.muted)}><PencilIcon /></button>
                <button title="Supprimer le dossier" onClick={onDelete} style={iconBtn(C.danger)}><TrashIcon /></button>
                {fichiers !== null && fichiers.length > 0 && (
                  <button title="Réordonner les fichiers" onClick={openFichierReorder} style={{ ...iconBtn(C.muted), marginLeft: 10 }}><ReorderIcon /></button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Fichiers sub-rows — indented under NOM column */}
        {open && (
          <div style={{ paddingBottom: 4 }}>
            {loading && (
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 12px' }}>
                <div /><div style={{ padding: '8px 0', fontSize: 12, color: C.muted }}>Chargement…</div>
              </div>
            )}
            {!loading && fichiers?.length === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '0 12px' }}>
                <div />
                <div style={{ padding: '8px 0', fontSize: 12, color: C.muted, gridColumn: '2 / -1' }}>
                  Aucun fichier.{canWrite && ' Déposez un PDF ici ou cliquez sur l\'icône upload.'}
                </div>
              </div>
            )}
            {!loading && fichiers?.map(f => (
              <div key={f.id} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 36, borderBottom: `1px solid ${C.border}18`, paddingLeft: 36 }}>
                {/* col1: indent + file icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: C.muted }}><FileIcon /></span>
                </div>
                {/* col2: NOM fichier */}
                <span style={{ fontSize: 12, color: '#B8A96A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{f.nom}</span>
                {/* col3: statut */}
                <span><StatutBadge statut={f.statut} /></span>
                {/* col4: niveau accréditation — pastille ronde */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span title="Niveau d'accréditation" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: C.accent + '33', border: `1px solid ${C.accent}66`, fontSize: 11, fontWeight: 700, color: C.accent, cursor: 'default' }}>{f.niveau_accreditation}</span>
                </div>
                {/* col5: is_uploadable */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {f.is_uploadable && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: '#C96A0033', color: '#C96A00' }}>Téléchargeable</span>
                  )}
                </div>
                {/* col6: actions */}
                <div style={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <button title="Détails" onClick={() => setDetailsFichier(f)} style={iconBtn(C.accent)}><EyeIcon /></button>
                  {canWrite && (
                    <>
                      <button title="Modifier" onClick={() => setEditFichier(f)} style={iconBtn(C.muted)}><PencilIcon /></button>
                      <button title="Supprimer" onClick={() => setDeleteFichier(f)} style={iconBtn(C.danger)}><TrashIcon /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editFichier && (
        <FichierModal
          fichier={editFichier}
          onSave={saveFichier}
          onClose={() => setEditFichier(null)}
        />
      )}
      {deleteFichier && (
        <Modal
          title="Confirmation"
          onClose={() => setDeleteFichier(null)}
          maxWidth={400}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={() => setDeleteFichier(null)}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDeleteFichier}>Supprimer</button>
            </div>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer le fichier « ${deleteFichier.nom} » ?`}</p>
        </Modal>
      )}
      {detailsFichier && (
        <FichierDetailsModal fichier={detailsFichier} onClose={() => setDetailsFichier(null)} />
      )}

      {fichierReorderModal && (
        <Modal
          title="Ordre — Fichiers"
          onClose={() => setFichierReorderModal(false)}
          maxWidth={420}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btn(C.muted, true)} onClick={() => setFichierReorderModal(false)} disabled={fichierReordering}>Annuler</button>
              <button style={btn(C.accent)} onClick={handleSaveFichierOrder} disabled={fichierReordering || fichierReorderList.length === 0}>
                {fichierReordering ? <><SpinnerIcon /> Sauvegarde…</> : 'Sauvegarder'}
              </button>
            </div>
          }
        >
          <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted }}>{dossier.nom}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fichierReorderList.length === 0 && (
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Aucun fichier dans ce dossier.</p>
            )}
            {fichierReorderList.map((f, i) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => onFichierReorderDragStart(i)}
                onDragEnter={() => onFichierReorderDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onFichierReorderDrop(e, i)}
                onDragEnd={onFichierReorderDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: C.surface, border: `1px solid ${fichierDragOverIdx === i ? C.accent : C.border}`,
                  borderRadius: 8, cursor: 'grab', userSelect: 'none', transition: 'border-color 0.1s, background 0.1s',
                  ...(fichierDragOverIdx === i ? { background: '#12213A' } : {}),
                }}
              >
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex' }}><GripIcon /></span>
                <span style={{ fontSize: 13, color: '#B8A96A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nom}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DossiersPage() {
  const { user }   = useAuth();
  const canWrite   = user?.role === ROLES.ADMIN_APP || user?.role === ROLES.ADMIN_DATA;

  const [dossiers,       setDossiers]       = useState<Dossier[]>([]);
  const [siteOptions,    setSiteOptions]    = useState<Option[]>([]);
  const [installOptions, setInstallOptions] = useState<Option[]>([]);
  const [siteFilter,     setSiteFilter]     = useState('');
  const [installFilter,  setInstallFilter]  = useState('');
  const [searchDesc,     setSearchDesc]     = useState('');
  const [loading,        setLoading]        = useState(true);
  const [siteSort,       setSiteSort]       = useState<'asc' | 'desc' | null>(null);

  const [dossierModal, setDossierModal] = useState<{ mode: 'create' | 'edit'; dossier?: Dossier } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dossier | null>(null);

  const [reorderModal, setReorderModal] = useState(false);
  const [reorderList,  setReorderList]  = useState<Dossier[]>([]);
  const [reordering,   setReordering]   = useState(false);
  const [dragOverIdx,  setDragOverIdx]  = useState<number | null>(null);
  const reorderDragIdx = useRef<number | null>(null);

  const DIRECT = '__direct__';

  const loadDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await db.list('dossiers');
      setDossiers((data ?? []) as unknown as Dossier[]);
    } catch { setDossiers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadDossiers();
    db.list('sites').then(({ data }) =>
      setSiteOptions((data as { id: string; nom: string }[]).map(s => ({ value: s.id, label: s.nom })))
    ).catch(() => {});
    db.list('installations').then(({ data }) =>
      setInstallOptions((data as { id: string; nom: string; site_id: string }[]).map(i => ({
        value: i.id, label: i.nom, site_id: i.site_id,
      })))
    ).catch(() => {});
  }, [loadDossiers]);

  const siteInstallOptions = siteFilter ? installOptions.filter(i => i.site_id === siteFilter) : [];

  const filtered = dossiers
    .filter(d => {
      if (siteFilter) {
        if (d.site_id !== siteFilter) return false;
        if (installFilter === DIRECT && d.installation_id) return false;
        if (installFilter && installFilter !== DIRECT && d.installation_id !== installFilter) return false;
      }
      if (searchDesc.trim() && !String(d.description ?? '').toLowerCase().includes(searchDesc.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (!siteSort) return 0;
      const dir = siteSort === 'asc' ? 1 : -1;
      if (a.site_order !== b.site_order) return (a.site_order - b.site_order) * dir;
      if (a.installation_order !== b.installation_order) return (a.installation_order - b.installation_order) * dir;
      return (a.order - b.order) * dir;
    });

  async function saveDossier(data: DossierFormData) {
    const payload = {
      site_id:         data.site_id,
      installation_id: data.installation_id || null,
      nom:             data.nom,
      description:     data.description || null,
      actif:           data.actif,
    };
    if (dossierModal?.mode === 'edit' && dossierModal.dossier) {
      await db.update('dossiers', dossierModal.dossier.id, payload);
    } else {
      await db.create('dossiers', payload);
    }
    await loadDossiers();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await db.remove('dossiers', deleteTarget.id);
    setDeleteTarget(null);
    await loadDossiers();
  }

  const reorderable = !!siteFilter && (installFilter === DIRECT || !!installFilter);

  function openReorder() { setReorderList([...filtered]); setReorderModal(true); }

  function onReorderDragStart(idx: number) { reorderDragIdx.current = idx; }
  function onReorderDragEnter(idx: number) {
    if (reorderDragIdx.current !== null && reorderDragIdx.current !== idx) setDragOverIdx(idx);
  }
  function onReorderDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const src = reorderDragIdx.current;
    if (src !== null && src !== targetIdx) {
      setReorderList(prev => {
        const next = [...prev]; const [item] = next.splice(src, 1); next.splice(targetIdx, 0, item); return next;
      });
    }
    reorderDragIdx.current = null; setDragOverIdx(null);
  }
  function onReorderDragEnd() { reorderDragIdx.current = null; setDragOverIdx(null); }

  async function handleSaveOrder() {
    setReordering(true);
    try {
      await Promise.all(reorderList.map((d, i) => db.update('dossiers', d.id, { order: i })));
      setReorderModal(false);
      await loadDossiers();
    } catch { /* géré par l'intercepteur */ }
    finally { setReordering(false); }
  }

  const uploadPdfForDossier = (dossier: Dossier) => async (file: File) => {
    const { data: upload } = await db.uploadPdf(file, dossier.id);
    await db.createFichier({
      dossier_id:   dossier.id,
      nom:          file.name.replace(/\.pdf$/i, ''),
      storage_path: upload.path,
    });
  };

  const selDisabled = { ...sel, cursor: 'not-allowed' as const, opacity: 0.4 };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Dossiers</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite && reorderable && (
            <button onClick={openReorder} title="Réordonner" style={{ width: 34, height: 34, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '50%', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ReorderIcon />
            </button>
          )}
          {canWrite && (
            <button style={btn(C.accent)} onClick={() => setDossierModal({ mode: 'create' })}>
              <PlusIcon /> Nouveau dossier
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Site</span>
          <select value={siteFilter} onChange={e => { setSiteFilter(e.target.value); setInstallFilter(''); }} style={sel}>
            <option value="">Tous les sites</option>
            {siteOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Périmètre</span>
          <select value={installFilter} onChange={e => setInstallFilter(e.target.value)} disabled={!siteFilter} style={siteFilter ? sel : selDisabled}>
            <option value="">Tous les dossiers du site</option>
            <option value={DIRECT}>Liés au site uniquement</option>
            {siteInstallOptions.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
        <input
          type="search"
          placeholder="Rechercher dans description…"
          value={searchDesc}
          onChange={e => setSearchDesc(e.target.value)}
          style={{ ...sel, padding: '0 12px', width: 220, height: 34 }}
        />
      </div>

      {/* Tree */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* Column header — same grid as dossier rows */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 36, background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
          <span />
          {(['Nom', 'Actif'] as const).map(label => (
            <span key={label} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          ))}
          <span
            onClick={() => setSiteSort(s => s === 'asc' ? 'desc' : 'asc')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', fontSize: 11, fontWeight: 600, color: siteSort ? C.accent : C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Site
            <span style={{ fontSize: 10, color: siteSort ? C.accent : C.muted, lineHeight: 1, opacity: siteSort ? 1 : 0.6 }}>
              {siteSort === 'asc' ? '▲' : siteSort === 'desc' ? '▼' : '⇅'}
            </span>
          </span>
          {(['Installation', 'Description'] as const).map(label => (
            <span key={label} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          ))}
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</span>
        </div>

        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Chargement…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucun dossier trouvé.</div>
        )}
        {!loading && filtered.map(d => (
          <DossierRow
            key={d.id}
            dossier={d}
            canWrite={canWrite}
            onEdit={() => setDossierModal({ mode: 'edit', dossier: d })}
            onDelete={() => setDeleteTarget(d)}
            onAddFile={uploadPdfForDossier(d)}
          />
        ))}
      </div>

      {/* Modals */}
      {dossierModal && (
        <DossierModal
          initial={dossierModal.dossier}
          siteOptions={siteOptions}
          installOptions={installOptions}
          onSave={saveDossier}
          onClose={() => setDossierModal(null)}
        />
      )}
      {deleteTarget && (
        <Modal
          title="Confirmation"
          onClose={() => setDeleteTarget(null)}
          maxWidth={400}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDelete}>Supprimer</button>
            </div>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer le dossier « ${deleteTarget.nom} » et tous ses fichiers ?`}</p>
        </Modal>
      )}

      {/* Modale réordonnancement */}
      {reorderModal && (
        <Modal
          title="Ordre — Dossiers"
          onClose={() => setReorderModal(false)}
          maxWidth={420}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btn(C.muted, true)} onClick={() => setReorderModal(false)} disabled={reordering}>Annuler</button>
              <button style={btn(C.accent)} onClick={handleSaveOrder} disabled={reordering}>
                {reordering ? <><SpinnerIcon /> Sauvegarde…</> : 'Sauvegarder'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reorderList.map((d, i) => (
              <div
                key={d.id}
                draggable
                onDragStart={() => onReorderDragStart(i)}
                onDragEnter={() => onReorderDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onReorderDrop(e, i)}
                onDragEnd={onReorderDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: C.surface, border: `1px solid ${dragOverIdx === i ? C.accent : C.border}`,
                  borderRadius: 8, cursor: 'grab', userSelect: 'none',
                  transition: 'border-color 0.1s, background 0.1s',
                  ...(dragOverIdx === i ? { background: '#12213A' } : {}),
                }}
              >
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex' }}><GripIcon /></span>
                <span style={{ fontSize: 13, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nom}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
