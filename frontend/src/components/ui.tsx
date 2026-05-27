import { C } from '@/constants/colors';

/* ── Input ──────────────────────────────────────────────────────────────────── */

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 'var(--r-md)',
  fontSize: 'var(--text-base)' as unknown as number,
  color: C.text,
  outline: 'none',
  boxSizing: 'border-box',
};

/* ── Button ─────────────────────────────────────────────────────────────────── */

export function btnStyle(color = C.accent, outlined = false): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 16px',
    borderRadius: 'var(--r-lg)',
    fontSize: 'var(--text-base)' as unknown as number,
    fontWeight: 500,
    cursor: 'pointer',
    background: outlined ? 'transparent' : color,
    border: `1px solid ${outlined ? C.border : color}`,
    color: outlined ? C.muted : '#fff',
  };
}

/* ── Label ──────────────────────────────────────────────────────────────────── */

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ fontSize: 'var(--text-sm)' as unknown as number, color: C.muted, display: 'block', marginBottom: 5 }}
    >
      {children}
    </label>
  );
}

/* ── FormSection ────────────────────────────────────────────────────────────── */

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 'var(--text-2xs)' as unknown as number, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{children}</div>
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────────────────────────── */

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}
