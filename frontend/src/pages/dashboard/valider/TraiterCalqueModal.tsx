import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, type PourValidation, type Marker } from '@/api/database';
import { Modal } from '@/components/Modal';
import { inputStyle as inp, btnStyle, Label, FormSection, Spinner } from '@/components/ui';
import { C } from '@/constants/colors';
import { EntityIcon, InfoRow, RattachBadge, payloadNom, fullDate, relativeTime, MarkerPickerDropdown, SYSTEM_PROPS, type PropRow, type RefOption, type Statut } from './shared';

export function TraiterCalqueModal({ pv, onClose, onUpdated }: {
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
  const [comment,    setComment]    = useState(pv.commentaire_admin ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    db.list('sites').then(({ data }) => setSites((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))).catch(() => {});
    db.list('installations').then(({ data }) => setInstallations(data as RefOption[])).catch(() => {});
    db.list('plans').then(({ data }) => setPlans(data as RefOption[])).catch(() => {});
    db.listMarkers().then(({ data }) => setMarkers(data)).catch(() => {});
  }, []);

  const filteredInstalls = siteId ? installations.filter(i => i.site_id === siteId) : [];
  const filteredPlans    = installId
    ? plans.filter(p => p.installation_id === installId)
    : siteId ? plans.filter(p => p.site_id === siteId && !p.installation_id) : [];
  const calqueType: 'geographique' | 'non_geographique' = avecRattachement && !!installId ? 'non_geographique' : 'geographique';

  function handleSiteChange(id: string)    { setSiteId(id); setInstallId(''); setPlanId(''); }
  function handleInstallChange(id: string) { setInstallId(id); setPlanId(''); }

  async function handleDecision(statut: Statut) {
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
        const validProps = propsList.filter(p => p.key.trim());
        const userMap    = Object.fromEntries(validProps.map(p => [p.key.trim(), p.defaultVal || null]));
        const properties: Record<string, unknown> = { ...userMap };
        if (!('marker-color' in properties)) properties['marker-color'] = initTpl?.properties?.['marker-color'] ?? couleur ?? null;
        if (!('marker-size'  in properties)) properties['marker-size']  = initTpl?.properties?.['marker-size']  ?? 'medium';
        const template_champs = { type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties };
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
          date_validation:      new Date().toISOString(),
        });
        patch.id_valide = calqueData.id;
      }
      const { data } = await db.updatePourValidation(pv.id, patch);
      onUpdated(data); onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { details?: string; message?: string } } } })?.response?.data?.error;
      setError(msg?.details ?? msg?.message ?? 'Erreur lors de la mise à jour.');
    } finally { setSubmitting(false); }
  }

  const spinBtnS = (off: boolean): React.CSSProperties => ({
    width: 32, height: 36, flexShrink: 0, background: 'transparent', border: 'none',
    fontSize: 20, fontWeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: off ? C.border : C.accent, cursor: off ? 'not-allowed' : 'pointer',
  });
  const db_ = (color: string, outlined = false): React.CSSProperties => ({
    ...btnStyle(color, outlined), opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
  });

  return (
    <Modal
      title={`Traiter le calque — ${payloadNom(pv)}`}
      icon={<EntityIcon type="calque" size={18} />}
      onClose={onClose} error={error} maxWidth={660}
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
          <InfoRow label="Proposé par" value={pv.proposedby_nom} />
          <InfoRow label="Validateur"  value={pv.validateur_nom} />
          <InfoRow label="Date"        value={`${fullDate(pv.date_propose)} · ${relativeTime(pv.date_propose)}`} />
          <InfoRow label="Rattachement initial" value={<RattachBadge value={pv.avec_rattachement} />} />
        </div>
        {pv.commentaire_admin && (
          <InfoRow label="Commentaire existant" value={<span style={{ fontStyle: 'italic', color: C.warning }}>{pv.commentaire_admin}</span>} />
        )}
      </FormSection>

      <FormSection title="Informations du calque">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>Nom *</Label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du calque" style={inp} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0, height: 36 }}>
            <div onClick={() => setIsDownloadable(v => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, background: isDownloadable ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 3, left: isDownloadable ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 13, color: C.text }}>{isDownloadable ? 'Téléchargeable' : 'Non téléchargeable'}</span>
          </label>
        </div>
        <div><Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description optionnelle…" style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
        </div>
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
              <input value={couleur} onChange={e => setCouleur(e.target.value)} style={{ ...inp, width: 88 }} placeholder="#rrggbb" />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>Accréditation (0–3)</Label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
              <button type="button" disabled={nivelAccred <= 0} style={spinBtnS(nivelAccred <= 0)} onClick={() => setNivelAccred(v => Math.max(0, v - 1))}>−</button>
              <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
              <input type="text" inputMode="numeric" value={String(nivelAccred)}
                onChange={e => { const n = parseInt(e.target.value, 10); setNivelAccred(isNaN(n) ? 0 : Math.min(3, Math.max(0, n))); }}
                style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.text, outline: 'none', minWidth: 0 }} />
              <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
              <button type="button" disabled={nivelAccred >= 3} style={spinBtnS(nivelAccred >= 3)} onClick={() => setNivelAccred(v => Math.min(3, v + 1))}>+</button>
            </div>
          </div>
          {([['zoom_min', zoomMin, setZoomMin], ['zoom_max', zoomMax, setZoomMax]] as const).map(([key, val, setter]) => (
            <div key={key} style={{ flex: 1, minWidth: 0 }}>
              <Label>{key === 'zoom_min' ? 'Zoom mini' : 'Zoom maxi'}</Label>
              <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
                <button type="button" disabled={val === null} style={spinBtnS(val === null)} onClick={() => setter(v => v === null ? null : v === 0 ? null : (v as number) - 1)}>−</button>
                <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                <input type="text" inputMode="numeric" value={val === null ? '' : String(val)} placeholder="—"
                  onChange={e => { const n = parseInt(e.target.value, 10); setter(e.target.value === '' ? null : isNaN(n) ? val : Math.min(22, Math.max(0, n))); }}
                  style={{ flex: 1, height: 36, background: 'transparent', border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600, color: val === null ? C.muted : C.text, outline: 'none', minWidth: 0 }} />
                <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
                <button type="button" disabled={val !== null && (val as number) >= 22} style={spinBtnS(val !== null && (val as number) >= 22)} onClick={() => setter(v => v === null ? 0 : Math.min(22, (v as number) + 1))}>+</button>
              </div>
            </div>
          ))}
        </div>
      </FormSection>

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

      <FormSection title="Rattachement">
        <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {([true, false] as const).map(v => (
            <button key={String(v)} type="button" onClick={() => { setAvecRattachement(v); setSiteId(''); setInstallId(''); setPlanId(''); }}
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
            {siteId && <><div><Label>Installation (optionnel)</Label>
              <select value={installId} onChange={e => handleInstallChange(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">— Aucune (calque géographique) —</option>
                {filteredInstalls.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
              </select>
            </div>
            <div><Label>Plan (optionnel)</Label>
              <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...inp, height: 36 }}>
                <option value="">{filteredPlans.length === 0 ? '— Aucun plan disponible —' : '— Aucun plan —'}</option>
                {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Type déduit :</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: installId ? C.accent : C.success }}>
                {installId ? 'Non géographique' : 'Géographique'}
              </span>
            </div></>}
          </div>
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
