import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '@/constants/colors';
import { apiClient } from '@/api/client';
import { extractErrorMessage } from '@/lib/errors';

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenError,  setTokenError]  = useState<string | null>(null);
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  useEffect(() => {
    // Supabase redirige avec le token dans le hash : #access_token=...&type=recovery
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const type  = params.get('type');
    if (!token || type !== 'recovery') {
      setTokenError('Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation depuis le support.');
    } else {
      setAccessToken(token);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8)  { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setSaving(true); setError(null);
    try {
      await apiClient.post('/auth/reset-password', { access_token: accessToken, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/login?reason=Mot de passe modifié avec succès. Connectez-vous.'), 2500);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !!password && !!confirm && !saving;

  return (
    <div style={s.root}>
      <div style={s.grid} />
      <div style={s.accentBar} />

      <main style={s.main}>
        <header style={s.header}>
          <div style={s.logoWrap}>
            <img src="/logos-DBo.png" alt="Logo" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
            <span style={s.logoText}>SPADIA</span>
          </div>
        </header>

        <div style={s.card}>
          <h1 style={s.title}>Nouveau mot de passe</h1>

          {tokenError ? (
            <div style={s.err}>✕ {tokenError}</div>
          ) : success ? (
            <div style={s.successBanner}>
              ✓ Mot de passe modifié. Redirection vers la connexion…
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate style={s.form}>
              <div style={s.field}>
                <label htmlFor="pwd" style={s.label}>Nouveau mot de passe</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={s.fieldIcon}><IconLock /></span>
                  <input
                    id="pwd"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Minimum 8 caractères"
                    value={password}
                    disabled={saving}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...s.textInput, paddingRight: 42 }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={s.eye}>
                    {showPwd
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div style={s.field}>
                <label htmlFor="confirm" style={s.label}>Confirmer le mot de passe</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={s.fieldIcon}><IconLock /></span>
                  <input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Répéter le mot de passe"
                    value={confirm}
                    disabled={saving}
                    onChange={e => setConfirm(e.target.value)}
                    style={{ ...s.textInput, paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} style={s.eye}>
                    {showConfirm
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
                className="btn-primary"
                style={{ ...s.btn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
              </button>
            </form>
          )}
        </div>

        <footer style={s.footer}>◆ Session sécurisée — 8h max · Inactivité : 30 min</footer>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root:         { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  grid:         { position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none' },
  accentBar:    { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,transparent,var(--primary) 30%,var(--accent) 70%,transparent)`, pointerEvents: 'none' },
  main:         { position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 },
  header:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  logoWrap:     { display: 'flex', alignItems: 'center', gap: 10 },
  logoText:     { fontSize: 26, fontWeight: 700, color: 'var(--brand-green)', letterSpacing: '0.12em' },
  card:         { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--r-xl)' as unknown as number, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  title:        { margin: 0, fontSize: 18, fontWeight: 600, color: C.text },
  form:         { display: 'flex', flexDirection: 'column', gap: 16 },
  field:        { display: 'flex', flexDirection: 'column', gap: 6 },
  label:        { fontSize: 12, fontWeight: 500, color: C.muted },
  fieldIcon:    { position: 'absolute', left: 12, width: 14, height: 14, color: C.muted, pointerEvents: 'none' } as React.CSSProperties,
  textInput:    { width: '100%', height: 40, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 'var(--r-md)' as unknown as number, paddingLeft: 36, paddingRight: 12, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  eye:          { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex', alignItems: 'center' },
  err:          { background: C.errorBg, border: `1px solid ${C.error44}`, borderRadius: 'var(--r-md)' as unknown as number, padding: '10px 12px', fontSize: 12, color: C.error },
  successBanner:{ background: 'rgba(16,124,16,0.12)', border: '1px solid rgba(16,124,16,0.4)', borderRadius: 'var(--r-md)' as unknown as number, padding: '12px 14px', fontSize: 13, color: '#107C10' },
  btn:          { width: '100%', height: 44, background: C.accent, border: 'none', borderRadius: 'var(--r-lg)' as unknown as number, color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', marginTop: 4, cursor: 'pointer', boxShadow: 'var(--shadow-accent)' },
  footer:       { textAlign: 'center', fontSize: 11, color: C.muted },
};
