import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';

const PALETTE = ['#0078D4','#107C10','#D83B01','#5C2D91','#038387','#CA5010','#00B294','#B4009E'];
function nameColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

const ENTITIES = [
  { path: 'sites',         label: 'Sites' },
  { path: 'installations', label: 'Installations' },
  { path: 'plans',         label: 'Plans SVG' },
  { path: 'calques',       label: 'Calques géographiques' },
  { path: 'dossiers',      label: 'Dossiers' },
  { path: 'markers',       label: 'Markers' },
  { path: 'utilisateurs',  label: 'Utilisateurs', adminOnly: true },
];

export default function DatabaseLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isAdminApp = user?.role === ROLES.ADMIN_APP;
  const entities = ENTITIES.filter(e => !e.adminOnly || isAdminApp);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <img src="/logos-DBo.png" alt="Logo" style={{ height: 30, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <span style={s.logoText}>SPADIA</span>
        <span style={s.separator}>/</span>
        <span style={s.section}>Base de données</span>
        <div style={{ flex: 1 }} />
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>← Tableau de bord</button>
        {user && (
          <div
            title={`${user.nom}\n${user.role}`}
            style={{ width: 28, height: 28, borderRadius: '50%', background: nameColor(user.nom), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'default' }}
          >
            {user.avatar_url && !avatarFailed
              ? <img src={user.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', userSelect: 'none' }}>{initials(user.nom)}</span>
            }
          </div>
        )}
        <button style={s.logoutBtn} onClick={handleLogout}>Déconnexion</button>
      </nav>

      <div style={s.layout}>
        <aside style={s.sidebar}>
          <div style={s.sidebarLabel}>Entités</div>
          {entities.map(e => (
            <NavLink key={e.path} to={`/database/${e.path}`}
              style={({ isActive }) => ({ ...s.sidebarLink, ...(isActive ? s.sidebarLinkActive : {}) })}>
              {e.label}
            </NavLink>
          ))}
        </aside>

        <main style={s.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const C = { bg: '#0E1117', surface: '#161B27', border: '#232B3E', primary: '#185FA5', accent: '#378ADD', text: '#E8EDF5', muted: '#6B7A99' };
const s: Record<string, React.CSSProperties> = {
  root:            { minHeight: '100vh', background: C.bg, fontFamily: '"Segoe UI", sans-serif', display: 'flex', flexDirection: 'column' },
  nav:             { height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', position: 'sticky', top: 0, zIndex: 100, flexShrink: 0 },
  logoText:        { fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '0.1em' },
  separator:       { fontSize: 14, color: C.muted },
  section:         { fontSize: 13, color: C.muted },
  backBtn:         { height: 28, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, color: C.muted },
  logoutBtn:       { height: 28, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, color: C.muted },
  layout:          { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar:         { width: 180, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 },
  sidebarLabel:    { fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 16px', marginBottom: 8 },
  sidebarLink:       { display: 'block', padding: '8px 16px', fontSize: 13, color: C.muted, textDecoration: 'none', transition: 'color 0.15s, background 0.15s' },
  sidebarLinkActive: { color: C.accent, background: '#378ADD14', boxShadow: `inset 2px 0 0 ${C.accent}` },
  content:         { flex: 1, overflowY: 'auto' as const },
};
