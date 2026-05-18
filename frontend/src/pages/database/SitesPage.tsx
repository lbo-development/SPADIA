import CrudPage, { type ColumnDef, type FieldDef } from './CrudPage';
import { useAuth } from '@/context/AuthContext';

const fmtCoord = (v: unknown) => v != null && v !== '' ? `${Number(v).toFixed(5)}°` : '—';

const columns: ColumnDef[] = [
  { key: 'nom',         label: 'Nom' },
  { key: 'order',       label: 'Ordre',  sortable: true },
  { key: 'zoom_defaut', label: 'Zoom' },
  { key: 'lat',         label: 'Lat',    render: fmtCoord },
  { key: 'lng',         label: 'Lng',    render: fmtCoord },
  { key: 'actif',       label: 'Actif',  render: v => v ? '✓' : '✗' },
];

const COORD_PATTERN = /^-?\d{1,3}(\.\d+)?$/;

const fields: FieldDef[] = [
  { key: 'nom',         label: 'Nom',              type: 'text',    required: true, layoutGroup: 'nom_actif' },
  { key: 'actif',       label: 'Actif',             type: 'boolean', layoutGroup: 'nom_actif', layoutFlex: '0 0 auto' },
  { key: 'zoom_defaut', label: 'Zoom par défaut', type: 'number', min: 1, max: 22, defaultValue: 13 },
  { key: 'lat', label: 'Latitude',  type: 'text', pattern: COORD_PATTERN, patternMessage: 'Décimal attendu (ex : 43.320311)', defaultValue: '43.320311', layoutGroup: 'geopoint' },
  { key: 'lng', label: 'Longitude', type: 'text', pattern: COORD_PATTERN, patternMessage: 'Décimal attendu (ex : 5.362281)',  defaultValue: '5.362281',  layoutGroup: 'geopoint' },
];

export default function SitesPage() {
  const { user } = useAuth();
  return (
    <CrudPage
      entity="sites"
      title="Sites"
      columns={columns}
      fields={fields}
      canWrite={!!user}
      reorderable
      orderKey="order"
      orderLabel="nom"
    />
  );
}
