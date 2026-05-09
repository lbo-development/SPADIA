import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, type DashboardStats, type QuickAccessData } from '@/api/dashboard';
import { ROLES } from '@/constants/roles';

export default function DataAccessPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const role = user?.role ?? '';

  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [quickAccess, setQuickAccess] = useState<QuickAccessData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selSite, setSelSite]         = useState('');
  const [selPlan, setSelPlan]         = useState('');
  const [selDossier, setSelDossier]   = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [s, q] = await Promise.all([dashboardApi.getStats(), dashboardApi.getQuickAccess()]);
        setStats(s.data);
        setQuickAccess(q.data);
        if (q.data.sites[0])    setSelSite(q.data.sites[0].id);
        if (q.data.plans[0])    setSelPlan(q.data.plans[0].id);
        if (q.data.dossiers[0]) setSelDossier(q.data.dossiers[0].id);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const canValidate = role === ROLES.ADMIN_APP || role === ROLES.ADMIN_DATA;
  const isUser      = role === ROLES.USER;
  const total       = stats ? Object.values(stats.pending).reduce((a, b) => a + b, 0) : 0;

  async function handleLogout() { await logout(); navigate('/login'); }

  return (
    <div style={s.root}>
      {/* Navbar */}
      <nav style={s.nav}>
        <span style={s.logoMark}>◈</span>
        <span style={s.logoText}>SPADIA</span>
        <div style={{ flex: 1 }} />
        <span style={s.roleTag}>{user?.role}</span>
        <span style={s.userName}>{user?.nom}</span>
        <button style={s.logoutBtn} onClick={handleLogout}>Déconnexion</button>
      </nav>

      <main style={s.main}>
        {/* En-tête */}
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>Bonjour, {user?.nom?.split(' ')[0]} ·</h1>
            <p style={s.pageSubtitle}>Tableau de bord SPADIA</p>
          </div>
          {total > 0 && (
            <div style={s.alertBadge}>
              <span style={s.alertDot} />
              {total} élément{total > 1 ? 's' : ''} en attente
            </div>
          )}
        </div>

        {loading ? (
          <div style={s.loadingWrap}><div style={s.spinner} /></div>
        ) : (
          <div style={s.grid}>
            {/* Colonne gauche */}
            <div>
              <div style={s.sectionLabel}>Vue d'ensemble</div>
              <div style={s.statsGrid}>
                <StatCard value={stats?.overview.sites ?? 0}         label="Sites"         color="#378ADD" />
                <StatCard value={stats?.overview.installations ?? 0} label="Installations" color="#1D9E75" />
                <StatCard value={stats?.overview.plans ?? 0}         label="Plans SVG"     color="#BA7517" />
                <StatCard value={stats?.overview.dossiers ?? 0}      label="Dossiers"      color="#8B5CF6" />
              </div>

              <div style={{ ...s.sectionLabel, marginTop: 24 }}>Activité en attente</div>
              <div style={s.card}>
                {(['plans', 'calques', 'dossiers', 'photos'] as const).map((key, i, arr) => (
                  <div key={key} style={{ ...s.pendingRow, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>
                    <span style={s.pendingLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                    <span style={s.pendingBadge}>{stats?.pending[key] ?? 0}</span>
                    {(stats?.pending[key] ?? 0) > 0 && canValidate && (
                      <button style={s.actionBtn}>Traiter →</button>
                    )}
                    {(stats?.pending[key] ?? 0) > 0 && isUser && (
                      <button style={s.actionBtn}>Voir</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne droite */}
            <div>
              <div style={s.sectionLabel}>Accès rapide</div>
              <div style={s.card}>
                <QuickRow label="Carte"    value={selSite}    onChange={setSelSite}    options={quickAccess?.sites ?? []}    onOpen={() => navigate(`/carte?site=${selSite}`)} />
                <QuickRow label="Plan SVG" value={selPlan}    onChange={setSelPlan}    options={quickAccess?.plans ?? []}    onOpen={() => navigate(`/carte?plan=${selPlan}`)} />
                <QuickRow label="Dossier"  value={selDossier} onChange={setSelDossier} options={quickAccess?.dossiers ?? []} onOpen={() => {}} last />
              </div>

              <div style={{ ...s.sectionLabel, marginTop: 24 }}>Navigation</div>
              <button style={s.mapBtn} onClick={() => navigate('/carte')}>
                ◈ Ouvrir la carte interactive →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: '#161B27', border: '1px solid #232B3E', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginBottom: 6 }}>◆</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#E8EDF5' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#6B7A99' }}>{label}</div>
    </div>
  );
}

function QuickRow({ label, value, onChange, options, onOpen, last = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; nom: string }[]; onOpen: () => void; last?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: last ? 'none' : '1px solid #232B3E' }}>
      <span style={{ fontSize: 12, color: '#6B7A99', width: 68, flexShrink: 0 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ flex: 1, height: 28, background: '#1C2333', border: '1px solid #232B3E', borderRadius: 5, padding: '0 8px', fontSize: 12, color: '#E8EDF5', outline: 'none' }}
        disabled={options.length === 0}>
        {options.length === 0
          ? <option>Aucun disponible</option>
          : options.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
      </select>
      <button onClick={onOpen} disabled={!value || options.length === 0}
        style={{ height: 28, padding: '0 12px', background: '#185FA5', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#fff' }}>
        Ouvrir
      </button>
    </div>
  );
}

const C = { bg: '#0E1117', surface: '#161B27', border: '#232B3E', primary: '#185FA5', accent: '#378ADD', text: '#E8EDF5', muted: '#6B7A99' };
const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: C.bg, fontFamily: '"Segoe UI", sans-serif' },
  nav: { height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', position: 'sticky', top: 0, zIndex: 100 },
  logoMark: { fontSize: 16, color: C.accent },
  logoText: { fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '0.1em' },
  roleTag: { fontSize: 11, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px' },
  userName: { fontSize: 12, color: C.muted },
  logoutBtn: { height: 28, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, color: C.muted },
  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: C.text, margin: 0 },
  pageSubtitle: { fontSize: 12, color: C.muted, margin: '4px 0 0' },
  alertBadge: { display: 'flex', alignItems: 'center', gap: 8, background: '#BA751718', border: '1px solid #BA751744', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#BA7517', fontWeight: 500 },
  alertDot: { width: 7, height: 7, borderRadius: '50%', background: '#BA7517', display: 'inline-block' },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner: { width: 28, height: 28, border: '2px solid #232B3E', borderTopColor: '#378ADD', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' },
  pendingRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${C.border}` },
  pendingLabel: { fontSize: 13, color: C.text, flex: 1 },
  pendingBadge: { minWidth: 26, height: 20, borderRadius: 10, background: '#378ADD22', color: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, padding: '0 7px' },
  actionBtn: { background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px', fontSize: 11, color: C.muted, cursor: 'pointer' },
  mapBtn: { width: '100%', padding: '14px 16px', background: '#185FA522', border: '1px solid #185FA555', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.accent },
};