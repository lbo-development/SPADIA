import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db, type PourValidation, type Marker, type FichierPdf, type Plan, type Calque } from '@/api/database';
import { Modal } from '@/components/Modal';
import { C } from '@/constants/colors';
import { inputStyle as inp, btnStyle, Label, FormSection, Spinner } from '@/components/ui';

// ── Types locaux ──────────────────────────────────────────────────────────────

type PropRow   = { key: string; defaultVal: string };
type RefOption = { id: string; nom: string; site_id?: string; installation_id?: string | null };

const SYSTEM_PROPS = ['marker-color', 'marker-size'];

// ── Badges ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<PourValidation['entity_type'], { label: string; color: string }> = {
  fichier_pdf: { label: 'Fichier PDF', color: C.accent },
  plan:        { label: 'Plan SVG',    color: C.success },
  calque:      { label: 'Calque',      color: '#CA5010' },
};

function Pill({ label, color }: { label: string; color: string }) {
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

function RattachBadge({ value }: { value: boolean }) {
  return value
    ? <Pill label="Avec" color={C.accent} />
    : <Pill label="Sans" color={C.muted} />;
}

// ── Icônes ────────────────────────────────────────────────────────────────────

function IconPdf({ size = 16, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function IconPlan({ size = 16, color = C.success }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/>
      <line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  );
}

function IconCalque({ size = 16, color = '#CA5010' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 12 12 17 22 12"/>
      <polyline points="2 17 12 22 22 17"/>
    </svg>
  );
}

function EntityIcon({ type, size = 16 }: { type: PourValidation['entity_type']; size?: number }) {
  if (type === 'fichier_pdf') return <IconPdf size={size} />;
  if (type === 'plan')        return <IconPlan size={size} />;
  return <IconCalque size={size} />;
}

// ── Formatage date ─────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'à l\'instant';
  const m = Math.floor(s / 60);
  if (m < 60)   return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function payloadNom(pv: PourValidation): string {
  return (pv.payload as { nom?: string })?.nom ?? '—';
}

// ── SVG colorisé (pour picker de marqueurs) ───────────────────────────────────

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']javascript:[^"']*["']/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
}

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

function MarkerPickerDropdown({ markers, value, onChange }: {
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

// ── Modale de traitement ─────────────────────────────────────────────────────

function TraiterModal({ pv, onClose, onUpdated }: {
  pv: PourValidation;
  onClose: () => void;
  onUpdated: (updated: PourValidation) => void;
}) {
  const { user } = useAuth();
  const initialPayload = pv.payload as { nom?: string; description?: string; is_uploadable?: boolean };

  const [nom,          setNom]          = useState(initialPayload.nom          ?? '');
  const [description,  setDescription]  = useState(initialPayload.description  ?? '');
  const [isUploadable, setIsUploadable] = useState(initialPayload.is_uploadable ?? false);
  const [comment,    setComment]    = useState(pv.commentaire_admin ?? '');
  const [newFile,    setNewFile]    = useState<File | null>(null);
  const [newPath,    setNewPath]    = useState<string | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [preview,    setPreview]    = useState(false);
  const [avecRattachement, setAvecRattachement] = useState(pv.avec_rattachement);
  const [siteId,     setSiteId]     = useState(pv.site_id      ?? '');
  const [installId,  setInstallId]  = useState(pv.installation_id ?? '');
  const [dossId,     setDossId]     = useState(pv.dossier_id   ?? '');
  const [sites,       setSites]       = useState<RefOption[]>([]);
  const [installations, setInstallations] = useState<RefOption[]>([]);
  const [dossiers,    setDossiers]    = useState<RefOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const typeMeta  = TYPE_META[pv.entity_type];
  const pvNom     = payloadNom(pv);
  const currentUrl = pv.storage_temp_public_url;
  const currentFilename = pv.storage_path_temp?.split('/').at(-1) ?? '—';
  const newFilename    = newFile?.name ?? null;

  useEffect(() => {
    db.list('sites').then(({ data }) =>
      setSites((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    ).catch(() => {});
    db.list('installations').then(({ data }) => setInstallations(data as RefOption[])).catch(() => {});
    db.list('dossiers').then(({ data }) => setDossiers(data as RefOption[])).catch(() => {});
  }, []);

  const filteredInstalls = siteId ? installations.filter(i => i.site_id === siteId) : [];
  const filteredDossiers = installId
    ? dossiers.filter(d => d.installation_id === installId)
    : siteId
      ? dossiers.filter(d => d.site_id === siteId && !d.installation_id)
      : [];

  function handleSiteChange(id: string)    { setSiteId(id); setInstallId(''); setDossId(''); }
  function handleInstallChange(id: string) { setInstallId(id); setDossId(''); }

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Seul le format PDF est accepté.');
      return;
    }
    setUploading(true); setError('');
    try {
      const { data } = await db.uploadPdfTemp(file);
      setNewFile(file);
      setNewPath(data.path);
    } catch {
      setError("Erreur lors de l'upload.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDecision(statut: 'Validé' | 'A compléter' | 'Rejeté' | 'En attente') {
    if (statut === 'Validé') {
      if (!avecRattachement)  { setError('Un rattachement est obligatoire pour valider.'); return; }
      if (!siteId)            { setError('Un site est requis pour le rattachement.'); return; }
      if (!dossId)            { setError('Un dossier est requis.'); return; }
    }
    setSubmitting(true); setError('');
    try {
      const finalPath = newPath || pv.storage_path_temp;
      const patch: Record<string, unknown> = {
        statut,
        commentaire_admin: comment.trim() || null,
      };
      if (newPath) patch.storage_path_temp = newPath;

      if (statut === 'Validé') {
        patch.validateur_id = user?.id;
        const now = new Date().toISOString();
        const { data: fichier } = await db.createFichier({
          dossier_id:    dossId || pv.dossier_id,
          nom:           nom.trim() || 'Sans titre',
          description:   description.trim() || null,
          storage_path:  finalPath,
          is_uploadable: isUploadable,
          proposedby_id: pv.proposedby_id,
          validateur_id: user?.id,
          date_validation: now,
        });
        patch.id_valide = fichier.id;
      }

      const { data } = await db.updatePourValidation(pv.id, patch);
      onUpdated(data);
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { details?: string; message?: string } } } })?.response?.data?.error;
      setError(msg?.details ?? msg?.message ?? 'Erreur lors de la mise à jour.');
    } finally {
      setSubmitting(false);
    }
  }

  const rattachOrigine = pv.avec_rattachement
    ? [pv.site_nom, pv.installation_nom, pv.dossier_nom].filter(Boolean).join(' › ')
    : null;

  return (
    <Modal
      title={`Traiter — ${pvNom}`}
      icon={<EntityIcon type={pv.entity_type} size={18} />}
      onClose={onClose}
      error={error}
      maxWidth={600}
      footer={
        pv.statut === 'Validé'
          ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, color: C.success }}>✓ Demande validée — statut non modifiable</span>
                {pv.id_valide && <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>ID : {pv.id_valide}</span>}
              </div>
              <button type="button" onClick={onClose} style={btnStyle(C.muted, true)}>Fermer</button>
            </div>
          : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button type="button" disabled={submitting} onClick={onClose}
                style={{ ...btnStyle(C.muted, true), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                Annuler
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={submitting} onClick={() => handleDecision('En attente')}
                  style={{ ...btnStyle(C.muted, true), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  En attente
                </button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Rejeté')}
                  style={{ ...btnStyle(C.danger, true), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  Rejeter
                </button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('A compléter')}
                  style={{ ...btnStyle(C.warning, true), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  A compléter
                </button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Validé')}
                  style={{ ...btnStyle(C.success), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? <><Spinner /> Traitement…</> : '✓ Valider'}
                </button>
              </div>
            </div>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Informations demande */}
      <FormSection title="Demande">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoRow label="Type"       value={<Pill label={typeMeta.label} color={typeMeta.color} />} />
          <InfoRow label="Proposé par" value={pv.proposedby_nom} />
          <InfoRow label="Date"       value={`${fullDate(pv.date_propose)} · ${relativeTime(pv.date_propose)}`} />
          <InfoRow label="Validateur" value={pv.validateur_nom} />
        </div>
        <InfoRow label="Rattachement d'origine" value={
          pv.avec_rattachement
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill label="Avec" color={C.accent} />
                {rattachOrigine && <span style={{ fontSize: 12, color: C.muted }}>{rattachOrigine}</span>}
              </span>
            : <Pill label="Sans rattachement" color={C.muted} />
        } />
        {pv.commentaire_admin && (
          <InfoRow label="Commentaire existant"
            value={<span style={{ fontStyle: 'italic', color: C.warning }}>{pv.commentaire_admin}</span>} />
        )}
      </FormSection>

      {/* Édition */}
      <FormSection title="Édition du fichier">
        <div>
          <Label>Nom *</Label>
          <input value={nom} onChange={e => setNom(e.target.value)} style={inp} placeholder="Nom du fichier" />
        </div>
        <div>
          <Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Description…" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={() => setIsUploadable(v => !v)}
            style={{ width: 36, height: 20, borderRadius: 10, background: isUploadable ? C.accent : C.border,
              position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ position: 'absolute', top: 3, left: isUploadable ? 19 : 3, width: 14, height: 14,
              borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: 13, color: C.text }}>{isUploadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
        </label>
      </FormSection>

      {/* Fichier courant + upload */}
      <FormSection title="Fichier PDF">
          {currentUrl && !newFile && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                <EntityIcon type={pv.entity_type} size={18} />
                <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentFilename}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const res  = await fetch(currentUrl!);
                      const blob = await res.blob();
                      const a    = document.createElement('a');
                      a.href     = URL.createObjectURL(blob);
                      a.download = currentFilename;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                    style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap',
                      padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
                      cursor: 'pointer', background: 'transparent' }}
                  >
                    ↓ Télécharger
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(p => !p)}
                    style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap',
                      padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
                      cursor: 'pointer', background: 'transparent' }}
                  >
                    {preview ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </div>

              {preview && (
                pv.entity_type === 'fichier_pdf'
                  ? <iframe
                      src={currentUrl}
                      style={{ width: '100%', height: 420, border: `1px solid ${C.border}`, borderRadius: 8, display: 'block' }}
                      title="Aperçu PDF"
                    />
                  : <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={currentUrl} alt="Aperçu SVG" style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }} />
                    </div>
              )}
            </>
          )}

          {newFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: C.surface2, border: `1px solid ${C.success44}`, borderRadius: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {newFilename}
              </span>
              <button type="button" onClick={() => { setNewFile(null); setNewPath(null); }}
                style={{ fontSize: 11, color: C.danger, background: 'transparent', border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                Retirer
              </button>
            </div>
          )}

      </FormSection>

      {/* Rattachement */}
      <FormSection title="Rattachement">
        <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} type="button"
              onClick={() => { setAvecRattachement(v); setSiteId(''); setInstallId(''); setDossId(''); }}
              style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: 'none', borderRadius: 6,
                background: avecRattachement === v ? C.accent : 'transparent',
                color:      avecRattachement === v ? '#fff'    : C.muted,
                transition: 'background .15s, color .15s' }}>
              {v ? 'Avec rattachement' : 'Sans rattachement'}
            </button>
          ))}
        </div>

        {avecRattachement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Label>Site *</Label>
              <select value={siteId} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">— Sélectionner un site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>

            {siteId && (
              <div>
                <Label>Installation (optionnel)</Label>
                <select value={installId} onChange={e => handleInstallChange(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">— Aucune —</option>
                  {filteredInstalls.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
                {filteredInstalls.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucune installation rattachée à ce site.</p>}
              </div>
            )}

            {siteId && (
              <div>
                <Label>Dossier *</Label>
                <select value={dossId} onChange={e => setDossId(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">{filteredDossiers.length === 0 ? '— Aucun dossier disponible —' : '— Sélectionner un dossier —'}</option>
                  {filteredDossiers.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
                {filteredDossiers.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucun dossier rattaché à cette sélection.</p>}
              </div>
            )}
          </div>
        )}

        {!avecRattachement && (
          <div>
            <Label>Dossier *</Label>
            <select value={dossId} onChange={e => setDossId(e.target.value)} style={{ ...inp, height: 36 }}>
              <option value="">— Sélectionner un dossier —</option>
              {dossiers.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
        )}
      </FormSection>

      {/* Décision */}
      <FormSection title="Décision administrative">
        <div>
          <Label>Commentaire (optionnel)</Label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Motif, instructions pour compléter, remarques…"
            style={{ ...inp, minHeight: 80, resize: 'vertical' }}
          />
        </div>
      </FormSection>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text }}>{value}</div>
    </div>
  );
}

// ── Modale de traitement calque ───────────────────────────────────────────────

function TraiterCalqueModal({ pv, onClose, onUpdated }: {
  pv: PourValidation;
  onClose: () => void;
  onUpdated: (updated: PourValidation) => void;
}) {
  const { user } = useAuth();
  const initialPayload = pv.payload as {
    nom?: string; description?: string; couleur?: string;
    zoom_min?: number | null; zoom_max?: number | null;
    template_champs?: { properties?: Record<string, unknown> } | null;
    niveau_accreditation?: number;
    is_downloadable?: boolean;
  };
  const initTpl = initialPayload.template_champs;

  const [nom,         setNom]         = useState(initialPayload.nom ?? '');
  const [description, setDescription] = useState(initialPayload.description ?? '');
  const [couleur,     setCouleur]     = useState(initialPayload.couleur ?? '#378ADD');
  const [nivelAccred, setNivelAccred] = useState(initialPayload.niveau_accreditation ?? 0);
  const [zoomMin,        setZoomMin]        = useState<number | null>(initialPayload.zoom_min ?? null);
  const [zoomMax,        setZoomMax]        = useState<number | null>(initialPayload.zoom_max ?? null);
  const [isDownloadable, setIsDownloadable] = useState(initialPayload.is_downloadable ?? false);
  const [iconePath,      setIconePath]      = useState<string | null>(null);
  const [propsList,   setPropsList]   = useState<PropRow[]>(() => {
    if (!initTpl?.properties) return [];
    return Object.entries(initTpl.properties)
      .filter(([k]) => !SYSTEM_PROPS.includes(k))
      .map(([k, v]) => ({ key: k, defaultVal: String(v ?? '') }));
  });

  const [avecRattachement, setAvecRattachement] = useState(pv.avec_rattachement);
  const [siteId,       setSiteId]       = useState(pv.site_id ?? '');
  const [installId,    setInstallId]    = useState(pv.installation_id ?? '');
  const [planId,       setPlanId]       = useState(pv.plan_id ?? '');

  const [sites,         setSites]         = useState<RefOption[]>([]);
  const [installations, setInstallations] = useState<RefOption[]>([]);
  const [plans,         setPlans]         = useState<RefOption[]>([]);
  const [markers,       setMarkers]       = useState<Marker[]>([]);
  const [comment,       setComment]       = useState(pv.commentaire_admin ?? '');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    db.list('sites').then(({ data }) => setSites((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))).catch(() => {});
    db.list('installations').then(({ data }) => setInstallations(data as RefOption[])).catch(() => {});
    db.list('plans').then(({ data }) => setPlans(data as RefOption[])).catch(() => {});
    db.listMarkers().then(({ data }) => setMarkers(data)).catch(() => {});
  }, []);

  const filteredInstalls = siteId ? installations.filter(i => i.site_id === siteId) : [];
  const filteredPlans    = installId
    ? plans.filter(p => p.installation_id === installId)
    : siteId
      ? plans.filter(p => p.site_id === siteId && !p.installation_id)
      : [];
  const calqueType: 'geographique' | 'non_geographique' = avecRattachement && !!installId ? 'non_geographique' : 'geographique';

  function handleSiteChange(id: string)    { setSiteId(id); setInstallId(''); setPlanId(''); }
  function handleInstallChange(id: string) { setInstallId(id); setPlanId(''); }

  async function handleDecision(statut: 'Validé' | 'A compléter' | 'Rejeté' | 'En attente') {
    if (statut === 'Validé') {
      if (!nom.trim())        { setError('Le nom est requis.'); return; }
      if (!avecRattachement)  { setError('Un rattachement est obligatoire pour valider.'); return; }
      if (!siteId)            { setError('Un site est requis pour le rattachement.'); return; }
    }
    setSubmitting(true); setError('');
    try {
      const patch: Record<string, unknown> = { statut, commentaire_admin: comment.trim() || null };

      if (statut === 'Validé') {
        patch.validateur_id = user?.id;
        const validProps = propsList.filter(p => p.key.trim());
        const userMap    = Object.fromEntries(validProps.map(p => [p.key.trim(), p.defaultVal || null]));
        const properties: Record<string, unknown> = { ...userMap };
        if (!('marker-color' in properties)) properties['marker-color'] = initTpl?.properties?.['marker-color'] ?? couleur ?? null;
        if (!('marker-size'  in properties)) properties['marker-size']  = initTpl?.properties?.['marker-size']  ?? 'medium';
        const template_champs = { type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties };

        const now = new Date().toISOString();
        const { data: calqueData } = await db.createCalque({
          nom:                  nom.trim(),
          description:          description.trim() || null,
          type:                 calqueType,
          niveau_accreditation: nivelAccred,
          icone_path:           iconePath,
          couleur:              couleur || null,
          zoom_min:             zoomMin,
          zoom_max:             zoomMax,
          is_downloadable:      isDownloadable,
          template_champs,
          plan_id:              avecRattachement && planId  ? planId  : null,
          site_id:              avecRattachement && !planId ? (siteId || null) : null,
          owner_id:             pv.proposedby_id,
          validateur_id:        user?.id,
          date_validation:      now,
        });
        patch.id_valide = calqueData.id;
      }

      const { data } = await db.updatePourValidation(pv.id, patch);
      onUpdated(data);
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { details?: string; message?: string } } } })?.response?.data?.error;
      setError(msg?.details ?? msg?.message ?? 'Erreur lors de la mise à jour.');
    } finally {
      setSubmitting(false);
    }
  }

  const spinBtnS = (off: boolean): React.CSSProperties => ({
    width: 32, height: 36, flexShrink: 0, background: 'transparent', border: 'none',
    fontSize: 20, fontWeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: off ? C.border : C.accent, cursor: off ? 'not-allowed' : 'pointer',
  });

  const db_ = (color: string, outlined = false): React.CSSProperties => ({
    ...btnStyle(color, outlined),
    opacity: submitting ? 0.5 : 1,
    cursor:  submitting ? 'not-allowed' : 'pointer',
  });

  const nom_ = payloadNom(pv);

  return (
    <Modal
      title={`Traiter le calque — ${nom_}`}
      icon={<EntityIcon type="calque" size={18} />}
      onClose={onClose}
      error={error}
      maxWidth={660}
      footer={
        pv.statut === 'Validé'
          ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, color: C.success }}>✓ Demande validée — statut non modifiable</span>
                {pv.id_valide && <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>ID : {pv.id_valide}</span>}
              </div>
              <button type="button" onClick={onClose} style={btnStyle(C.muted, true)}>Fermer</button>
            </div>
          : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button type="button" disabled={submitting} onClick={onClose} style={db_(C.muted, true)}>Annuler</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={submitting} onClick={() => handleDecision('En attente')} style={db_(C.muted, true)}>En attente</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Rejeté')}     style={db_(C.danger, true)}>Rejeter</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('A compléter')} style={db_(C.warning, true)}>A compléter</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Validé')}     style={db_(C.success)}>
                  {submitting ? <><Spinner /> Traitement…</> : '✓ Valider'}
                </button>
              </div>
            </div>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Résumé de la demande */}
      <FormSection title="Demande">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoRow label="Proposé par" value={pv.proposedby_nom} />
          <InfoRow label="Validateur"  value={pv.validateur_nom} />
          <InfoRow label="Date"        value={`${fullDate(pv.date_propose)} · ${relativeTime(pv.date_propose)}`} />
          <InfoRow label="Rattachement initial" value={<RattachBadge value={pv.avec_rattachement} />} />
        </div>
        {pv.commentaire_admin && (
          <InfoRow label="Commentaire existant"
            value={<span style={{ fontStyle: 'italic', color: C.warning }}>{pv.commentaire_admin}</span>} />
        )}
      </FormSection>

      {/* Champs du calque */}
      <FormSection title="Informations du calque">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>Nom *</Label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du calque" style={inp} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0, height: 36 }}>
            <div
              onClick={() => setIsDownloadable(v => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, background: isDownloadable ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}
            >
              <div style={{ position: 'absolute', top: 3, left: isDownloadable ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 13, color: C.text }}>{isDownloadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
          </label>
        </div>
        <div>
          <Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description optionnelle…" style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
        </div>

        {/* Icône + Couleur */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>Icône</Label>
            <MarkerPickerDropdown markers={markers} value={iconePath}
              onChange={(path, col) => { setIconePath(path); if (col) setCouleur(col); }} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <Label>Couleur</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="color" value={couleur || '#378ADD'} onChange={e => setCouleur(e.target.value)}
                style={{ width: 36, height: 36, border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', padding: 2 }} />
              <input value={couleur} onChange={e => setCouleur(e.target.value)}
                style={{ ...inp, width: 88 }} placeholder="#rrggbb" />
            </div>
          </div>
        </div>

        {/* Accréditation · Zoom mini · Zoom maxi — ligne homogène à 3 colonnes */}
        <div style={{ display: 'flex', gap: 12 }}>

          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>Accréditation (0–3)</Label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
              <button type="button" disabled={nivelAccred <= 0} style={spinBtnS(nivelAccred <= 0)}
                onClick={() => setNivelAccred(v => Math.max(0, v - 1))}>−</button>
              <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
              <input type="text" inputMode="numeric" value={String(nivelAccred)}
                onChange={e => { const n = parseInt(e.target.value, 10); setNivelAccred(isNaN(n) ? 0 : Math.min(3, Math.max(0, n))); }}
                style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.text, outline: 'none', minWidth: 0 }} />
              <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
              <button type="button" disabled={nivelAccred >= 3} style={spinBtnS(nivelAccred >= 3)}
                onClick={() => setNivelAccred(v => Math.min(3, v + 1))}>+</button>
            </div>
          </div>

          {([['zoom_min', zoomMin, setZoomMin], ['zoom_max', zoomMax, setZoomMax]] as const).map(([key, val, setter]) => (
            <div key={key} style={{ flex: 1, minWidth: 0 }}>
              <Label>{key === 'zoom_min' ? 'Zoom mini' : 'Zoom maxi'}</Label>
              <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
                <button type="button" disabled={val === null} style={spinBtnS(val === null)}
                  onClick={() => setter(v => v === null ? null : v === 0 ? null : (v as number) - 1)}>−</button>
                <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                <input type="text" inputMode="numeric" value={val === null ? '' : String(val)} placeholder="—"
                  onChange={e => { const n = parseInt(e.target.value, 10); setter(e.target.value === '' ? null : isNaN(n) ? val : Math.min(22, Math.max(0, n))); }}
                  style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: val === null ? C.muted : C.text, outline: 'none', minWidth: 0 }} />
                <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                <button type="button" disabled={val !== null && (val as number) >= 22} style={spinBtnS(val !== null && (val as number) >= 22)}
                  onClick={() => setter(v => v === null ? 0 : Math.min(22, (v as number) + 1))}>+</button>
              </div>
            </div>
          ))}

        </div>
      </FormSection>

      {/* Template GeoJSON */}
      <FormSection title="Template GeoJSON — propriétés">
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
            style={{ ...btnStyle(C.accent, true), alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px' }}>
            + Ajouter une propriété
          </button>
        </div>
      </FormSection>

      {/* Rattachement */}
      <FormSection title="Rattachement">
        <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} type="button"
              onClick={() => { setAvecRattachement(v); setSiteId(''); setInstallId(''); setPlanId(''); }}
              style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: 'none', borderRadius: 6,
                background: avecRattachement === v ? C.accent : 'transparent',
                color:      avecRattachement === v ? '#fff'    : C.muted,
                transition: 'background .15s, color .15s' }}>
              {v ? 'Avec rattachement' : 'Sans rattachement'}
            </button>
          ))}
        </div>

        {avecRattachement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Label>Site *</Label>
              <select value={siteId} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">— Sélectionner un site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>

            {siteId && (
              <div>
                <Label>Installation (optionnel)</Label>
                <select value={installId} onChange={e => handleInstallChange(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">— Aucune (calque géographique) —</option>
                  {filteredInstalls.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
                {filteredInstalls.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucune installation rattachée à ce site.</p>}
              </div>
            )}

            {siteId && (
              <div>
                <Label>Plan (optionnel)</Label>
                <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">{filteredPlans.length === 0 ? '— Aucun plan disponible —' : '— Aucun plan —'}</option>
                  {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                {filteredPlans.length === 0 && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucun plan rattaché à cette sélection.</p>}
              </div>
            )}

            {siteId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Type déduit :</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: installId ? C.accent : C.success }}>
                  {installId ? 'Non géographique' : 'Géographique'}
                </span>
              </div>
            )}
          </div>
        )}
      </FormSection>

      {/* Décision */}
      <FormSection title="Commentaire administrateur">
        <div>
          <Label>Commentaire (optionnel)</Label>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Motif, instructions, remarques…"
            style={{ ...inp, minHeight: 70, resize: 'vertical' }} />
        </div>
      </FormSection>
    </Modal>
  );
}

