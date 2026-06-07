import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db } from '@/api/database';
import { Modal } from '@/components/Modal';
import { C } from '@/constants/colors';
import { PlanRow, GRID, type Plan } from './PlanCalquesSection';
import { extractErrorMessage } from '@/lib/errors';

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
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

type Option = { value: string; label: string; [key: string]: string };
type PlanFormData = { site_id: string; installation_id: string; nom: string; description: string; editeur: string; actif: boolean };

// ── Styles ────────────────────────────────────────────────────────────────────

const btn = (color = C.accent, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  background: outlined ? 'transparent' : color + '22',
  border: `1px solid ${outlined ? C.border : color + '55'}`,
  color: outlined ? C.muted : color,
  transition: 'opacity .15s',
});

const inp = {
  width: '100%', padding: '8px 11px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' as const,
};

const sel = {
  height: 34, padding: '0 10px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', cursor: 'pointer',
} as const;

// ── PlanModal (create / edit) ─────────────────────────────────────────────────

function PlanModal({ initial, siteOptions, installOptions, userOptions, onSave, onDeleteSvg, onClose }: {
  initial?: Partial<Plan>;
  siteOptions: Option[];
  installOptions: Option[];
  userOptions: Option[];
  onSave: (data: PlanFormData) => Promise<void>;
  onDeleteSvg?: () => Promise<void>;
  onClose: () => void;
}) {
  const derivedSiteId = initial?.installation_id
    ? (installOptions.find(i => i.value === initial.installation_id)?.site_id ?? '')
    : (initial?.site_id ?? '');

  const [form, setForm] = useState<PlanFormData>({
    site_id:         derivedSiteId,
    installation_id: initial?.installation_id ?? '',
    nom:             initial?.nom ?? '',
    description:     initial?.description ?? '',
    editeur:         initial?.editeur ?? '',
    actif:           initial?.actif !== undefined ? initial.actif : true,
  });
  const [saving,      setSaving]      = useState(false);
  const [deletingSvg, setDeletingSvg] = useState(false);
  const [err,         setErr]         = useState('');

  const filteredInstalls = form.site_id ? installOptions.filter(i => i.site_id === form.site_id) : [];

  const set = (k: keyof PlanFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (k === 'site_id') { setForm(f => ({ ...f, site_id: e.target.value, installation_id: '' })); return; }
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim() || !form.site_id || !form.installation_id) { setErr('Nom, Site et Installation sont requis.'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch (e) { setErr(extractErrorMessage(e, 'Erreur lors de la sauvegarde.')); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      title={initial?.id ? 'Modifier le plan' : 'Nouveau plan'}
      onClose={onClose} maxWidth={520}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btn(C.muted, true)} onClick={onClose}>Annuler</button>
          <button type="button" disabled={saving || deletingSvg} style={btn(C.accent)} onClick={submit as unknown as React.MouseEventHandler}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      }
    >
      <form onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Site *</label>
            <select value={form.site_id} onChange={set('site_id')} style={{ ...inp, height: 34 }}>
              <option value="">Sélectionner un site</option>
              {siteOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Installation *</label>
            <select value={form.installation_id} onChange={set('installation_id')} disabled={!form.site_id} style={{ ...inp, height: 34, opacity: form.site_id ? 1 : 0.4, cursor: form.site_id ? 'pointer' : 'not-allowed' }}>
              <option value="">Sélectionner une installation</option>
              {filteredInstalls.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Nom *</label>
              <input value={form.nom} onChange={set('nom')} style={inp} placeholder="Nom du plan" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', height: 34, flexShrink: 0 }}>
              <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} style={{ width: 36, height: 20, borderRadius: 10, background: form.actif ? C.accent : C.border, position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: 3, left: form.actif ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 13, color: C.text }}>Actif</span>
            </label>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={set('description')} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Description…" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Éditeur</label>
            <select value={form.editeur} onChange={set('editeur')} style={{ ...inp, height: 34 }}>
              <option value="">—</option>
              {userOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>
        {initial?.svg_path && onDeleteSvg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={initial.svg_path}>{initial.svg_path}</span>
            <button type="button" disabled={deletingSvg || saving}
              onClick={async () => { setDeletingSvg(true); try { await onDeleteSvg(); } catch (e) { setErr(extractErrorMessage(e, 'Erreur suppression SVG.')); } finally { setDeletingSvg(false); } }}
              style={{ ...btn(C.danger), padding: '3px 10px', fontSize: 11, flexShrink: 0 }}>
              {deletingSvg ? '…' : 'Supprimer le SVG'}
            </button>
          </div>
        )}
        {err && <p style={{ color: C.danger, fontSize: 12, margin: '12px 0 0' }}>{err}</p>}
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const { user } = useAuth();
  const canWrite = user?.role === ROLES.ADMIN_APP || user?.role === ROLES.ADMIN_DATA;

  const [plans,          setPlans]          = useState<Plan[]>([]);
  const [siteOptions,    setSiteOptions]    = useState<Option[]>([]);
  const [installOptions, setInstallOptions] = useState<Option[]>([]);
  const [userOptions,    setUserOptions]    = useState<Option[]>([]);
  const [siteFilter,     setSiteFilter]     = useState('');
  const [installFilter,  setInstallFilter]  = useState('');
  const [loading,        setLoading]        = useState(true);
  const [siteSort,       setSiteSort]       = useState<'asc' | 'desc' | null>(null);

  const [planModal,    setPlanModal]    = useState<{ mode: 'create' | 'edit'; plan?: Plan } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);

  const [reorderModal, setReorderModal] = useState(false);
  const [reorderList,  setReorderList]  = useState<Plan[]>([]);
  const [reordering,   setReordering]   = useState(false);
  const [dragOverIdx,  setDragOverIdx]  = useState<number | null>(null);
  const reorderDragIdx = useRef<number | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try { const { data } = await db.list('plans'); setPlans((data ?? []) as unknown as Plan[]); }
    catch { setPlans([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadPlans();
    db.list('sites').then(({ data }) =>
      setSiteOptions((data as { id: string; nom: string }[]).map(s => ({ value: s.id, label: s.nom })))
    ).catch(() => {});
    db.list('installations').then(({ data }) =>
      setInstallOptions((data as { id: string; nom: string; site_id: string }[]).map(i => ({ value: i.id, label: i.nom, site_id: i.site_id })))
    ).catch(() => {});
    db.list('user_profiles').then(({ data }) =>
      setUserOptions((data as { id: string; nom: string }[]).map(u => ({ value: u.nom, label: u.nom })))
    ).catch(() => {});
  }, [loadPlans]);

  const siteInstallOptions = siteFilter ? installOptions.filter(i => i.site_id === siteFilter) : [];

  const filtered = plans
    .filter(p => {
      if (siteFilter && p.site_id !== siteFilter) return false;
      if (installFilter && p.installation_id !== installFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (!siteSort) return 0;
      const dir = siteSort === 'asc' ? 1 : -1;
      if (a.site_order !== b.site_order) return (a.site_order - b.site_order) * dir;
      if (a.installation_order !== b.installation_order) return (a.installation_order - b.installation_order) * dir;
      return (a.order - b.order) * dir;
    });

  async function savePlan(data: PlanFormData) {
    const payload = { site_id: data.site_id, installation_id: data.installation_id || null, nom: data.nom, description: data.description || null, editeur: data.editeur || null, actif: data.actif };
    if (planModal?.mode === 'edit' && planModal.plan) await db.update('plans', planModal.plan.id, payload);
    else await db.create('plans', payload);
    await loadPlans();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await db.remove('plans', deleteTarget.id);
    setDeleteTarget(null);
    await loadPlans();
  }

  const reorderable = !!siteFilter && !!installFilter;

  function openReorder() { setReorderList([...filtered]); setReorderModal(true); }
  function onReorderDragStart(idx: number) { reorderDragIdx.current = idx; }
  function onReorderDragEnter(idx: number) { if (reorderDragIdx.current !== null && reorderDragIdx.current !== idx) setDragOverIdx(idx); }
  function onReorderDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const src = reorderDragIdx.current;
    if (src !== null && src !== targetIdx) {
      setReorderList(prev => { const next = [...prev]; const [item] = next.splice(src, 1); next.splice(targetIdx, 0, item); return next; });
    }
    reorderDragIdx.current = null; setDragOverIdx(null);
  }
  function onReorderDragEnd() { reorderDragIdx.current = null; setDragOverIdx(null); }

  async function handleSaveOrder() {
    setReordering(true);
    try {
      await Promise.all(reorderList.map((p, i) => db.update('plans', p.id, { order: i })));
      setReorderModal(false);
      await loadPlans();
    } catch { }
    finally { setReordering(false); }
  }

  const uploadSvgForPlan = (plan: Plan) => async (file: File) => {
    const { data: upload } = await db.uploadSvg(file, plan.id);
    const updateData: Record<string, unknown> = { svg_path: upload.path };
    if (upload.width  != null) updateData.largeur_px = upload.width;
    if (upload.height != null) updateData.hauteur_px = upload.height;
    await db.update('plans', plan.id, updateData);
    await loadPlans();
  };

  const selDisabled = { ...sel, cursor: 'not-allowed' as const, opacity: 0.4 };

  return (
    <div style={{ height: '100%', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0, padding: '28px 40px 0' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Plans SVG</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite && reorderable && (
            <button onClick={openReorder} title="Réordonner" style={{ width: 34, height: 34, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '50%', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ReorderIcon />
            </button>
          )}
          {canWrite && (
            <button style={btn(C.accent)} onClick={() => setPlanModal({ mode: 'create' })}>
              <PlusIcon /> Nouveau plan
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0, padding: '0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Site</span>
          <select value={siteFilter} onChange={e => { setSiteFilter(e.target.value); setInstallFilter(''); }} style={sel}>
            <option value="">Tous les sites</option>
            {siteOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Installation</span>
          <select value={installFilter} onChange={e => setInstallFilter(e.target.value)} disabled={!siteFilter} style={siteFilter ? sel : selDisabled}>
            <option value="">Toutes</option>
            {siteInstallOptions.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'auto', flex: 1, margin: '0 40px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '0 12px', minHeight: 36, background: C.surface2, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 2 }}>
          <span />
          {(['Nom', 'Actif'] as const).map(label => (
            <span key={label} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          ))}
          <span onClick={() => setSiteSort(s => s === 'asc' ? 'desc' : 'asc')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', fontSize: 11, fontWeight: 600, color: siteSort ? C.accent : C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Site
            <span style={{ fontSize: 10, lineHeight: 1, opacity: siteSort ? 1 : 0.6 }}>{siteSort === 'asc' ? '▲' : siteSort === 'desc' ? '▼' : '⇅'}</span>
          </span>
          {(['Installation', 'Description'] as const).map(label => (
            <span key={label} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
          ))}
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</span>
        </div>

        {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Chargement…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucun plan trouvé.</div>}
        {!loading && filtered.map(p => (
          <PlanRow
            key={p.id}
            plan={p}
            canWrite={canWrite}
            onEdit={() => setPlanModal({ mode: 'edit', plan: p })}
            onDelete={() => setDeleteTarget(p)}
            onUploadSvg={uploadSvgForPlan(p)}
          />
        ))}
      </div>

      {planModal && (
        <PlanModal
          initial={planModal.plan}
          siteOptions={siteOptions}
          installOptions={installOptions}
          userOptions={userOptions}
          onSave={savePlan}
          onDeleteSvg={planModal.plan ? async () => {
            await db.update('plans', planModal.plan!.id, { svg_path: null, largeur_px: null, hauteur_px: null });
            await loadPlans();
            setPlanModal(null);
          } : undefined}
          onClose={() => setPlanModal(null)}
        />
      )}
      {deleteTarget && (
        <Modal title="Confirmation" onClose={() => setDeleteTarget(null)}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDelete}>Supprimer</button>
            </div>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer le plan « ${deleteTarget.nom} » et tous ses calques ?`}</p>
        </Modal>
      )}

      {reorderModal && (
        <Modal title="Ordre — Plans" onClose={() => setReorderModal(false)} maxWidth={420}
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
            {reorderList.map((p, i) => (
              <div key={p.id} draggable
                onDragStart={() => onReorderDragStart(i)}
                onDragEnter={() => onReorderDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onReorderDrop(e, i)}
                onDragEnd={onReorderDragEnd}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.surface, border: `1px solid ${dragOverIdx === i ? C.accent : C.border}`, borderRadius: 8, cursor: 'grab', userSelect: 'none', transition: 'border-color 0.1s', ...(dragOverIdx === i ? { background: '#12213A' } : {}) }}
              >
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex' }}><GripIcon /></span>
                <span style={{ fontSize: 13, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
