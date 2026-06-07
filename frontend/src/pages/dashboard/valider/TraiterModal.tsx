import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, type PourValidation } from '@/api/database';
import { Modal } from '@/components/Modal';
import { inputStyle as inp, btnStyle, Label, FormSection, Spinner } from '@/components/ui';
import { C } from '@/constants/colors';
import { TYPE_META, Pill, EntityIcon, InfoRow, payloadNom, fullDate, relativeTime, type RefOption, type Statut } from './shared';

export function TraiterModal({ pv, onClose, onUpdated }: {
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

  const typeMeta        = TYPE_META[pv.entity_type];
  const pvNom           = payloadNom(pv);
  const currentUrl      = pv.storage_temp_public_url;
  const currentFilename = pv.storage_path_temp?.split('/').at(-1) ?? '—';
  const newFilename     = newFile?.name ?? null;

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
    if (file.type !== 'application/pdf') { setError('Seul le format PDF est accepté.'); return; }
    setUploading(true); setError('');
    try {
      const { data } = await db.uploadPdfTemp(file);
      setNewFile(file); setNewPath(data.path);
    } catch { setError("Erreur lors de l'upload."); }
    finally { setUploading(false); }
  }

  async function handleDecision(statut: Statut) {
    if (statut === 'Validé') {
      if (!avecRattachement) { setError('Un rattachement est obligatoire pour valider.'); return; }
      if (!siteId)           { setError('Un site est requis pour le rattachement.'); return; }
      if (!dossId)           { setError('Un dossier est requis.'); return; }
    }
    setSubmitting(true); setError('');
    try {
      const finalPath = newPath || pv.storage_path_temp;
      const patch: Record<string, unknown> = { statut, commentaire_admin: comment.trim() || null };
      if (newPath) patch.storage_path_temp = newPath;
      if (statut === 'Validé') {
        patch.validateur_id = user?.id;
        const { data: fichier } = await db.createFichier({
          dossier_id:    dossId || pv.dossier_id,
          nom:           nom.trim() || 'Sans titre',
          description:   description.trim() || null,
          storage_path:  finalPath,
          is_uploadable: isUploadable,
          proposedby_id: pv.proposedby_id,
          validateur_id: user?.id,
          date_validation: new Date().toISOString(),
        });
        patch.id_valide = fichier.id;
      }
      const { data } = await db.updatePourValidation(pv.id, patch);
      onUpdated(data); onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { details?: string; message?: string } } } })?.response?.data?.error;
      setError(msg?.details ?? msg?.message ?? 'Erreur lors de la mise à jour.');
    } finally { setSubmitting(false); }
  }

  const rattachOrigine = pv.avec_rattachement
    ? [pv.site_nom, pv.installation_nom, pv.dossier_nom].filter(Boolean).join(' › ')
    : null;

  const db_ = (color: string, outlined = false): React.CSSProperties => ({
    ...btnStyle(color, outlined), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
  });

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
              <button type="button" disabled={submitting} onClick={onClose} style={db_(C.muted, true)}>Annuler</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={submitting} onClick={() => handleDecision('En attente')}  style={db_(C.muted, true)}>En attente</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Rejeté')}      style={db_(C.danger, true)}>Rejeter</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('A compléter')} style={db_(C.warning, true)}>A compléter</button>
                <button type="button" disabled={submitting} onClick={() => handleDecision('Validé')}      style={db_(C.success)}>
                  {submitting ? <><Spinner /> Traitement…</> : '✓ Valider'}
                </button>
              </div>
            </div>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <FormSection title="Demande">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoRow label="Type"        value={<Pill label={typeMeta.label} color={typeMeta.color} />} />
          <InfoRow label="Proposé par" value={pv.proposedby_nom} />
          <InfoRow label="Date"        value={`${fullDate(pv.date_propose)} · ${relativeTime(pv.date_propose)}`} />
          <InfoRow label="Validateur"  value={pv.validateur_nom} />
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

      <FormSection title="Édition du fichier">
        <div><Label>Nom *</Label><input value={nom} onChange={e => setNom(e.target.value)} style={inp} placeholder="Nom du fichier" /></div>
        <div>
          <Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Description…" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={() => setIsUploadable(v => !v)}
            style={{ width: 36, height: 20, borderRadius: 10, background: isUploadable ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ position: 'absolute', top: 3, left: isUploadable ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: 13, color: C.text }}>{isUploadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
        </label>
      </FormSection>

      <FormSection title="Fichier PDF">
        {currentUrl && !newFile && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <EntityIcon type={pv.entity_type} size={18} />
              <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentFilename}</span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={async () => { const res = await fetch(currentUrl!); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = currentFilename; a.click(); URL.revokeObjectURL(a.href); }}
                  style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' }}>↓ Télécharger</button>
                <button type="button" onClick={() => setPreview(p => !p)}
                  style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' }}>{preview ? 'Masquer' : 'Afficher'}</button>
              </div>
            </div>
            {preview && (
              pv.entity_type === 'fichier_pdf'
                ? <iframe src={currentUrl} style={{ width: '100%', height: 420, border: `1px solid ${C.border}`, borderRadius: 8, display: 'block' }} title="Aperçu PDF" />
                : <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={currentUrl} alt="Aperçu SVG" style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }} />
                  </div>
            )}
          </>
        )}
        {newFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface2, border: `1px solid ${C.success44}`, borderRadius: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{newFilename}</span>
            <button type="button" onClick={() => { setNewFile(null); setNewPath(null); }}
              style={{ fontSize: 11, color: C.danger, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Retirer</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
          style={{ ...btnStyle(C.accent, true), fontSize: 12 }}>
          {uploading ? <><Spinner /> Upload…</> : '+ Remplacer le fichier PDF'}
        </button>
      </FormSection>

      <FormSection title="Rattachement">
        <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} type="button" onClick={() => { setAvecRattachement(v); setSiteId(''); setInstallId(''); setDossId(''); }}
              style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', borderRadius: 6,
                background: avecRattachement === v ? C.accent : 'transparent',
                color: avecRattachement === v ? '#fff' : C.muted, transition: 'background .15s, color .15s' }}>
              {v ? 'Avec rattachement' : 'Sans rattachement'}
            </button>
          ))}
        </div>
        {avecRattachement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><Label>Site *</Label>
              <select value={siteId} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">— Sélectionner un site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            {siteId && <div><Label>Installation (optionnel)</Label>
              <select value={installId} onChange={e => handleInstallChange(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">— Aucune —</option>
                {filteredInstalls.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>}
            {siteId && <div><Label>Dossier *</Label>
              <select value={dossId} onChange={e => setDossId(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">{filteredDossiers.length === 0 ? '— Aucun dossier disponible —' : '— Sélectionner un dossier —'}</option>
                {filteredDossiers.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </div>}
          </div>
        )}
        {!avecRattachement && (
          <div><Label>Dossier *</Label>
            <select value={dossId} onChange={e => setDossId(e.target.value)} style={{ ...inp, height: 36 }}>
              <option value="">— Sélectionner un dossier —</option>
              {dossiers.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
        )}
      </FormSection>

      <FormSection title="Décision administrative">
        <div><Label>Commentaire (optionnel)</Label>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Motif, instructions pour compléter, remarques…" style={{ ...inp, minHeight: 80, resize: 'vertical' }} />
        </div>
      </FormSection>
    </Modal>
  );
}
