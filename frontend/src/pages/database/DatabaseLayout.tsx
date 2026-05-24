import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import AppNav from '@/components/AppNav';
import { C } from '@/constants/colors';

function IconSite() {
  return (
    <svg width="20" height="20" viewBox="-3 0 30 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Pin gauche (derrière) */}
      <path d="M3 3C1.07 3 -0.5 4.57 -0.5 6.5C-0.5 9.5 3 14 3 14C3 14 6.5 9.5 6.5 6.5C6.5 4.57 4.93 3 3 3Z"/>
      <circle cx="3" cy="6.5" r="1.2"/>
      {/* Pin droit (derrière) */}
      <path d="M21 3C19.07 3 17.5 4.57 17.5 6.5C17.5 9.5 21 14 21 14C21 14 24.5 9.5 24.5 6.5C24.5 4.57 22.93 3 21 3Z"/>
      <circle cx="21" cy="6.5" r="1.2"/>
      {/* Pin central (devant, plus grand) */}
      <path d="M12 1C8.69 1 6 3.69 6 7C6 11.5 12 21 12 21C12 21 18 11.5 18 7C18 3.69 15.31 1 12 1Z"/>
      <circle cx="12" cy="7" r="2.2"/>
    </svg>
  );
}
function IconInstall() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1C8.69 1 6 3.69 6 7C6 11.5 12 21 12 21C12 21 18 11.5 18 7C18 3.69 15.31 1 12 1Z"/>
      <circle cx="12" cy="7" r="2.2"/>
    </svg>
  );
}
function IconPlans() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Équerre — triangle principal */}
      <path d="M1 23 L12.5 1 L12.5 23 Z"/>
      {/* Graduations sur le bord vertical droit */}
      <line x1="12.5" y1="5"  x2="11"  y2="5"/>
      <line x1="12.5" y1="7"  x2="11"  y2="7"/>
      <line x1="12.5" y1="9"  x2="11"  y2="9"/>
      <line x1="12.5" y1="11" x2="11"  y2="11"/>
      <line x1="12.5" y1="13" x2="11"  y2="13"/>
      <line x1="12.5" y1="15" x2="11"  y2="15"/>
      <line x1="12.5" y1="17" x2="11"  y2="17"/>
      <line x1="12.5" y1="19" x2="11"  y2="19"/>
      <line x1="12.5" y1="21" x2="11"  y2="21"/>
      {/* Petit triangle intérieur */}
      <path d="M3.5 21 L8 14 L8 21 Z"/>
      {/* Crayon — corps (arrondi en haut) */}
      <path d="M15 6 Q15 1.5 18 1.5 Q21 1.5 21 6 L21 18 L15 18 Z"/>
      {/* Séparateur gomme */}
      <line x1="15" y1="6" x2="21" y2="6"/>
      {/* Pointe */}
      <path d="M15 18 L18 23 L21 18"/>
      {/* Mine */}
      <line x1="18" y1="20.5" x2="18" y2="23"/>
    </svg>
  );
}
function IconCalques() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function IconDossiers() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function IconMarkers() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function IconUsers() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

const ENTITIES = [
  { path: 'sites',         label: 'Sites',          Icon: IconSite     },
  { path: 'installations', label: 'Installations',   Icon: IconInstall  },
  { path: 'plans',         label: 'Plans SVG',       Icon: IconPlans    },
  { path: 'calques',       label: 'Calques Géo',     Icon: IconCalques  },
  { path: 'dossiers',      label: 'Dossiers',        Icon: IconDossiers },
  { path: 'markers',       label: 'Markers',         Icon: IconMarkers  },
  { path: 'utilisateurs',  label: 'Utilisateurs',    Icon: IconUsers,   adminOnly: true },
];

export default function DatabaseLayout() {
  const { user } = useAuth();
  const isAdminApp = user?.role === ROLES.ADMIN_APP;
  const entities = ENTITIES.filter(e => !e.adminOnly || isAdminApp);

  return (
    <div style={s.root}>
      <AppNav />

      <div style={s.layout}>
        <aside style={s.sidebar}>
          {entities.map(e => (
            <NavLink key={e.path} to={`/database/${e.path}`}
              style={({ isActive }) => ({ ...s.item, ...(isActive ? s.itemActive : {}) })}>
              <e.Icon />
              <span style={s.label}>{e.label}</span>
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

const s: Record<string, React.CSSProperties> = {
  root:       { height: '100vh', background: C.bg, fontFamily: '"Segoe UI", sans-serif', display: 'flex', flexDirection: 'column' },
  layout:     { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar:    { width: 76, background: C.surface, borderRight: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignItems: 'stretch' },
  item:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px 9px', fontSize: 10, color: C.muted, textDecoration: 'none', transition: 'color 0.15s, background 0.15s', textAlign: 'center', lineHeight: 1.3 },
  itemActive: { color: C.accent, background: C.accent14, boxShadow: `inset 2px 0 0 ${C.accent}` },
  label:      { wordBreak: 'break-word' as const },
  content:    { flex: 1, overflow: 'hidden' },
};