// ── Modale de traitement plan SVG ────────────────────────────────────────────

function TraiterPlanModal({ pv, onClose, onUpdated }: {
  pv: PourValidation;
  onClose: () => void;
  onUpdated: (updated: PourValidation) => void;
}) {
  const { user } = useAuth();
  const initialPayload = pv.payload as { nom?: string; description?: string; actif?: boolean };

  const [nom,         setNom]         = useState(initialPayload.nom         ?? '');
  const [description, setDescription] = useState(initialPayload.description ?? '');
  const [actif,       setActif]       = useState(initialPayload.actif !== false);
  const [preview,     setPreview]     = useState(false);
  const [avecRattachement, setAvecRattachement] = useState(pv.avec_rattachement);
  const [siteId,      setSiteId]      = useState(pv.site_id      ?? '');
  const [installId,   setInstallId]   = useState(pv.installation_id ?? '');
  const [sites,       setSites]       = useState<RefOption[]>([]);
  const [installations, setInstallations] = useState<RefOption[]>([]);
  const [comment,     setComment]     = useState(pv.commentaire_admin ?? '');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  const currentUrl      = pv.storage_temp_public_url;
  const currentFilename = pv.storage_path_temp?.split('/').at(-1) ?? '—';

  useEffect(() => {
    db.list('sites').then(({ data }) =>
      setSites((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    ).catch(() => {});
    db.list('installations').then(({ data }) => setInstallations(data as RefOption[])).catch(() => {});
  }, []);

  const filteredInstalls = siteId ? installations.filter(i => i.site_id === siteId) : [];

  function handleSiteChange(id: string) { setSiteId(id); setInstallId(''); }

  async function handleDecision(statut: 'Validé' | 'A compléter' | 'Rejeté' | 'En attente') {
    if (statut === 'Validé') {
      if (!nom.trim())        { setError('Le nom est requis.'); return; }
      if (!avecRattachement)  { setError('Un rattachement est obligatoire pour valider.'); return; }
      if (!siteId)            { setError('Un site est requis pour le rattachement.'); return; }
    }
    setSubmitting(true); setError('');
    try {
      const patch: Record<string, unknown> = { statut, commentaire_admin: comment.trim() || null };

      if (statut === 'Validé') {
        patch.validateur_id = user?.id;
        const now = new Date().toISOString();
        const { data: plan } = await db.create('plans', {
          site_id:         avecRattachement ? (siteId    || null) : null,
          installation_id: avecRattachement ? (installId || null) : null,
          nom:             nom.trim(),
          description:     description.trim() || null,
          svg_path:        pv.storage_path_temp || null,
          actif,
          proposedby_id:   pv.proposedby_id,
          validateur_id:   user?.id,
          date_validation: now,
        });
        patch.id_valide = (plan as { id: string }).id;
      }

      const { data } = await db.updatePourValidation(pv.id, patch);
      onUpdated(data); onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { details?: string; message?: string } } } })?.response?.data?.error;
      setError(msg?.details ?? msg?.message ?? 'Erreur lors de la mise à jour.');
    } finally { setSubmitting(false); }
  }

  const rattachInfo = pv.avec_rattachement
    ? [pv.site_nom, pv.installation_nom].filter(Boolean).join(' › ')
    : null;

  const db_ = (color: string, outlined = false): React.CSSProperties => ({
    ...btnStyle(color, outlined), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
  });

  return (
    <Modal
      title={`Traiter le plan — ${payloadNom(pv)}`}
      icon={<EntityIcon type="plan" size={18} />}
      onClose={onClose}
      error={error}
      maxWidth={620}
      footer={
        pv.statut === 'Validé'
          ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, color: C.success }}>✓ Demande validée — statut non modifiable</span>
                {pv.id_valide && <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>ID : {pv.id_valide}</span>}
              </div>
              <button type="button" onClick={onClose} style={btnStyle(C.muted, true)}>Fermer</button>
            </div>
          : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button type="button" disabled={submitting} onClick={onClose} style={db_(C.muted, true)}>Annuler</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={submitting} onClick={() => handleDecision('En attente')}  style={db_(C.muted,    true)}>En attente</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Rejeté')}      style={db_(C.danger,   true)}>Rejeter</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('A compléter')} style={db_(C.warning,  true)}>A compléter</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Validé')}      style={db_(C.success)}>
                  {submitting ? <><Spinner /> Traitement…</> : '✓ Valider'}
                </button>
              </div>
            </div>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Demande */}
      <FormSection title="Demande">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoRow label="Type"        value={<Pill label="Plan SVG" color={C.success} />} />
          <InfoRow label="Proposé par" value={pv.proposedby_nom} />
          <InfoRow label="Date"        value={`${fullDate(pv.date_propose)} · ${relativeTime(pv.date_propose)}`} />
          <InfoRow label="Validateur"  value={pv.validateur_nom} />
        </div>
        <InfoRow label="Rattachement d'origine" value={
          pv.avec_rattachement
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill label="Avec" color={C.accent} />
                {rattachInfo && <span style={{ fontSize: 12, color: C.muted }}>{rattachInfo}</span>}
              </span>
            : <Pill label="Sans rattachement" color={C.muted} />
        } />
        {pv.commentaire_admin && (
          <InfoRow label="Commentaire existant"
            value={<span style={{ fontStyle: 'italic', color: C.warning }}>{pv.commentaire_admin}</span>} />
        )}
      </FormSection>

      {/* Édition */}
      <FormSection title="Édition du plan">
        <div>
          <Label>Nom *</Label>
          <input value={nom} onChange={e => setNom(e.target.value)} style={inp} placeholder="Nom du plan" />
        </div>
        <div>
          <Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Description…" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={() => setActif(v => !v)}
            style={{ width: 36, height: 20, borderRadius: 10, background: actif ? C.accent : C.border,
              position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ position: 'absolute', top: 3, left: actif ? 19 : 3, width: 14, height: 14,
              borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: 13, color: C.text }}>Actif</span>
        </label>
      </FormSection>

      {/* SVG */}
      <FormSection title="Fichier SVG">
        {currentUrl && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <IconPlan size={18} />
              <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentFilename}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button"
                  onClick={async () => {
                    const res = await fetch(currentUrl!); const blob = await res.blob();
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                    a.download = currentFilename; a.click(); URL.revokeObjectURL(a.href);
                  }}
                  style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`,
                    borderRadius: 6, cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' }}>
                  ↓ Télécharger
                </button>
                <button type="button" onClick={() => setPreview(p => !p)}
                  style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`,
                    borderRadius: 6, cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' }}>
                  {preview ? 'Masquer' : 'Aperçu'}
                </button>
              </div>
            </div>
            {preview && (
              <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                <img src={currentUrl} alt="Aperçu SVG" style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }} />
              </div>
            )}
          </>
        )}
        {!currentUrl && (
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Aucun fichier SVG soumis.</p>
        )}
      </FormSection>

      {/* Rattachement */}
      <FormSection title="Rattachement">
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} type="button" onClick={() => setAvecRattachement(v)}
              style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: 'none', transition: 'background .15s',
                background: avecRattachement === v ? C.accent : 'transparent',
                color: avecRattachement === v ? '#fff' : C.muted }}>
              {v ? 'Avec rattachement' : 'Sans rattachement'}
            </button>
          ))}
        </div>
        {avecRattachement && (
          <>
            <div>
              <Label>Site *</Label>
              <select value={siteId} onChange={e => handleSiteChange(e.target.value)}
                style={{ ...inp, height: 36, cursor: 'pointer' }}>
                <option value="">— Sélectionner un site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div>
              <Label>Installation</Label>
              <select value={installId} onChange={e => setInstallId(e.target.value)} disabled={!siteId}
                style={{ ...inp, height: 36, cursor: siteId ? 'pointer' : 'not-allowed', opacity: siteId ? 1 : 0.4 }}>
                <option value="">— Sélectionner une installation —</option>
                {filteredInstalls.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>
          </>
        )}
      </FormSection>

      {/* Décision */}
      <FormSection title="Commentaire administrateur">
        <div>
          <Label>Commentaire (optionnel)</Label>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Motif, instructions, remarques…"
            style={{ ...inp, minHeight: 70, resize: 'vertical' }} />
        </div>
      </FormSection>
    </Modal>
  );
}

