import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/api/database';
import { Modal } from '@/components/Modal';
import { C } from '@/constants/colors';
import { inputStyle as inp, btnStyle as btn, Label, FormSection, Spinner } from '@/components/ui';

// ── NumSpinner ────────────────────────────────────────────────────────────────

function NumSpinner({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  const s: React.CSSProperties = {
    width: 32, height: 36, background: 'transparent', border: 'none', fontSize: 18, fontWeight: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
      <button type="button" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
        style={{ ...s, color: value <= min ? C.border : C.accent, cursor: value <= min ? 'not-allowed' : 'pointer' }}>−</button>
      <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.text }}>{value}</span>
      <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />
      <button type="button" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
        style={{ ...s, color: value >= max ? C.border : C.accent, cursor: value >= max ? 'not-allowed' : 'pointer' }}>+</button>
    </div>
  );
}

// ── Icônes ────────────────────────────────────────────────────────────────────

function IconPdf({ size = 40, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
      <line x1="9" y1="9" x2="11" y2="9"/>
    </svg>
  );
}

function IconPlan({ size = 40, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/>
      <line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  );
}

function IconCalque({ size = 40, color = C.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 12 12 17 22 12"/>
      <polyline points="2 17 12 22 22 17"/>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityType = 'fichier_pdf' | 'plan' | 'calque';
type RefOption  = { id: string; nom: string; site_id?: string; installation_id?: string | null };
type AdminUser  = { id: string; nom: string };

// ── Succès dans modale ────────────────────────────────────────────────────────

function SuccessContent({ entityLabel, onClose }: { entityLabel: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.success22,
        border: `2px solid ${C.success}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, marginBottom: 20 }}>✓</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: C.text }}>Demande soumise</h3>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        Votre demande de {entityLabel} a bien été enregistrée.<br/>
        Un administrateur la traitera prochainement.
      </p>
      <button style={btn(C.accent)} onClick={onClose}>Fermer</button>
    </div>
  );
}

// ── Toggle rattachement (partagé) ────────────────────────────────────────────

function RattachementToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    border: 'none', borderRadius: 6,
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.muted,
    transition: 'background .15s, color .15s',
  });
  return (
    <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
      <button type="button" style={seg(value)}  onClick={() => onChange(true)}>Avec rattachement</button>
      <button type="button" style={seg(!value)} onClick={() => onChange(false)}>Sans rattachement</button>
    </div>
  );
}

// ── Sélecteurs site / installation (partagés) ─────────────────────────────────

function SiteInstallSelect({ siteId, installId, onSiteChange, onInstallChange, sites, installations }: {
  siteId: string; installId: string;
  onSiteChange: (id: string) => void;
  onInstallChange: (id: string) => void;
  sites: RefOption[];
  installations: RefOption[];
}) {
  const filtered = siteId ? installations.filter(i => i.site_id === siteId) : installations;
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <Label>Site</Label>
        <select value={siteId} onChange={e => onSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
          <option value="">— Sélectionner un site —</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <Label>Installation</Label>
        <select value={installId} onChange={e => onInstallChange(e.target.value)}
          style={{ ...inp, height: 36, opacity: !siteId ? 0.45 : 1 }} disabled={!siteId}>
          <option value="">— Toutes —</option>
          {filtered.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Modale Fichier PDF ────────────────────────────────────────────────────────

function PdfModal({ onClose, sites, installations, dossiers, admins }: {
  onClose: () => void;
  sites: RefOption[];
  installations: RefOption[];
  dossiers: RefOption[];
  admins: AdminUser[];
}) {
  const [nom,         setNom]         = useState('');
  const [description, setDescription] = useState('');
  const [siteId,      setSiteId]      = useState('');
  const [installId,   setInstallId]   = useState('');
  const [dossierId,   setDossierId]   = useState('');
  const [validateurId, setValidateurId] = useState('');
  const [avecRattachement, setAvecRattachement] = useState(true);
  const [pdfFile,     setPdfFile]     = useState<File | null>(null);
  const [pdfPath,     setPdfPath]     = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cascade : installations filtrées par site sélectionné
  const filteredInstallations = siteId
    ? installations.filter(i => i.site_id === siteId)
    : [];

  // Cascade : dossiers filtrés selon site + installation
  // - site vide            → aucun dossier
  // - site seul            → dossiers rattachés à ce site sans installation
  // - site + installation  → dossiers rattachés à ce site ET cette installation
  const filteredDossiers = !siteId
    ? []
    : installId
      ? dossiers.filter(d => d.site_id === siteId && d.installation_id === installId)
      : dossiers.filter(d => d.site_id === siteId && !d.installation_id);

  function handleSiteChange(id: string) {
    setSiteId(id);
    setInstallId('');
    setDossierId('');
  }

  function handleInstallChange(id: string) {
    setInstallId(id);
    setDossierId('');
  }

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') { setError('Seul le format PDF est accepté.'); return; }
    setPdfFile(file); setUploading(true); setError('');
    try {
      const { data } = await db.uploadPdfTemp(file);
      setPdfPath(data.path);
    } catch {
      setError("Erreur lors de l'upload."); setPdfFile(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim())                          { setError('Le nom est requis.'); return; }
    if (!pdfPath)                             { setError('Un fichier PDF est requis.'); return; }
    if (!validateurId)                        { setError('Un validateur est requis.'); return; }
    if (avecRattachement && !dossierId)       { setError('Le rattachement à un dossier est obligatoire.'); return; }
    setSubmitting(true); setError('');
    try {
      await db.submitPourValidation({
        entity_type:       'fichier_pdf',
        payload:           { nom: nom.trim(), description: description.trim() || null },
        site_id:           avecRattachement ? (siteId    || null) : null,
        installation_id:   avecRattachement ? (installId || null) : null,
        dossier_id:        avecRattachement ? dossierId  : null,
        plan_id:           null,
        avec_rattachement: avecRattachement,
        validateur_id:     validateurId,
        storage_path_temp: pdfPath,
      });
      setSuccess(true);
    } catch {
      setError('Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Modal title="Fichier PDF" icon={<IconPdf size={20} />} onClose={onClose} footer={null}>
        <SuccessContent entityLabel="fichier PDF" onClose={onClose} />
      </Modal>
    );
  }

  const dossierDisabled = !siteId;
  const dossierPlaceholder = !siteId
    ? '— Sélectionnez d\'abord un site —'
    : filteredDossiers.length === 0
      ? '— Aucun dossier disponible —'
      : '— Sélectionner un dossier —';

  return (
    <Modal
      title="Soumettre un fichier PDF"
      icon={<IconPdf size={20} />}
      onClose={onClose}
      error={error}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={btn(C.muted, true)}>Annuler</button>
          <button type="button" disabled={submitting || uploading} onClick={handleSubmit}
            style={{ ...btn(C.accent), opacity: submitting || uploading ? 0.6 : 1, cursor: submitting || uploading ? 'not-allowed' : 'pointer' }}>
            {submitting ? <><Spinner /> Soumission…</> : 'Soumettre pour validation'}
          </button>
        </div>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <form onSubmit={handleSubmit}>
        <FormSection title="Informations générales">
          <div>
            <Label>Nom *</Label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Plan de masse 2024" style={inp} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description optionnelle…" style={{ ...inp, minHeight: 68, resize: 'vertical' }} />
          </div>
          <div>
            <Label>Validateur *</Label>
            <select value={validateurId} onChange={e => setValidateurId(e.target.value)} style={{ ...inp, height: 36 }}>
              <option value="">— Sélectionner un validateur —</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
        </FormSection>

        <FormSection title="Fichier PDF *">
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {pdfFile && pdfPath ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: C.surface2, border: `1px solid ${C.success44}`, borderRadius: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfFile.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{(pdfFile.size / 1024).toFixed(0)} Ko · Prêt</div>
              </div>
              <button type="button" onClick={() => { setPdfFile(null); setPdfPath(null); }}
                style={{ ...btn(C.danger, true), padding: '4px 10px', fontSize: 11 }}>Retirer</button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 12,
                padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? C.accent0a : C.surface2, transition: 'border-color .15s, background .15s' }}>
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: C.muted }}>
                  <Spinner /><span style={{ fontSize: 13 }}>Upload en cours…</span>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}><IconPdf size={32} color={C.muted} /></div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>Glissez un PDF ici ou cliquez pour sélectionner</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Format PDF uniquement · Max 5 Mo</div>
                </>
              )}
            </div>
          )}
        </FormSection>

        <FormSection title="">
          <RattachementToggle value={avecRattachement} onChange={v => { setAvecRattachement(v); setSiteId(''); setInstallId(''); setDossierId(''); }} />
          {avecRattachement && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* Étape 1 — Site (obligatoire pour débloquer la suite) */}
              <div>
                <Label>Site *</Label>
                <select value={siteId} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">— Sélectionner un site —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>

              {/* Étape 2 — Installation (optionnelle, débloquée après sélection du site) */}
              <div style={{ opacity: !siteId ? 0.45 : 1 }}>
                <Label>Installation (optionnel)</Label>
                <select value={installId} onChange={e => handleInstallChange(e.target.value)}
                  disabled={!siteId} style={{ ...inp, height: 36 }}>
                  <option value="">— Aucune installation —</option>
                  {filteredInstallations.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
                {siteId && filteredInstallations.length === 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucune installation rattachée à ce site.</p>
                )}
              </div>

              {/* Étape 3 — Dossier (obligatoire, filtré selon site ± installation) */}
              <div style={{ opacity: dossierDisabled ? 0.45 : 1 }}>
                <Label>Dossier *</Label>
                <select value={dossierId} onChange={e => setDossierId(e.target.value)}
                  disabled={dossierDisabled} style={{ ...inp, height: 36 }}>
                  <option value="">{dossierPlaceholder}</option>
                  {filteredDossiers.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
                {siteId && filteredDossiers.length === 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>
                    Aucun dossier{installId ? ' rattaché à cette installation' : ' rattaché uniquement à ce site (sans installation)'}.
                  </p>
                )}
              </div>
            </div>
          )}
        </FormSection>

      </form>
    </Modal>
  );
}

// ── Modale Plan SVG ───────────────────────────────────────────────────────────

function PlanModal({ onClose, sites, installations, admins }: {
  onClose: () => void;
  sites: RefOption[];
  installations: RefOption[];
  admins: AdminUser[];
}) {
  const [nom,         setNom]         = useState('');
  const [description, setDescription] = useState('');
  const [siteId,      setSiteId]      = useState('');
  const [installId,   setInstallId]   = useState('');
  const [validateurId, setValidateurId] = useState('');
  const [avecRattachement, setAvecRattachement] = useState(true);
  const [svgFile,     setSvgFile]     = useState<File | null>(null);
  const [svgPath,     setSvgPath]     = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredInstallations = siteId
    ? installations.filter(i => i.site_id === siteId)
    : [];

  function handleSiteChange(id: string) {
    setSiteId(id);
    setInstallId('');
  }

  async function handleFile(file: File) {
    if (file.type !== 'image/svg+xml') { setError('Seul le format SVG est accepté.'); return; }
    setSvgFile(file); setUploading(true); setError('');
    try {
      const { data } = await db.uploadSvgTemp(file);
      setSvgPath(data.path);
    } catch {
      setError("Erreur lors de l'upload."); setSvgFile(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim())                       { setError('Le nom est requis.'); return; }
    if (!svgPath)                          { setError('Un fichier SVG est requis.'); return; }
    if (!validateurId)                     { setError('Un validateur est requis.'); return; }
    if (avecRattachement && !siteId)       { setError('Le rattachement à un site est obligatoire.'); return; }
    if (avecRattachement && !installId)    { setError('Le rattachement à une installation est obligatoire.'); return; }
    setSubmitting(true); setError('');
    try {
      await db.submitPourValidation({
        entity_type:       'plan',
        payload:           { nom: nom.trim(), description: description.trim() || null, actif: true },
        site_id:           avecRattachement ? siteId    : null,
        installation_id:   avecRattachement ? installId : null,
        dossier_id:        null,
        plan_id:           null,
        avec_rattachement: avecRattachement,
        validateur_id:     validateurId,
        storage_path_temp: svgPath,
      });
      setSuccess(true);
    } catch {
      setError('Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Modal title="Plan SVG" icon={<IconPlan size={20} />} onClose={onClose} footer={null}>
        <SuccessContent entityLabel="plan SVG" onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Soumettre un plan SVG"
      icon={<IconPlan size={20} />}
      onClose={onClose}
      error={error}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={btn(C.muted, true)}>Annuler</button>
          <button type="button" disabled={submitting} onClick={handleSubmit}
            style={{ ...btn(C.accent), opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? <><Spinner /> Soumission…</> : 'Soumettre pour validation'}
          </button>
        </div>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <form onSubmit={handleSubmit}>
        <FormSection title="Informations générales">
          <div>
            <Label>Nom *</Label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Plan électrique bâtiment A" style={inp} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description optionnelle…" style={{ ...inp, minHeight: 68, resize: 'vertical' }} />
          </div>
          <div>
            <Label>Validateur *</Label>
            <select value={validateurId} onChange={e => setValidateurId(e.target.value)} style={{ ...inp, height: 36 }}>
              <option value="">— Sélectionner un validateur —</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
        </FormSection>

        <FormSection title="Fichier SVG *">
          <input ref={fileRef} type="file" accept="image/svg+xml,.svg" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {svgFile && svgPath ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: C.surface2, border: `1px solid ${C.success44}`, borderRadius: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svgFile.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{(svgFile.size / 1024).toFixed(0)} Ko · Prêt</div>
              </div>
              <button type="button" onClick={() => { setSvgFile(null); setSvgPath(null); }}
                style={{ ...btn(C.danger, true), padding: '4px 10px', fontSize: 11 }}>Retirer</button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 12,
                padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? C.accent0a : C.surface2, transition: 'border-color .15s, background .15s' }}>
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: C.muted }}>
                  <Spinner /><span style={{ fontSize: 13 }}>Upload en cours…</span>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}><IconPlan size={32} color={C.muted} /></div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>Glissez un SVG ici ou cliquez pour sélectionner</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Format SVG uniquement · Max 5 Mo</div>
                </>
              )}
            </div>
          )}
        </FormSection>

        <FormSection title="">
          <RattachementToggle value={avecRattachement} onChange={v => { setAvecRattachement(v); setSiteId(''); setInstallId(''); }} />
          {avecRattachement && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <Label>Site *</Label>
                <select value={siteId} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">— Sélectionner un site —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div style={{ opacity: !siteId ? 0.45 : 1 }}>
                <Label>Installation *</Label>
                <select value={installId} onChange={e => setInstallId(e.target.value)}
                  disabled={!siteId} style={{ ...inp, height: 36 }}>
                  <option value="">
                    {!siteId ? '— Sélectionnez d\'abord un site —' : filteredInstallations.length === 0 ? '— Aucune installation disponible —' : '— Sélectionner une installation —'}
                  </option>
                  {filteredInstallations.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
                {siteId && filteredInstallations.length === 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucune installation rattachée à ce site.</p>
                )}
              </div>
            </div>
          )}
        </FormSection>

      </form>
    </Modal>
  );
}

// ── Modale Calque ─────────────────────────────────────────────────────────────

type PropRow = { key: string; defaultVal: string };

function CalqueModal({ onClose, sites, installations, plans, admins }: {
  onClose: () => void;
  sites: RefOption[];
  installations: RefOption[];
  plans: RefOption[];
  admins: AdminUser[];
}) {
  const [nom,         setNom]         = useState('');
  const [description, setDescription] = useState('');
  const [avecRattachement, setAvecRattachement] = useState(true);
  const [propsList,   setPropsList]   = useState<PropRow[]>([]);
  const [siteId,      setSiteId]      = useState('');
  const [installId,   setInstallId]   = useState('');
  const [planId,      setPlanId]      = useState('');
  const [validateurId, setValidateurId] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  const type = (avecRattachement && installId) ? 'non_geographique' : 'geographique';
  const filteredInstallations = siteId ? installations.filter(i => i.site_id === siteId) : [];
  const filteredPlans = installId ? plans.filter(p => p.installation_id === installId) : [];

  function handleSiteChange(id: string) { setSiteId(id); setInstallId(''); setPlanId(''); }
  function handleInstallChange(id: string) { setInstallId(id); setPlanId(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) { setError('Le nom est requis.'); return; }
    if (!validateurId) { setError('Un validateur est requis.'); return; }
    if (avecRattachement && !siteId) { setError('Le rattachement à un site est obligatoire.'); return; }
    if (avecRattachement && installId && !planId) { setError("Un plan est requis lorsqu'une installation est sélectionnée."); return; }
    const validProps = propsList.filter(p => p.key.trim());
    const properties: Record<string, unknown> = {
      'marker-color': '#378ADD',
      'marker-size':  'medium',
      ...Object.fromEntries(validProps.map(p => [p.key.trim(), p.defaultVal || null])),
    };
    const template_champs = validProps.length > 0 || type === 'geographique'
      ? { type: 'Feature', geometry: { type: 'Point', coordinates: [] }, properties }
      : null;

    setSubmitting(true); setError('');
    try {
      await db.submitPourValidation({
        entity_type:       'calque',
        payload:           { nom: nom.trim(), description: description.trim() || null, type, couleur: '#378ADD', zoom_min: 1, zoom_max: 24, template_champs },
        site_id:           avecRattachement ? (siteId    || null) : null,
        installation_id:   avecRattachement ? (installId || null) : null,
        dossier_id:        null,
        plan_id:           avecRattachement ? (planId    || null) : null,
        avec_rattachement: avecRattachement,
        validateur_id:     validateurId,
        storage_path_temp: null,
      });
      setSuccess(true);
    } catch {
      setError('Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Modal title="Calque" icon={<IconCalque size={20} />} onClose={onClose} footer={null}>
        <SuccessContent entityLabel="calque" onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Soumettre un calque"
      icon={<IconCalque size={20} />}
      onClose={onClose}
      error={error}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={btn(C.muted, true)}>Annuler</button>
          <button type="button" disabled={submitting} onClick={handleSubmit}
            style={{ ...btn(C.accent), opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? <><Spinner /> Soumission…</> : 'Soumettre pour validation'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormSection title="Informations générales">
          <div>
            <Label>Nom *</Label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Prises électriques" style={inp} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description optionnelle…" style={{ ...inp, minHeight: 68, resize: 'vertical' }} />
          </div>
          <div>
            <Label>Validateur *</Label>
            <select value={validateurId} onChange={e => setValidateurId(e.target.value)} style={{ ...inp, height: 36 }}>
              <option value="">— Sélectionner un validateur —</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
        </FormSection>

        <FormSection title="Propriétés du template GeoJSON (optionnel)">
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
                  style={{ width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`,
                    borderRadius: 6, color: C.danger, cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => setPropsList(prev => [...prev, { key: '', defaultVal: '' }])}
              style={{ ...btn(C.accent, true), alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px' }}>
              + Ajouter une propriété
            </button>
          </div>
        </FormSection>

        <FormSection title="">
          <RattachementToggle value={avecRattachement} onChange={v => { setAvecRattachement(v); setSiteId(''); setInstallId(''); setPlanId(''); }} />
          {avecRattachement && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <Label>Site *</Label>
                <select value={siteId} onChange={e => handleSiteChange(e.target.value)} style={{ ...inp, height: 36 }}>
                  <option value="">— Sélectionner un site —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>

              {siteId && (
                <div>
                  <Label>Installation (optionnel — rend le calque non géographique)</Label>
                  <select value={installId} onChange={e => handleInstallChange(e.target.value)} style={{ ...inp, height: 36 }}>
                    <option value="">— Aucune (calque géographique) —</option>
                    {filteredInstallations.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                  </select>
                  {filteredInstallations.length === 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucune installation rattachée à ce site.</p>
                  )}
                </div>
              )}

              {installId && (
                <div>
                  <Label>Plan *</Label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...inp, height: 36 }}>
                    <option value="">{filteredPlans.length === 0 ? '— Aucun plan disponible —' : '— Sélectionner un plan —'}</option>
                    {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                  {filteredPlans.length === 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: C.muted }}>Aucun plan rattaché à cette installation.</p>
                  )}
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

      </form>
    </Modal>
  );
}

// ── Cartes de sélection ───────────────────────────────────────────────────────

const CARDS: { type: EntityType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    type: 'fichier_pdf',
    label: 'Fichier PDF',
    description: 'Soumettre un document PDF à intégrer dans un dossier existant.',
    icon: <IconPdf size={36} />,
  },
  {
    type: 'plan',
    label: 'Plan SVG',
    description: 'Proposer un plan vectoriel à rattacher à une installation.',
    icon: <IconPlan size={36} />,
  },
  {
    type: 'calque',
    label: 'Calque',
    description: 'Créer un calque de données géographiques ou de points.',
    icon: <IconCalque size={36} />,
  },
];

// ── Page principale ───────────────────────────────────────────────────────────

export default function SoumettreAjoutPage() {
  const { user } = useAuth();
  const [openModal,     setOpenModal]     = useState<EntityType | null>(null);
  const [sites,         setSites]         = useState<RefOption[]>([]);
  const [installations, setInstallations] = useState<RefOption[]>([]);
  const [dossiers,      setDossiers]      = useState<RefOption[]>([]);
  const [plans,         setPlans]         = useState<RefOption[]>([]);
  const [admins,        setAdmins]        = useState<AdminUser[]>([]);

  useEffect(() => {
    db.list('sites').then(({ data }) =>
      setSites((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    ).catch(() => {});
    db.list('installations').then(({ data }) =>
      setInstallations(data as RefOption[])
    ).catch(() => {});
    db.list('dossiers').then(({ data }) =>
      setDossiers((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    ).catch(() => {});
    db.list('plans').then(({ data }) =>
      setPlans((data as RefOption[]).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    ).catch(() => {});
    db.listAdmins().then(({ data }) =>
      setAdmins(data)
    ).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '48px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ maxWidth: 720, margin: '0 auto 48px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: C.text }}>Soumettre un ajout</h1>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
          {user?.nom ? `Connecté en tant que ${user.nom} · ` : ''}
          Choisissez le type d'entité à soumettre. La demande sera examinée par un administrateur avant intégration.
        </p>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {CARDS.map(card => (
          <button
            key={card.type}
            onClick={() => setOpenModal(card.type)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              gap: 16, padding: '36px 24px', borderRadius: 16, cursor: 'pointer',
              background: C.surface, border: `1.5px solid ${C.border}`,
              transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent;
              (e.currentTarget as HTMLButtonElement).style.background  = C.accent0a;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
              (e.currentTarget as HTMLButtonElement).style.background  = C.surface;
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 16, background: C.accent18,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{card.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Modales */}
      {openModal === 'fichier_pdf' && (
        <PdfModal onClose={() => setOpenModal(null)} sites={sites} installations={installations} dossiers={dossiers} admins={admins} />
      )}
      {openModal === 'plan' && (
        <PlanModal onClose={() => setOpenModal(null)} sites={sites} installations={installations} admins={admins} />
      )}
      {openModal === 'calque' && (
        <CalqueModal onClose={() => setOpenModal(null)} sites={sites} installations={installations} plans={plans} admins={admins} />
      )}
    </div>
  );
}
