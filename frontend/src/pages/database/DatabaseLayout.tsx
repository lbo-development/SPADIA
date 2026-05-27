import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import AppNav from '@/components/AppNav';
import AppSidebar, { type SidebarItem } from '@/components/AppSidebar';
import { C } from '@/constants/colors';

function IconSite() {
  return (
    <svg width="20" height="20" viewBox="-3 0 30 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3C1.07 3 -0.5 4.57 -0.5 6.5C-0.5 9.5 3 14 3 14C3 14 6.5 9.5 6.5 6.5C6.5 4.57 4.93 3 3 3Z"/><circle cx="3" cy="6.5" r="1.2"/>
      <path d="M21 3C19.07 3 17.5 4.57 17.5 6.5C17.5 9.5 21 14 21 14C21 14 24.5 9.5 24.5 6.5C24.5 4.57 22.93 3 21 3Z"/><circle cx="21" cy="6.5" r="1.2"/>
      <path d="M12 1C8.69 1 6 3.69 6 7C6 11.5 12 21 12 21C12 21 18 11.5 18 7C18 3.69 15.31 1 12 1Z"/><circle cx="12" cy="7" r="2.2"/>
    </svg>
  );
}
function IconInstall() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1C8.69 1 6 3.69 6 7C6 11.5 12 21 12 21C12 21 18 11.5 18 7C18 3.69 15.31 1 12 1Z"/><circle cx="12" cy="7" r="2.2"/></svg>;
}
function IconPlans() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 23 L12.5 1 L12.5 23 Z"/>
      <line x1="12.5" y1="5"  x2="11" y2="5"/><line x1="12.5" y1="7"  x2="11" y2="7"/>
      <line x1="12.5" y1="9"  x2="11" y2="9"/><line x1="12.5" y1="11" x2="11" y2="11"/>
      <line x1="12.5" y1="13" x2="11" y2="13"/><line x1="12.5" y1="15" x2="11" y2="15"/>
      <line x1="12.5" y1="17" x2="11" y2="17"/><line x1="12.5" y1="19" x2="11" y2="19"/>
      <line x1="12.5" y1="21" x2="11" y2="21"/>
      <path d="M3.5 21 L8 14 L8 21 Z"/>
      <path d="M15 6 Q15 1.5 18 1.5 Q21 1.5 21 6 L21 18 L15 18 Z"/>
      <line x1="15" y1="6" x2="21" y2="6"/>
      <path d="M15 18 L18 23 L21 18"/>
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

export default function DatabaseLayout() {
  const { user } = useAuth();
  const isAdminApp = user?.role === ROLES.ADMIN_APP;

  const items: SidebarItem[] = [
    { path: 'sites',         label: 'Sites',        Icon: IconSite     },
    { path: 'installations', label: 'Installations', Icon: IconInstall  },
    { path: 'plans',         label: 'Plans SVG',    Icon: IconPlans    },
    { path: 'calques',       label: 'Calques Géo',  Icon: IconCalques  },
    { path: 'dossiers',      label: 'Dossiers',     Icon: IconDossiers },
    { path: 'markers',       label: 'Markers',      Icon: IconMarkers  },
    ...(isAdminApp ? [{ path: 'utilisateurs', label: 'Utilisateurs', Icon: IconUsers }] : []),
  ];

  return (
    <div style={s.root}>
      <AppNav />
      <div style={s.layout}>
        <AppSidebar basePath="/database" items={items} />
        <main style={s.content}><Outlet /></main>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root:    { height: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' },
  layout:  { display: 'flex', flex: 1, overflow: 'hidden' },
  content: { flex: 1, overflow: 'hidden' },
};
