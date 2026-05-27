import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db } from '@/api/database';
import AppNav from '@/components/AppNav';
import AppSidebar, { type SidebarItem } from '@/components/AppSidebar';
import { C } from '@/constants/colors';

function IconSubmit() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/><line x1="5" y1="21" x2="19" y2="21"/></svg>;
}
function IconValidate() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
}

export default function DashboardLayout() {
  const { user } = useAuth();
  const canValidate = user?.role === ROLES.ADMIN_APP || user?.role === ROLES.ADMIN_DATA;
  const isViewer    = user?.role === ROLES.VIEWER;

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!canValidate) return;
    db.listPourValidation()
      .then(({ data }) => {
        const n = data.filter(d => d.statut === 'En attente' || d.statut === 'A compléter').length;
        setPendingCount(n);
      })
      .catch(() => {});
  }, [canValidate]);

  const items: SidebarItem[] = [
    { path: 'soumettre', label: 'Soumettre',  Icon: IconSubmit,   disabled: isViewer },
    { path: 'valider',   label: 'Valider',    Icon: IconValidate, disabled: !canValidate, badge: canValidate ? pendingCount : 0 },
  ];

  return (
    <div style={s.root}>
      <AppNav />
      <div style={s.layout}>
        <AppSidebar basePath="/dashboard" items={items} />
        <main style={s.content}><Outlet /></main>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root:    { minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' },
  layout:  { display: 'flex', flex: 1, overflow: 'hidden' },
  content: { flex: 1, overflowY: 'auto' as const },
};
