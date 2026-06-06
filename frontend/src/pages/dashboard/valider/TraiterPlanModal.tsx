import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, type PourValidation } from '@/api/database';
import { Modal } from '@/components/Modal';
import { inputStyle as inp, btnStyle, Label, FormSection, Spinner } from '@/components/ui';
import { C } from '@/constants/colors';
import { Pill, EntityIcon, InfoRow, IconPlan, payloadNom, fullDate, relativeTime, type RefOption } from './shared';

export function TraiterPlanModal({ pv, onClose, onUpdated }: {
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
  const [comment,    setComment]    = useState(pv.commentaire_admin ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const currentUrl      = pv.storage_temp_public_url;
  const currentFilename = pv.storage_path_temp?.split('/').at(-1) ?? '—';

  useEffect(() => {
    db.list('sites').then(({ data }) =>
      setSites((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    ).catch(() => {});
    db.list('installations').then(({ data }) => setInstallations(data as RefOption[])).catch(() => {});
  }, []);

  const filteredInstalls = siteId ? installations.filter(i => i.site_id === siteId) : [];

  async function handleDecision(statut: 'Validé' | 'A compléter' | 'Rejeté' | 'En attente') {
    if (statut === 'Validé') {
      if (!nom.trim())       { setError('Le nom est requis.'); return; }
      if (!avecRattachement) { setError('Un rattachement est obligatoire pour valider.'); return; }
      if (!siteId)           { setError('Un site est requis pour le rattachement.'); return; }
    }
    setSubmitting(true); setError('');
    try {
      const patch: Record<string, unknown> = { statut, commentaire_admin: comment.trim() || null };
      if (statut === 'Validé') {
        patch.validateur_id = user?.id;
        const { data: plan } = await db.create('plans', {
          site_id:         avecRattachement ? (siteId    || null) : null,
          installation_id: avecRattachement ? (installId || null) : null,
          nom:             nom.trim(),
          description:     description.trim() || null,
          svg_path:        pv.storage_path_temp || null,
          actif,
          proposedby_id:   pv.proposedby_id,
          validateur_id:   user?.id,
          date_validation: new Date().toISOString(),
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
      onClose={onClose} error={error} maxWidth={620}
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
          <InfoRow label="Commentaire existant" value={<span style={{ fontStyle: 'italic', color: C.warning }}>{pv.commentaire_admin}</span>} />
        )}
      </FormSection>

      <FormSection title="Édition du plan">
        <div><Label>Nom *</Label><input value={nom} onChange={e => setNom(e.target.value)} style={inp} placeholder="Nom du plan" /></div>
        <div><Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Description…" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={() => setActif(v => !v)}
            style={{ width: 36, height: 20, borderRadius: 10, background: actif ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ position: 'absolute', top: 3, left: actif ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: 13, color: C.text }}>Actif</span>
        </label>
      </FormSection>

      <FormSection title="Fichier SVG">
        {currentUrl ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
              <IconPlan size={18} />
              <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentFilename}</span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button"
                  onClick={async () => { const res = await fetch(currentUrl!); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = currentFilename; a.click(); URL.revokeObjectURL(a.href); }}
                  style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' }}>↓ Télécharger</button>
                <button type="button" onClick={() => setPreview(p => !p)}
                  style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap' }}>{preview ? 'Masquer' : 'Aperçu'}</button>
              </div>
            </div>
            {preview && (
              <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                <img src={currentUrl} alt="Aperçu SVG" style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }} />
              </div>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Aucun fichier SVG soumis.</p>
        )}
      </FormSection>

      <FormSection title="Rattachement">
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} type="button" onClick={() => setAvecRattachement(v)}
              style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'background .15s',
                background: avecRattachement === v ? C.accent : 'transparent',
                color: avecRattachement === v ? '#fff' : C.muted }}>
              {v ? 'Avec rattachement' : 'Sans rattachement'}
            </button>
          ))}
        </div>
        {avecRattachement && (
          <>
            <div><Label>Site *</Label>
              <select value={siteId} onChange={e => { setSiteId(e.target.value); setInstallId(''); }} style={{ ...inp, height: 36, cursor: 'pointer' }}>
                <option value="">— Sélectionner un site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div><Label>Installation</Label>
              <select value={installId} onChange={e => setInstallId(e.target.value)} disabled={!siteId}
                style={{ ...inp, height: 36, cursor: siteId ? 'pointer' : 'not-allowed', opacity: siteId ? 1 : 0.4 }}>
                <option value="">— Sélectionner une installation —</option>
                {filteredInstalls.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Commentaire administrateur">
        <div><Label>Commentaire (optionnel)</Label>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Motif, instructions, remarques…" style={{ ...inp, minHeight: 70, resize: 'vertical' }} />
        </div>
      </FormSection>
    </Modal>
  );
}