// ── Modale de consultation d'une entité validée ───────────────────────────────

function VoirEntityModal({ pv, onClose }: { pv: PourValidation; onClose: () => void }) {
  const [loading,  setLoading]  = useState(true);
  const [entity,   setEntity]   = useState<FichierPdf | Plan | Calque | null>(null);
  const [error,    setError]    = useState('');
  const [preview,  setPreview]  = useState(false);
  const typeMeta = TYPE_META[pv.entity_type];

  useEffect(() => {
    if (!pv.id_valide) { setLoading(false); return; }
    setLoading(true); setError('');
    (async () => {
      try {
        if (pv.entity_type === 'fichier_pdf') {
          const { data } = await db.getFichierById(pv.id_valide!);
          setEntity(data);
        } else if (pv.entity_type === 'plan') {
          const { data } = await db.getPlanById(pv.id_valide!);
          setEntity(data);
        } else {
          const { data } = await db.getCalqueById(pv.id_valide!);
          setEntity(data);
        }
      } catch {
        setError("Impossible de charger l'entité validée.");
      } finally {
        setLoading(false);
      }
    })();
  }, [pv.id_valide, pv.entity_type]);

  const fileUrl = entity
    ? pv.entity_type === 'fichier_pdf'
      ? (entity as FichierPdf).storage_public_url
      : pv.entity_type === 'plan'
        ? (entity as Plan).svg_public_url
        : null
    : null;

  const fileName = entity
    ? pv.entity_type === 'fichier_pdf'
      ? (entity as FichierPdf).storage_path.split('/').at(-1) ?? entity.nom
      : pv.entity_type === 'plan'
        ? `${entity.nom}.svg`
        : null
    : null;

  const titles: Record<PourValidation['entity_type'], string> = {
    fichier_pdf: 'Fichier PDF validé',
    plan:        'Plan SVG validé',
    calque:      'Calque validé',
  };

  return (
    <Modal
      title={`${titles[pv.entity_type]} — ${payloadNom(pv)}`}
      icon={<EntityIcon type={pv.entity_type} size={18} />}
      onClose={onClose}
      error={error}
      maxWidth={620}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnStyle(C.muted, true)}>Fermer</button>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted, padding: '40px 0' }}>
          <Spinner /><span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      ) : !entity ? (
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '40px 0' }}>
          Aucune entité trouvée.
        </div>
      ) : (
        <>
          {/* Provenance */}
          <FormSection title="Provenance">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InfoRow label="Proposé par" value={pv.proposedby_nom || '—'} />
              <InfoRow label="Validé par"
                value={
                  (entity as { validateur_nom?: string }).validateur_nom ||
                  pv.validateur_nom || '—'
                } />
              <InfoRow label="Date validation"
                value={
                  (entity as { date_validation?: string | null }).date_validation
                    ? fullDate((entity as { date_validation: string }).date_validation)
                    : pv.date_validation ? fullDate(pv.date_validation) : '—'
                } />
              <InfoRow label="Identifiant"
                value={<span style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, wordBreak: 'break-all' }}>{entity.id}</span>} />
            </div>
          </FormSection>

          {/* Données spécifiques */}
          <FormSection title={typeMeta.label}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InfoRow label="Nom" value={entity.nom || '—'} />
              {(entity as { description?: string | null }).description != null && (
                <InfoRow label="Description"
                  value={(entity as { description: string | null }).description || <span style={{ color: C.muted }}>—</span>} />
              )}

              {pv.entity_type === 'fichier_pdf' && (() => {
                const f = entity as FichierPdf;
                return <>
                  <InfoRow label="Dossier"       value={f.dossier_nom || '—'} />
                  <InfoRow label="Accréditation" value={String(f.niveau_accreditation)} />
                  <InfoRow label="Version"       value={String(f.version)} />
                </>;
              })()}

              {pv.entity_type === 'plan' && (() => {
                const p = entity as Plan;
                return <>
                  <InfoRow label="Site"         value={p.site_nom         || '—'} />
                  <InfoRow label="Installation" value={p.installation_nom || '—'} />
                  {(p.largeur_px != null || p.hauteur_px != null) && (
                    <InfoRow label="Dimensions" value={`${p.largeur_px ?? '?'} × ${p.hauteur_px ?? '?'} px`} />
                  )}
                  <InfoRow label="Actif" value={p.actif ? 'Oui' : 'Non'} />
                </>;
              })()}

              {pv.entity_type === 'calque' && (() => {
                const c = entity as Calque;
                return <>
                  <InfoRow label="Type"
                    value={<Pill
                      label={c.type === 'geographique' ? 'Géographique' : 'Non géographique'}
                      color={c.type === 'geographique' ? C.success : C.accent} />} />
                  <InfoRow label="Accréditation"  value={String(c.niveau_accreditation)} />
                  <InfoRow label="Site"           value={c.site_nom          || '—'} />
                  <InfoRow label="Installation"   value={c.installation_nom  || '—'} />
                  <InfoRow label="Plan"           value={c.plan_nom          || '—'} />
                  <InfoRow label="Propriétaire"   value={c.owner_nom         || '—'} />
                  {(c.zoom_min != null || c.zoom_max != null) && (
                    <InfoRow label="Zoom" value={`${c.zoom_min ?? '—'} → ${c.zoom_max ?? '—'}`} />
                  )}
                  {c.couleur && (
                    <InfoRow label="Couleur"
                      value={
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, background: c.couleur, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.couleur}</span>
                        </span>
                      } />
                  )}
                  {c.icone_public_url && (
                    <InfoRow label="Icône"
                      value={<ColoredSvgSmall url={c.icone_public_url} color={c.icone_path ? (c.couleur || undefined) : (c.couleur || '#378ADD')} size={28} />} />
                  )}
                  <InfoRow label="Téléchargeable" value={c.is_downloadable ? 'Oui' : 'Non'} />
                </>;
              })()}
            </div>
          </FormSection>

          {/* Fichier */}
          {fileUrl && (
            <FormSection title="Fichier">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                <EntityIcon type={pv.entity_type} size={18} />
                <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fileName}
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button"
                    onClick={async () => {
                      const res  = await fetch(fileUrl);
                      const blob = await res.blob();
                      const a    = document.createElement('a');
                      a.href     = URL.createObjectURL(blob);
                      a.download = fileName ?? 'fichier';
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                    style={{ fontSize: 12, color: C.muted, padding: '4px 10px',
                      border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent' }}>
                    ↓ Télécharger
                  </button>
                  <button type="button" onClick={() => setPreview(p => !p)}
                    style={{ fontSize: 12, color: C.muted, padding: '4px 10px',
                      border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent' }}>
                    {preview ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </div>
              {preview && (
                pv.entity_type === 'fichier_pdf'
                  ? <iframe src={fileUrl} style={{ width: '100%', height: 420, border: `1px solid ${C.border}`, borderRadius: 8, display: 'block' }} title="Aperçu PDF" />
                  : <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={fileUrl} alt="Aperçu SVG" style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }} />
                    </div>
              )}
            </FormSection>
          )}
        </>
      )}
    </Modal>
  );
}

