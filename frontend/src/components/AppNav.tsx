import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ROLES } from '@/constants/roles';
import { C } from '@/constants/colors';

const PALETTE = ['#0078D4','#107C10','#D83B01','#5C2D91','#038387','#CA5010','#00B294','#B4009E'];
function nameColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

const ROLE_META: Record<string, { label: string; color: string; rights: string[] }> = {
  Admin_app: {
    label: 'Administrateur Application',
    color: '#E05252',
    rights: [
      'Accès complet à toutes les pages de l\'application',
      'Gestion des utilisateurs (création, modification, suppression)',
      'Validation et rejet des demandes d\'ajout de contenus',
      'Création et modification de tous les calques géographiques et plans SVG',
      'Administration des sites, installations, dossiers et markers',
    ],
  },
  Admin_data: {
    label: 'Administrateur Data',
    color: '#CA5010',
    rights: [
      'Accès étendu aux données cartographiques',
      'Validation et rejet des demandes d\'ajout de contenus',
      'Création et modification des calques géographiques',
      'Création et modification des plans SVG',
      'Gestion des sites, installations et dossiers',
    ],
  },
  User: {
    label: 'Utilisateur',
    color: '#378ADD',
    rights: [
      'Consultation de la cartographie interactive',
      'Soumission de demandes d\'ajout (PDF, plans SVG, calques)',
      'Téléchargement des calques marqués téléchargeables',
      'Accès en lecture à l\'arborescence des données',
    ],
  },
  Viewer: {
    label: 'Observateur',
    color: '#6B7A99',
    rights: [
      'Consultation de la cartographie en lecture seule',
      'Visualisation de l\'arborescence des données',
      'Aucune soumission de demande possible',
      'Aucune modification des données possible',
    ],
  },
};

const NAV_ITEMS_BASE = [
  { path: '/carte',     label: 'Cartographie',    adminOnly: false },
  { path: '/dashboard', label: 'Tableau de bord', adminOnly: false },
  { path: '/database',  label: 'Base de données', adminOnly: true  },
];

function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function AppNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showProfile, setShowProfile]   = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onAvatarEnter() {
    hoverTimer.current = setTimeout(() => setShowProfile(true), 500);
  }
  function onAvatarLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowProfile(false);
  }
  const isAdminApp = user?.role === ROLES.ADMIN_APP;
  const NAV_ITEMS = NAV_ITEMS_BASE.filter(item => !item.adminOnly || isAdminApp);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <nav style={{ height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 0, padding: '0 16px', flexShrink: 0, zIndex: 100 }}>
      <img src="/logos-DBo.png" alt="Logo" style={{ height: 30, width: 'auto', objectFit: 'contain', flexShrink: 0, marginRight: 8 }} />
      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '0.1em', marginRight: 16 }}>SPADIA</span>

      {/* Onglets de navigation */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: 0 }}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                height: '100%',
                padding: '0 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? C.text : C.muted,
                flexShrink: 0,
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = C.muted; }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Bouton Dark / Light */}
      <button
        onClick={toggle}
        title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'transparent', border: `1px solid ${C.border}`,
          cursor: 'pointer', color: C.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: 8,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
      >
        {isDark ? <IconSun /> : <IconMoon />}
      </button>

      {/* Nom utilisateur */}
      {user && (
        <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginRight: 8, flexShrink: 0 }}>
          {user.nom}
        </span>
      )}

      {/* Avatar utilisateur + popover */}
      {user && (() => {
        const meta = ROLE_META[user.role] ?? { label: user.role, color: C.muted, rights: [] };
        return (
          <div style={{ position: 'relative', marginRight: 8, flexShrink: 0 }}
            onMouseEnter={onAvatarEnter}
            onMouseLeave={onAvatarLeave}
          >
            {/* Cercle avatar */}
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: nameColor(user.nom), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: 'default' }}>
              {user.avatar_url && !avatarFailed
                ? <img src={user.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', userSelect: 'none' }}>{initials(user.nom)}</span>
              }
            </div>

            {/* Popover profil */}
            {showProfile && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                width: 290, background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                zIndex: 500, overflow: 'hidden',
              }}>
                {/* En-tête */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: nameColor(user.nom), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    {user.avatar_url && !avatarFailed
                      ? <img src={user.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{initials(user.nom)}</span>
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.nom}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                  </div>
                </div>

                {/* Rôle + accréditation */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: meta.color, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.02em' }}>
                    {meta.label}
                  </span>
                  {user.role === ROLES.USER && (
                    <span style={{ fontSize: 11, color: C.muted }}>
                      Accréditation&nbsp;<strong style={{ color: C.text }}>{user.niveau_accreditation}</strong>
                    </span>
                  )}
                </div>

                {/* Droits */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Droits associés</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meta.rights.map((r, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11, color: C.muted, lineHeight: 1.45 }}>
                        <span style={{ color: meta.color, flexShrink: 0, marginTop: 1 }}>▸</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <button
        onClick={handleLogout}
        style={{ height: 28, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, color: C.muted, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
      >
        Déconnexion
      </button>
    </nav>
  );
}
