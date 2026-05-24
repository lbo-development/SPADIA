import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db } from '@/api/database';
import AppNav from '@/components/AppNav';
import { C } from '@/constants/colors';

function IconSubmit() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/><line x1="5" y1="21" x2="19" y2="21"/></svg>;
}
function IconValidate() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
}

const ITEMS = [
  { path: 'soumettre', label: 'Soumettre',  Icon: IconSubmit,   noViewer: true,  validatorOnly: false },
  { path: 'valider',   label: 'Valider',    Icon: IconValidate, noViewer: false, validatorOnly: true  },
];

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

  function isDisabled(item: typeof ITEMS[number]) {
    return (item.noViewer && isViewer) || (item.validatorOnly && !canValidate);
  }

  return (
    <div style={s.root}>
      <AppNav />

      <div style={s.layout}>
        <aside style={s.sidebar}>
          {ITEMS.map(item => {
            const disabled = isDisabled(item);
            const badge = item.path === 'valider' && canValidate && pendingCount > 0 ? pendingCount : 0;

            if (disabled) return (
              <span key={item.path} style={{ ...s.item, opacity: 0.35, cursor: 'not-allowed' }} title="Accès non autorisé">
                <div style={s.iconWrap}>
                  <item.Icon />
                </div>
                <span style={s.label}>{item.label}</span>
              </span>
            );

            return (
              <NavLink key={item.path} to={`/dashboard/${item.path}`}
                style={({ isActive }) => ({ ...s.item, ...(isActive ? s.itemActive : {}) })}>
                <div style={s.iconWrap}>
                  <item.Icon />
                  {badge > 0 && (
                    <span style={s.badge}>{badge > 99 ? '99+' : badge}</span>
                  )}
                </div>
                <span style={s.label}>{item.label}</span>
              </NavLink>
            );
          })}
        </aside>

        <main style={s.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root:       { minHeight: '100vh', background: C.bg, fontFamily: '"Segoe UI", sans-serif', display: 'flex', flexDirection: 'column' },
  layout:     { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar:    { width: 76, background: C.surface, borderRight: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignItems: 'stretch' },
  item:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px 9px', fontSize: 10, color: C.muted, textDecoration: 'none', transition: 'color 0.15s, background 0.15s', textAlign: 'center', lineHeight: 1.3 },
  itemActive: { color: C.accent, background: C.accent14, boxShadow: `inset 2px 0 0 ${C.accent}` },
  iconWrap:   { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge:      { position: 'absolute', top: -5, right: -7, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: C.danger, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxSizing: 'border-box' },
  label:      { wordBreak: 'break-word' as const },
  content:    { flex: 1, overflowY: 'auto' as const },
};