// ── Ligne de tableau vide ─────────────────────────────────────────────────────

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        {message}
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

type Tab     = 'En attente' | 'A compléter' | 'Validé' | 'Rejeté';
type SortCol = 'type' | 'validateur' | 'rattachement' | 'date';

function sortPV(list: PourValidation[], col: SortCol, dir: 'asc' | 'desc'): PourValidation[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (col) {
      case 'type':         return sign * a.entity_type.localeCompare(b.entity_type);
      case 'validateur':   return sign * a.validateur_nom.localeCompare(b.validateur_nom, 'fr');
      case 'rattachement': return sign * (Number(a.avec_rattachement) - Number(b.avec_rattachement));
      case 'date':         return sign * (new Date(a.date_propose).getTime() - new Date(b.date_propose).getTime());
    }
  });
}

function SortableTh({ col, label, sort, onSort, thStyle }: {
  col: SortCol;
  label: string;
  sort: { col: SortCol; dir: 'asc' | 'desc' } | null;
  onSort: (col: SortCol) => void;
  thStyle: React.CSSProperties;
}) {
  const active = sort?.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        ...thStyle,
        cursor: 'pointer',
        userSelect: 'none',
        color: active ? C.accent : C.muted,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {label}
        <span style={{ fontSize: 10, color: active ? C.accent : C.muted, lineHeight: 1, opacity: active ? 1 : 0.6 }}>
          {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );
}

