import { useState, useEffect } from 'react';
import CrudPage, { type ColumnDef, type FieldDef } from './CrudPage';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/api/database';
import { Modal } from '@/components/Modal';
import { C } from '@/constants/colors';

type SiteOption = { value: string; label: string };
type Row = Record<string, unknown>;

const fmtCoord = (v: unknown) => v != null && v !== '' ? `${Number(v).toFixed(5)}°` : '—';
const COORD_PATTERN = /^-?\d{1,3}(\.\d+)?$/;

function SpinnerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
}

const btn = (color = C.accent, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px',
  borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  background: outlined ? 'transparent' : color + '22',
  border: `1px solid ${outlined ? C.border : color + '55'}`,
  color: outlined ? C.muted : color,
} as React.CSSProperties);

type InstallStats = {
  dossierCount: number;
  fichierCount:  number;
  planCount:     number;
  calqueCount:   number;
  pointCount:    number;
};

const columns: ColumnDef[] = [
  { key: 'nom',         label: 'Nom' },
  { key: 'site_nom',    label: 'Site',   sortable: true, sortKeys: ['site_nom', 'order'] },
  { key: 'order',       label: 'Ordre' },
  { key: 'zoom_defaut', label: 'Zoom' },
  { key: 'lat',         label: 'Lat',    render: fmtCoord },
  { key: 'lng',         label: 'Lng',    render: fmtCoord },
  { key: 'actif',       label: 'Actif',  render: v => v ? '✓' : '✗' },
];

export default function InstallationsPage() {
  const { user } = useAuth();
  const [sites, setSites]           = useState<SiteOption[]>([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [reloadKey, setReloadKey]   = useState(0);

  const [deleteTarget,       setDeleteTarget]       = useState<Row | null>(null);
  const [deleteStats,        setDeleteStats]        = useState<InstallStats | null>(null);
  const [deleteStatsLoading, setDeleteStatsLoading] = useState(false);

  useEffect(() => {
    db.list('sites')
      .then(({ data }) =>
        setSites((data as { id: string; nom: string }[]).map(s => ({ value: s.id, label: s.nom })))
      )
      .catch(() => {});
  }, []);

  async function handleDeleteClick(row: Row) {
    const installId = row.id as string;
    setDeleteTarget(row);
    setDeleteStats(null);
    setDeleteStatsLoading(true);
    try {
      const [dossiersRes, plansRes] = await Promise.all([
        db.list('dossiers'),
        db.list('plans'),
      ]);
      const allDossiers = (dossiersRes.data ?? []) as { id: string; installation_id: string | null }[];
      const allPlans    = (plansRes.data   ?? []) as { id: string; installation_id: string | null }[];
      const myDossiers  = allDossiers.filter(d => d.installation_id === installId);
      const myPlans     = allPlans.filter(p => p.installation_id === installId);

      const fichiersResults = await Promise.all(myDossiers.map(d => db.listFichiersPdf(d.id)));
      const fichierCount    = fichiersResults.reduce((acc, r) => acc + (r.data ?? []).length, 0);

      const calquesResults = await Promise.all(myPlans.map(p => db.listCalques(p.id)));
      const allCalques     = calquesResults.flatMap(r => r.data ?? []);

      const pointsResults  = await Promise.all(allCalques.map(c => db.listPoints(c.id)));
      const pointCount     = pointsResults.reduce((acc, r) => acc + (r.data ?? []).length, 0);

      setDeleteStats({
        dossierCount: myDossiers.length,
        fichierCount,
        planCount:    myPlans.length,
        calqueCount:  allCalques.length,
        pointCount,
      });
    } catch {
      setDeleteStats({ dossierCount: 0, fichierCount: 0, planCount: 0, calqueCount: 0, pointCount: 0 });
    } finally {
      setDeleteStatsLoading(false);
    }
  }

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteStats(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await db.remove('installations', deleteTarget.id as string);
    closeDeleteModal();
    setReloadKey(k => k + 1);
  }

  const hasContent = deleteStats && (deleteStats.dossierCount > 0 || deleteStats.planCount > 0);

  const fields: FieldDef[] = [
    { key: 'site_id',     label: 'Site',            type: 'select',  options: sites, required: true },
    { key: 'nom',         label: 'Nom',             type: 'text',    required: true, layoutGroup: 'nom_actif' },
    { key: 'actif',       label: 'Actif',           type: 'boolean', layoutGroup: 'nom_actif', layoutFlex: '0 0 auto' },
    { key: 'zoom_defaut', label: 'Zoom par défaut', type: 'number', min: 1, max: 22, defaultValue: 13 },
    { key: 'lat', label: 'Latitude',  type: 'text', pattern: COORD_PATTERN, patternMessage: 'Décimal attendu (ex : 43.320311)', defaultValue: '43.320311', layoutGroup: 'geopoint' },
    { key: 'lng', label: 'Longitude', type: 'text', pattern: COORD_PATTERN, patternMessage: 'Décimal attendu (ex : 5.362281)',  defaultValue: '5.362281',  layoutGroup: 'geopoint' },
  ];

  const filterSlot = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Site</span>
      <select
        value={siteFilter}
        onChange={e => setSiteFilter(e.target.value)}
        style={{ height: 34, padding: '0 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', cursor: 'pointer' }}
      >
        <option value="">Tous les sites</option>
        {sites.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <CrudPage
        key={reloadKey}
        entity="installations"
        title="Installations"
        columns={columns}
        fields={fields}
        canWrite={!!user}
        reorderable={!!siteFilter}
        orderKey="order"
        orderLabel="nom"
        filterFn={siteFilter ? row => row.site_id === siteFilter : undefined}
        filterSlot={filterSlot}
        onDeleteClick={handleDeleteClick}
      />
      {deleteTarget && (
        <Modal
          title="Confirmation"
          onClose={closeDeleteModal}
          maxWidth={420}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={closeDeleteModal}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDelete} disabled={deleteStatsLoading}>Supprimer</button>
            </div>
          }
        >
          {deleteStatsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted }}><SpinnerIcon /> Chargement…</div>
          ) : hasContent ? (
            <div style={{ fontSize: 14, color: C.text }}>
              <p style={{ margin: '0 0 10px' }}>
                {`Supprimer l'installation « ${deleteTarget.nom as string} » supprimera également :`}
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {deleteStats!.dossierCount > 0 && (
                  <li>
                    {`${deleteStats!.dossierCount} dossier${deleteStats!.dossierCount > 1 ? 's' : ''} et ${deleteStats!.fichierCount} fichier${deleteStats!.fichierCount > 1 ? 's' : ''}`}
                  </li>
                )}
                {deleteStats!.planCount > 0 && (
                  <li>
                    {`${deleteStats!.planCount} plan${deleteStats!.planCount > 1 ? 's' : ''} SVG, ${deleteStats!.calqueCount} calque${deleteStats!.calqueCount > 1 ? 's' : ''} et ${deleteStats!.pointCount} point${deleteStats!.pointCount > 1 ? 's' : ''}`}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer l'installation « ${deleteTarget.nom as string} » ?`}</p>
          )}
        </Modal>
      )}
    </>
  );
}
