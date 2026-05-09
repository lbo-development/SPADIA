import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const { login, loading } = useAuth();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const sessionMessage = searchParams.get('reason');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Erreur de connexion.';
      setError(msg);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.grid} />
      <div style={s.accentBar} />
      <main style={s.main}>
        <header style={s.header}>
          <div style={s.logoWrap}>
            <span style={{ fontSize: 22, color: '#378ADD' }}>◈</span>
            <span style={s.logoText}>SPADIA</span>
          </div>
          <p style={s.tagline}>Gestion cartographique — Sites industriels</p>
        </header>

        <div style={s.card}>
          {sessionMessage && (
            <div style={s.sessionBanner}>⚠ {sessionMessage}</div>
          )}
          <h1 style={s.cardTitle}>Connexion</h1>
          <form onSubmit={handleSubmit} noValidate style={s.form}>
            <div style={s.fieldGroup}>
              <label htmlFor="email" style={s.label}>Adresse e-mail</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>@</span>
                <input
                  id="email" type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={s.input} placeholder="prenom.nom@gpmm.fr"
                  disabled={loading}
                />
              </div>
            </div>

            <div style={s.fieldGroup}>
              <label htmlFor="password" style={s.label}>Mot de passe</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>⬡</span>
                <input
                  id="password" type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ ...s.input, paddingRight: 42 }}
                  placeholder="••••••••" disabled={loading}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={s.eyeBtn}>
                  {showPwd ? '○' : '●'}
                </button>
              </div>
            </div>

            {error && <div style={s.errorBox}>✕ {error}</div>}

            <button type="submit" style={s.submitBtn} disabled={loading || !email || !password}>
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <footer style={s.footer}>
          ◆ Session sécurisée — 8h max · Inactivité : 30 min
        </footer>
      </main>
    </div>
  );
}

const C = { bg: '#0E1117', surface: '#161B27', border: '#232B3E', primary: '#185FA5', accent: '#378ADD', text: '#E8EDF5', muted: '#6B7A99', error: '#E05252' };
const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', fontFamily: '"Segoe UI", sans-serif' },
  grid: { position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none' },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, transparent, ${C.primary} 30%, ${C.accent} 70%, transparent)`, pointerEvents: 'none' },
  main: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  logoText: { fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '0.12em' },
  tagline: { fontSize: 12, color: C.muted, margin: 0, paddingLeft: 32 },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  sessionBanner: { background: '#241C0A', border: '1px solid #C9860A44', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#C9860A' },
  cardTitle: { margin: 0, fontSize: 18, fontWeight: 600, color: C.text },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: C.muted },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 12, fontSize: 13, color: C.muted, pointerEvents: 'none' },
  input: { width: '100%', height: 40, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, paddingLeft: 36, paddingRight: 12, fontSize: 13, color: C.text, outline: 'none' },
  eyeBtn: { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.muted, padding: 4 },
  errorBox: { background: '#2A1515', border: `1px solid ${C.error}44`, borderRadius: 6, padding: '10px 12px', fontSize: 12, color: C.error },
  submitBtn: { width: '100%', height: 42, background: C.primary, border: 'none', borderRadius: 6, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  footer: { textAlign: 'center', fontSize: 11, color: C.muted },
};