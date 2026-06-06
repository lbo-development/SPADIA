import { useState, useEffect } from 'react';
import { db, type PourValidation, type FichierPdf, type Plan, type Calque } from '@/api/database';
import { Modal } from '@/components/Modal';
import { btnStyle, FormSection, Spinner } from '@/components/ui';
import { C } from '@/constants/colors';
import { TYPE_META, Pill, EntityIcon, InfoRow, ColoredSvgSmall, payloadNom, fullDate } from './shared';

export function VoirEntityModal({ pv, onClose }: { pv: PourValidation; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [entity,  setEntity]  = useState<FichierPdf | Plan | Calque | null>(null);
  const [error,   setError]   = useState('');
  const [preview, setPreview] = useState(false);
  const typeMeta = TYPE_META[pv.entity_type];

  useEffect(() => {
    if (!pv.id_valide) { setLoading(false); return; }
    setLoading(true); setError('');
    (async () => {
      try {
        if (pv.entity_type === 'fichier_pdf') {
          const { data } = await db.getFichierById(pv.id_valide!); setEntity(data);
        } else if (pv.entity_type === 'plan') {
          const { data } = await db.getPlanById(pv.id_valide!); setEntity(data);
        } else {
          const { data } = await db.getCalqueById(pv.id_valide!); setEntity(data);
        }
      } catch { setError("Impossible de charger l'entité validée."); }
      finally  { setLoading(false); }
    })();
  }, [pv.id_valide, pv.entity_type]);

  const fileUrl  = entity
    ? pv.entity_type === 'fichier_pdf' ? (entity as FichierPdf).storage_public_url
    : pv.entity_type === 'plan'        ? (entity as Plan).svg_public_url
    : null : null;

  const fileName = entity
    ? pv.entity_type === 'fichier_pdf' ? ((entity as FichierPdf).storage_path.split('/').at(-1) ?? entity.nom)
    : pv.entity_type === 'plan'        ? `${entity.nom}.svg`
    : null : null;

  return (
    <Modal
      title={`${{ fichier_pdf: 'Fichier PDF validé', plan: 'Plan SVG validé', calque: 'Calque validé' }[pv.entity_type]} — ${payloadNom(pv)}`}
      icon={<EntityIcon type={pv.entity_type} size={18} />}
      onClose={onClose} error={error} maxWidth={620}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={btnStyle(C.muted, true)}>Fermer</button></div>}
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted, padding: '40px 0' }}>
          <Spinner /><span style={{ fontSize: 13 }}>Chargement…</span>
        </div>
      ) : !entity ? (
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '40px 0' }}>Aucune entité trouvée.</div>
      ) : (
        <>
          <FormSection title="Provenance">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InfoRow label="Proposé par" value={pv.proposedby_nom || '—'} />
              <InfoRow label="Validé par"  value={(entity as { validateur_nom?: string }).validateur_nom || pv.validateur_nom || '—'} />
              <InfoRow label="Date validation"
                value={(entity as { date_validation?: string | null }).date_validation
                  ? fullDate((entity as { date_validation: string }).date_validation)
                  : pv.date_validation ? fullDate(pv.date_validation) : '—'} />
              <InfoRow label="Identifiant"
                value={<span style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, wordBreak: 'break-all' }}>{entity.id}</span>} />
            </div>
          </FormSection>

          <FormSection title={typeMeta.label}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <InfoRow label="Nom" value={entity.nom || '—'} />
              {(entity as { description?: string | null }).description != null && (
                <InfoRow label="Description" value={(entity as { description: string | null }).description || <span style={{ color: C.muted }}>—</span>} />
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
                  <InfoRow label="Type" value={<Pill label={c.type === 'geographique' ? 'Géographique' : 'Non géographique'} color={c.type === 'geographique' ? C.success : C.accent} />} />
                  <InfoRow label="Accréditation"  value={String(c.niveau_accreditation)} />
                  <InfoRow label="Site"           value={c.site_nom         || '—'} />
                  <InfoRow label="Installation"   value={c.installation_nom || '—'} />
                  <InfoRow label="Plan"           value={c.plan_nom         || '—'} />
                  <InfoRow label="Propriétaire"   value={c.owner_nom        || '—'} />
                  {(c.zoom_min != null || c.zoom_max != null) && (
                    <InfoRow label="Zoom" value={`${c.zoom_min ?? '—'} → ${c.zoom_max ?? '—'}`} />
                  )}
                  {c.couleur && (
                    <InfoRow label="Couleur" value={
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 3, background: c.couleur, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.couleur}</span>
                      </span>
                    } />
                  )}
                  {c.icone_public_url && (
                    <InfoRow label="Icône" value={<ColoredSvgSmall url={c.icone_public_url} color={c.icone_path ? (c.couleur || undefined) : (c.couleur || '#378ADD')} size={28} />} />
                  )}
                  <InfoRow label="Téléchargeable" value={c.is_downloadable ? 'Oui' : 'Non'} />
                </>;
              })()}
            </div>
          </FormSection>

          {fileUrl && (
            <FormSection title="Fichier">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                <EntityIcon type={pv.entity_type} size={18} />
                <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button"
                    onClick={async () => { const res = await fetch(fileUrl); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName ?? 'fichier'; a.click(); URL.revokeObjectURL(a.href); }}
                    style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent' }}>↓ Télécharger</button>
                  <button type="button" onClick={() => setPreview(p => !p)}
                    style={{ fontSize: 12, color: C.muted, padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: 'transparent' }}>{preview ? 'Masquer' : 'Afficher'}</button>
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
