import { NavLink } from 'react-router-dom';
import { C } from '@/constants/colors';

export interface SidebarItem {
  path:     string;
  label:    string;
  Icon:     React.ComponentType;
  badge?:   number;
  disabled?: boolean;
}

interface Props {
  basePath: string;
  items:    SidebarItem[];
}

export default function AppSidebar({ basePath, items }: Props) {
  return (
    <aside style={s.sidebar}>
      {items.map(item => {
        if (item.disabled) return (
          <span key={item.path} style={{ ...s.item, opacity: 0.35, cursor: 'not-allowed' }} title="Accès non autorisé">
            <div style={s.iconWrap}><item.Icon /></div>
            <span style={s.label}>{item.label}</span>
          </span>
        );

        return (
          <NavLink
            key={item.path}
            to={`${basePath}/${item.path}`}
            style={({ isActive }) => ({ ...s.item, ...(isActive ? s.itemActive : {}) })}
          >
            <div style={s.iconWrap}>
              <item.Icon />
              {!!item.badge && item.badge > 0 && (
                <span style={s.badge}>{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </div>
            <span style={s.label}>{item.label}</span>
          </NavLink>
        );
      })}
    </aside>
  );
}

const s: Record<string, React.CSSProperties> = {
  sidebar:    { width: 76, background: C.surface, borderRight: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, alignItems: 'stretch' },
  item:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px 9px', fontSize: 10, color: C.muted, textDecoration: 'none', transition: 'color 0.15s, background 0.15s', textAlign: 'center', lineHeight: 1.3, cursor: 'pointer' },
  itemActive: { color: C.accent, background: C.accent14, boxShadow: `inset 2px 0 0 ${C.accent}` },
  iconWrap:   { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge:      { position: 'absolute', top: -5, right: -7, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: C.danger, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxSizing: 'border-box' },
  label:      { wordBreak: 'break-word' as const },
};
