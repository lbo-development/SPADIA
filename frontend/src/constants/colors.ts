// Tokens de couleur partagés — toutes les valeurs sont des références CSS variables.
// Les thèmes dark/light sont définis dans index.css via :root et html[data-theme="light"].
// Chaque fichier importe ce C au lieu de définir son propre objet local.

export const C = {
  // ── Base ────────────────────────────────────────────────────────────────────
  bg:       'var(--bg)',
  surface:  'var(--surface)',
  surface2: 'var(--surface2)',
  border:   'var(--border)',
  text:     'var(--text)',
  muted:    'var(--muted)',
  // ── Brand ───────────────────────────────────────────────────────────────────
  accent:   'var(--accent)',
  primary:  'var(--primary)',
  // ── Sémantique ──────────────────────────────────────────────────────────────
  danger:   'var(--danger)',
  error:    'var(--danger)',    // alias
  success:  'var(--success)',
  warning:  'var(--warning)',
  warn:     'var(--warning)',   // alias
  // ── Spécifique ──────────────────────────────────────────────────────────────
  errorBg:     'var(--error-bg)',
  errorBorder: 'var(--error-border)',
  reorderOver: 'var(--reorder-over)',
  // ── Variantes alpha de l'accent ─────────────────────────────────────────────
  // Remplacent les concaténations C.accent + 'XX' et `${C.accent}XX`
  accent08:  'var(--accent-08)',
  accent0a:  'var(--accent-0a)',
  accent14:  'var(--accent-14)',
  accent18:  'var(--accent-18)',
  accent22:  'var(--accent-22)',
  accent33:  'var(--accent-33)',
  accent44:  'var(--accent-44)',
  accent55:  'var(--accent-55)',
  accent66:  'var(--accent-66)',
  // ── Variantes alpha de la bordure ────────────────────────────────────────────
  border18:  'var(--border-18)',
  border20:  'var(--border-20)',
  border22:  'var(--border-22)',
  // ── Variantes alpha du danger ────────────────────────────────────────────────
  danger44:  'var(--danger-44)',
  danger88:  'var(--danger-88)',
  error44:   'var(--danger-44)', // alias
  // ── Variantes alpha muted ────────────────────────────────────────────────────
  muted88:   'var(--muted-88)',
  // ── Variantes alpha success ──────────────────────────────────────────────────
  success18: 'var(--success-18)',
  success22: 'var(--success-22)',
  success44: 'var(--success-44)',
  // ── Variantes alpha surface2 ─────────────────────────────────────────────────
  surface280: 'var(--surface2-80)',
};

export type ColorKey = keyof typeof C;
