import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ROLES } from '@/constants/roles';
import { C } from '@/constants/colors';
import { useState, useRef, useEffect } from 'react';

/* ── Carte de visite Digital Bonsai ─────────────────────────────────────────── */


function IcoPhone() {
  return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.37 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.06 6.06l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function IcoMail() {
  return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IcoGlobe() {
  return <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}

function BusinessCard() {
  const G = '#1F7A2A';
  const contacts = [
    { Ico: IcoPhone, text: '+33 7 69 86 26 64',                href: null },
    { Ico: IcoMail,  text: 'laurent.bohbot@digitalbonsai.tech', href: null },
    { Ico: IcoGlobe, text: 'www.digitalbonsai.tech',            href: 'https://www.digitalbonsai.tech' },
  ];
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', left: 0,
      width: 325, borderRadius: 4, overflow: 'hidden', zIndex: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.14)',
      display: 'flex', flexDirection: 'column',
      background: '#fff', fontFamily: '"Segoe UI", Arial, sans-serif',
    }}>

      {/* ── Zone blanche : logo gauche + infos droite ── */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 16px 8px' }}>

        {/* Logo */}
        <div style={{ width: 55, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src="/logos-DBo.png" alt="Digital Bonsai"
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Nom + contacts */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 }}>
            Laurent BOHBOT
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#333', marginBottom: 10, letterSpacing: '0.01em' }}>
            Digital Strategy & Transformation Consultant
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {contacts.map(({ Ico, text, href }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', background: G,
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico />
                </span>
                {href
                  ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, color: G, textDecoration: 'underline', cursor: 'pointer' }}>{text}</a>
                  : <span style={{ fontSize: 8.5, color: '#333' }}>{text}</span>
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vague + bande verte en bas ── */}
      <div style={{ marginTop: 6 }}>
        <svg viewBox="0 0 340 22" preserveAspectRatio="none"
          style={{ display: 'block', width: '100%', height: 22 }}>
          <path d="M0,22 C85,4 255,4 340,22 Z" fill={G} />
        </svg>
        <div style={{ background: G, padding: '3px 16px 9px' }}>
          <span style={{ fontSize: 8, color: '#fff', letterSpacing: '0.04em', userSelect: 'none' }}>
            Your partner navigating the digital universe
          </span>
        </div>
      </div>
    </div>
  );
}

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
    color: '#EF4444',
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
    color: 'var(--accent)',
    rights: [
      'Consultation de la cartographie interactive',
      'Soumission de demandes d\'ajout (PDF, plans SVG, calques)',
      'Téléchargement des calques marqués téléchargeables',
      'Accès en lecture à l\'arborescence des données',
    ],
  },
  Viewer: {
    label: 'Observateur',
    color: 'var(--muted)',
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
  const [showProfile,  setShowProfile]  = useState(false);
  const [showCard,     setShowCard]     = useState(false);
  const avatarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoRef     = useRef<HTMLDivElement>(null);

  function onAvatarEnter() {
    avatarTimer.current = setTimeout(() => setShowProfile(true), 500);
  }
  function onAvatarLeave() {
    if (avatarTimer.current) clearTimeout(avatarTimer.current);
    setShowProfile(false);
  }

  useEffect(() => {
    if (!showCard) return;
    function handleClickOutside(e: MouseEvent) {
      if (logoRef.current && !logoRef.current.contains(e.target as Node)) {
        setShowCard(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCard]);

  const isAdminApp = user?.role === ROLES.ADMIN_APP;
  const NAV_ITEMS = NAV_ITEMS_BASE.filter(item => !item.adminOnly || isAdminApp);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <nav style={s.nav}>
      <div
        ref={logoRef}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginRight: 16, cursor: 'pointer' }}
        onClick={() => setShowCard(v => !v)}
      >
        <img src="/logos-DBo.png" alt="Logo" style={{ height: 30, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <span style={s.brand}>SPADIA</span>
        {showCard && <BusinessCard />}
      </div>

      {/* Onglets de navigation */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: 0 }}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`nav-tab${isActive ? ' active' : ''}`}
              style={{
                height: '100%',
                padding: '0 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid var(--accent)` : '2px solid transparent',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)' as unknown as number,
                fontWeight: isActive ? 600 : 400,
                flexShrink: 0,
                letterSpacing: '0.01em',
              }}
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
        className="icon-btn"
        style={{
          width: 32, height: 32, borderRadius: 'var(--r-lg)' as unknown as number,
          background: 'transparent', border: `1px solid var(--border)`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: 8,
        }}
      >
        {isDark ? <IconSun /> : <IconMoon />}
      </button>

      {/* Nom utilisateur */}
      {user && (
        <span style={{ fontSize: 'var(--text-sm)' as unknown as number, fontWeight: 500, color: C.muted, marginRight: 8, flexShrink: 0 }}>
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
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: nameColor(user.nom), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: 'default' }}>
              {user.avatar_url && !avatarFailed
                ? <img src={user.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', userSelect: 'none' }}>{initials(user.nom)}</span>
              }
            </div>

            {showProfile && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                width: 290, background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 'var(--r-xl)' as unknown as number,
                boxShadow: 'var(--shadow-lg)',
                zIndex: 500, overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: nameColor(user.nom), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    {user.avatar_url && !avatarFailed
                      ? <img src={user.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{initials(user.nom)}</span>
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-base)' as unknown as number, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.nom}</div>
                    <div style={{ fontSize: 'var(--text-xs)' as unknown as number, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-xs)' as unknown as number, fontWeight: 700, color: '#fff', background: meta.color, borderRadius: 'var(--r-sm)' as unknown as number, padding: '2px 8px', letterSpacing: '0.02em' }}>
                    {meta.label}
                  </span>
                  {user.role === ROLES.USER && (
                    <span style={{ fontSize: 'var(--text-xs)' as unknown as number, color: C.muted }}>
                      Accréditation&nbsp;<strong style={{ color: C.text }}>{user.niveau_accreditation}</strong>
                    </span>
                  )}
                </div>

                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 'var(--text-2xs)' as unknown as number, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Droits associés</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meta.rights.map((r, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 'var(--text-xs)' as unknown as number, color: C.muted, lineHeight: 1.45 }}>
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
        className="logout-btn"
        style={{ height: 28, padding: '0 12px', background: 'transparent', border: `1px solid var(--border)`, borderRadius: 'var(--r-md)' as unknown as number, cursor: 'pointer', fontSize: 'var(--text-xs)' as unknown as number, flexShrink: 0 }}
      >
        Déconnexion
      </button>
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav:   { height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, zIndex: 100 },
  brand: { fontSize: 'var(--text-md)' as unknown as number, fontWeight: 700, color: C.text, letterSpacing: '0.1em' },
};
