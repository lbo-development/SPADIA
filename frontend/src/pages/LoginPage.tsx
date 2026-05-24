import { useState, useEffect, useRef } from 'react';
import { C } from '@/constants/colors';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/api/client';

type UserEntry = { id: string; nom: string };

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const { login, loading } = useAuth();
  const sessionMsg = searchParams.get('reason');

  /* ── liste utilisateurs ── */
  const [users,    setUsers]    = useState<UserEntry[]>([]);
  const [fetchErr, setFetchErr] = useState(false);

  useEffect(() => {
    apiClient.get<UserEntry[]>('/auth/users')
      .then(r => setUsers(r.data))
      .catch(() => setFetchErr(true));
  }, []);

  /* ── dropdown sélection ── */
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState<UserEntry | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  /* ferme si clic en dehors */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function pick(u: UserEntry) {
    setSelected(u);
    setOpen(false);
  }

  /* ── mot de passe ── */
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await login(selected.id, password);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Identifiants incorrects.';
      setError(msg);
    }
  }

  const canSubmit = !!selected && !!password && !loading;

  return (
    <div style={s.root}>
      <div style={s.grid} />
      <div style={s.accentBar} />

      <main style={s.main}>
        {/* logo */}
        <header style={s.header}>
          <div style={s.logoWrap}>
            <img src="/logos-DBo.png" alt="Logo" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
            <span style={s.logoText}>SPADIA</span>
          </div>
          <p style={s.tagline}>
            <span style={s.hi}>S</span>ystème <span style={s.hi}>PA</span>rtagé de{' '}
            <span style={s.hi}>DI</span>gitalisation des <span style={s.hi}>A</span>ssets
          </p>
        </header>

        {/* carte */}
        <div style={s.card}>
          {sessionMsg && <div style={s.banner}>⚠ {sessionMsg}</div>}
          <h1 style={s.title}>Connexion</h1>

          <form onSubmit={handleSubmit} noValidate autoComplete="off" style={s.form}>
            {/* champs leurres invisibles pour bloquer l'autofill navigateur */}
            <input type="text"     style={{ display: 'none' }} aria-hidden="true" readOnly />
            <input type="password" style={{ display: 'none' }} aria-hidden="true" readOnly />

            {/* ── dropdown utilisateur ── */}
            <div style={s.field}>
              <label style={s.label}>Utilisateur</label>
              <div ref={dropRef} style={{ position: 'relative' }}>

                {/* bouton déclencheur */}
                <button
                  type="button"
                  onClick={() => setOpen(o => !o)}
                  disabled={loading}
                  style={s.trigger}
                >
                  <svg style={s.triggerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                  <span style={{ flex: 1, textAlign: 'left', color: selected ? C.text : C.muted }}>
                    {selected ? selected.nom : 'Nom d\'utilisateur'}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* liste */}
                {open && (
                  <ul style={s.list}>
                    {fetchErr && (
                      <li style={{ ...s.item, color: C.error, fontStyle: 'italic' }}>
                        Impossible de charger les utilisateurs
                      </li>
                    )}
                    {!fetchErr && users.length === 0 && (
                      <li style={{ ...s.item, color: C.muted, fontStyle: 'italic' }}>Chargement…</li>
                    )}
                    {users.map(u => (
                      <li
                        key={u.nom}
                        onMouseDown={e => { e.preventDefault(); pick(u); }}
                        style={{
                          ...s.item,
                          background:  selected?.nom === u.nom ? '#378ADD22' : 'transparent',
                          color:       selected?.nom === u.nom ? C.accent : C.text,
                          fontWeight:  selected?.nom === u.nom ? 600 : 400,
                        }}
                      >
                        {u.nom}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── mot de passe ── */}
            <div style={s.field}>
              <label htmlFor="pwd" style={s.label}>Mot de passe</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={s.pwdIcon}>⬡</span>
                <input
                  id="pwd"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  disabled={loading}
                  onChange={e => setPassword(e.target.value)}
                  style={s.pwdInput}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={s.eye}>
                  {showPwd
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && <div style={s.err}>✕ {error}</div>}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{ ...s.btn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              onMouseEnter={e => { if (canSubmit) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 18px var(--accent-glow)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px var(--accent-glow)'; }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <footer style={s.footer}>◆ Session sécurisée — 8h max · Inactivité : 30 min</footer>
      </main>
    </div>
  );
}



const s: Record<string, React.CSSProperties> = {
  root:       { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', fontFamily: '"Segoe UI", sans-serif' },
  grid:       { position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none' },
  accentBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,transparent,${C.primary} 30%,${C.accent} 70%,transparent)`, pointerEvents: 'none' },
  main:       { position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 },
  header:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  logoWrap:   { display: 'flex', alignItems: 'center', gap: 10 },
  logoText:   { fontSize: 26, fontWeight: 700, color: '#2D6A27', letterSpacing: '0.12em' },
  tagline:    { fontSize: 12, color: C.muted, margin: 0, textAlign: 'center' },
  hi:         { fontSize: 13.5, fontWeight: 700, color: '#2D6A27' },
  card:       { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  banner:     { background: '#241C0A', border: '1px solid #C9860A44', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#C9860A' },
  title:      { margin: 0, fontSize: 18, fontWeight: 600, color: C.text },
  form:       { display: 'flex', flexDirection: 'column', gap: 16 },
  field:      { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontSize: 12, fontWeight: 500, color: C.muted },
  trigger:    { width: '100%', height: 40, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 10px 0 36px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, position: 'relative', boxSizing: 'border-box' },
  triggerIcon:{ position: 'absolute', left: 12, width: 14, height: 14, color: C.muted, pointerEvents: 'none' },
  list:       { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, listStyle: 'none', margin: 0, padding: '4px 0', zIndex: 300, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' },
  item:       { padding: '9px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, margin: '1px 4px', userSelect: 'none', transition: 'background 0.1s' },
  pwdIcon:    { position: 'absolute', left: 12, fontSize: 14, color: C.muted, pointerEvents: 'none' },
  pwdInput:   { width: '100%', height: 40, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, paddingLeft: 36, paddingRight: 42, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' },
  eye:        { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex', alignItems: 'center' },
  err:        { background: C.errorBg, border: `1px solid ${C.error44}`, borderRadius: 6, padding: '10px 12px', fontSize: 12, color: C.error },
  btn:        { width: '100%', height: 44, background: C.accent, border: 'none', borderRadius: 7, color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', marginTop: 4, cursor: 'pointer', boxShadow: '0 2px 10px var(--accent-glow)', transition: 'background 0.15s, box-shadow 0.15s, opacity 0.15s' },
  footer:     { textAlign: 'center', fontSize: 11, color: C.muted },
};