function TabBtn({ value, count, active, onClick }: { value: Tab; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
        background: active ? C.accent18 : 'transparent',
        border: `1px solid ${active ? C.accent44 : C.border}`,
        color: active ? C.accent : C.muted,
        fontWeight: active ? 600 : 400,
      }}
    >
      {value}
      {count > 0 && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: active ? C.accent : C.border,
          color: active ? '#fff' : C.muted, fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function ValiderDemandesPage() {
  const { user } = useAuth();
  const [items,    setItems]    = useState<PourValidation[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>('En attente');
  const [selected, setSelected] = useState<PourValidation | null>(null);
  const [sort,     setSort]     = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null);

  function toggleSort(col: SortCol) {
    setSort(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' },
    );
  }

  const isAdminApp = user?.role === ROLES.ADMIN_APP;

  useEffect(() => {
    setLoading(true);
    db.listPourValidation()
      .then(({ data }) => {
        const filtered = isAdminApp
          ? data
          : data.filter(pv => pv.validateur_id === user?.id);
        setItems(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdminApp, user?.id]);

  function handleUpdated(updated: PourValidation) {
    setItems(prev => prev.map(pv => pv.id === updated.id ? updated : pv));
  }

  const pending    = items.filter(pv => pv.statut === 'En attente');
  const toComplete = items.filter(pv => pv.statut === 'A compléter');
  const validated  = items.filter(pv => pv.statut === 'Validé');
  const rejected   = items.filter(pv => pv.statut === 'Rejeté');

  const base = { 'En attente': pending, 'A compléter': toComplete, 'Validé': validated, 'Rejeté': rejected }[tab];
  const displayed = sort ? sortPV(base, sort.col, sort.dir) : base;

  const th: React.CSSProperties = {
    padding: '10px 14px', background: '#1C2333', color: C.muted, fontWeight: 600,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: C.bg, minHeight: '100%' }}>

      {/* En-tête + Tabs — fixés */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: C.bg,
        padding: '28px 40px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: C.text }}>
            Valider les demandes
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {isAdminApp
              ? 'Toutes les demandes en attente de traitement.'
              : 'Demandes pour lesquelles vous êtes le validateur désigné.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabBtn value="En attente"  count={pending.length}    active={tab === 'En attente'}  onClick={() => setTab('En attente')} />
          <TabBtn value="A compléter" count={toComplete.length} active={tab === 'A compléter'} onClick={() => setTab('A compléter')} />
          <TabBtn value="Validé"      count={validated.length}  active={tab === 'Validé'}      onClick={() => setTab('Validé')} />
          <TabBtn value="Rejeté"      count={rejected.length}   active={tab === 'Rejeté'}      onClick={() => setTab('Rejeté')} />
        </div>
      </div>

      {/* Tableau */}
      <div style={{ padding: '24px 40px 32px' }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
            <Spinner /><span style={{ fontSize: 13 }}>Chargement…</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                <th style={{ ...th, width: 220 }}>Nom de la demande</th>
                <SortableTh col="type"         label="Type"        sort={sort} onSort={toggleSort} thStyle={{ ...th, width: 120 }} />
                <SortableTh col="validateur"   label="Validateur"  sort={sort} onSort={toggleSort} thStyle={{ ...th, width: 150 }} />
                <SortableTh col="rattachement" label="Rattachement" sort={sort} onSort={toggleSort} thStyle={th} />
                <SortableTh col="date"         label="Date"         sort={sort} onSort={toggleSort} thStyle={{ ...th, width: 100 }} />
                <th style={{ ...th, width: 88, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0
                ? <EmptyRow message={{
                    'En attente':  'Aucune demande en attente de validation.',
                    'A compléter': 'Aucune demande à compléter.',
                    'Validé':      'Aucune demande validée.',
                    'Rejeté':      'Aucune demande rejetée.',
                  }[tab]} />
                : displayed.map((pv, i) => (
                  <PvRow
                    key={pv.id}
                    pv={pv}
                    odd={i % 2 === 1}
                    readOnly={!isAdminApp}
                    onTraiter={() => setSelected(pv)}
                  />
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      {/* Modale traitement / consultation */}
      {selected && (selected.statut === 'Validé' || !isAdminApp) ? (
        <VoirEntityModal pv={selected} onClose={() => setSelected(null)} />
      ) : selected && selected.entity_type === 'calque' ? (
        <TraiterCalqueModal
          pv={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
        />
      ) : selected && selected.entity_type === 'plan' ? (
        <TraiterPlanModal
          pv={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
        />
      ) : selected ? (
        <TraiterModal
          pv={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
        />
      ) : null}
      </div>{/* fin padding tableau */}
    </div>
  );
}

// ── Ligne du tableau ──────────────────────────────────────────────────────────

function CommentPopup({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '20px 22px', maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Commentaire</span>
          <button type="button" onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: C.warning, fontStyle: 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</p>
      </div>
    </div>
  );
}

function PvRow({ pv, odd, readOnly, onTraiter }: { pv: PourValidation; odd: boolean; readOnly?: boolean; onTraiter: () => void }) {
  const [hover,        setHover]        = useState(false);
  const [showComment,  setShowComment]  = useState(false);
  const typeMeta = TYPE_META[pv.entity_type];

  const td: React.CSSProperties = {
    padding: '12px 14px', fontSize: 13, color: C.text,
    borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle',
  };

  const rowBg = hover ? C.accent08 : odd ? C.surface280 : 'transparent';

  return (
    <tr
      style={{ background: rowBg, transition: 'background .1s' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Nom */}
      <td style={{ ...td, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: typeMeta.color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EntityIcon type={pv.entity_type} size={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              title={(pv.payload as { description?: string })?.description || 'Aucune description'}
              style={{ fontWeight: 600, color: C.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >{payloadNom(pv)}</div>
            {pv.proposedby_nom && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>par {pv.proposedby_nom}</div>
            )}
            {pv.commentaire_admin && (
              <div
                onClick={e => { e.stopPropagation(); setShowComment(true); }}
                style={{ fontSize: 11, color: C.warning, marginTop: 3, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  cursor: 'pointer', textDecoration: 'underline dotted' }}
              >
                {pv.commentaire_admin}
              </div>
            )}
            {showComment && pv.commentaire_admin && (
              <CommentPopup text={pv.commentaire_admin} onClose={() => setShowComment(false)} />
            )}
          </div>
        </div>
      </td>

      {/* Type */}
      <td style={{ ...td, overflow: 'hidden' }}>
        <Pill label={typeMeta.label} color={typeMeta.color} />
      </td>

      {/* Validateur */}
      <td style={{ ...td, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pv.validateur_nom || '—'}
      </td>

      {/* Rattachement */}
      <td style={{ ...td, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RattachBadge value={pv.avec_rattachement} />
          {pv.avec_rattachement && pv.site_nom && (
            <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[pv.site_nom, pv.installation_nom, pv.dossier_nom || pv.plan_nom].filter(Boolean).join(' › ')}
            </span>
          )}
        </div>
      </td>

      {/* Date */}
      <td style={{ ...td, color: C.muted, whiteSpace: 'nowrap' }}>
        {new Date(pv.date_propose).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </td>

      {/* Actions */}
      <td style={{ ...td, textAlign: 'right', overflow: 'hidden' }}>
        <button
          onClick={onTraiter}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            background: (pv.statut === 'Validé' || readOnly) ? C.success18 : C.accent18,
            border: `1px solid ${(pv.statut === 'Validé' || readOnly) ? C.success44 : C.accent44}`,
            color: (pv.statut === 'Validé' || readOnly) ? C.success : C.accent,
            transition: 'background .15s',
          }}
        >
          {pv.statut === 'Validé' || readOnly ? 'Voir' : 'Traiter'}
        </button>
      </td>
    </tr>
  );
}
