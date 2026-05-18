const C = { bg: '#0E1117', text: '#E8EDF5', muted: '#6B7A99', border: '#232B3E' };

export default function DashboardDatabasePage() {
  return (
    <div style={{ padding: '32px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: C.text }}>Base de données</h1>
      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Vue d'ensemble de la base de données.</p>
    </div>
  );
}
