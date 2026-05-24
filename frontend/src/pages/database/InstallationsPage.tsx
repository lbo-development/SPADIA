import { useState, useEffect } from 'react';
import CrudPage, { type ColumnDef, type FieldDef } from './CrudPage';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/api/database';

type SiteOption = { value: string; label: string };

const fmtCoord = (v: unknown) => v != null && v !== '' ? `${Number(v).toFixed(5)}°` : '—';
const COORD_PATTERN = /^-?\d{1,3}(\.\d+)?$/;

const columns: ColumnDef[] = [
  { key: 'nom',         label: 'Nom' },
  { key: 'site_nom',    label: 'Site',   sortable: true, sortKeys: ['site_nom', 'order'] },
  { key: 'order',       label: 'Ordre' },
  { key: 'zoom_defaut', label: 'Zoom' },
  { key: 'lat',         label: 'Lat',    render: fmtCoord },
  { key: 'lng',         label: 'Lng',    render: fmtCoord },
  { key: 'actif',       label: 'Actif',  render: v => v ? '✓' : '✗' },
];

import { C } from '@/constants/colors';

export default function InstallationsPage() {
  const { user } = useAuth();
  const [sites, setSites]           = useState<SiteOption[]>([]);
  const [siteFilter, setSiteFilter] = useState('');

  useEffect(() => {
    db.list('sites')
      .then(({ data }) =>
        setSites((data as { id: string; nom: string }[]).map(s => ({ value: s.id, label: s.nom })))
      )
      .catch(() => {});
  }, []);

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
    <CrudPage
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
    />
  );
}
