import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/api/database';
import { Modal } from '@/components/Modal';

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'boolean' | 'select' | 'password' | 'avatar' | 'textarea';
  options?: { value: string; label: string; [key: string]: string }[];
  required?: boolean;
  /** Obligatoire uniquement en création, optionnel en modification */
  createRequired?: boolean;
  createOnly?: boolean;
  /** Filtre les options du select en fonction de la valeur d'un autre champ */
  dependsOn?: { field: string; optionKey: string };
  min?: number;
  max?: number;
  layoutGroup?: string;
  /** Contrôle le flex du champ dans son layoutGroup (défaut : 1) */
  layoutFlex?: React.CSSProperties['flex'];
  /** Avatar : clé du champ contenant le nom affiché + initiales */
  nameField?: string;
  /** Validation regex pour les champs text */
  pattern?: RegExp;
  patternMessage?: string;
  /** Valeur initiale à la création (écrase le défaut vide/0) */
  defaultValue?: unknown;
};

export type ColumnDef = {
  key: string;
  label: string;
  render?: (value: unknown, row?: Record<string, unknown>) => React.ReactNode;
  sortable?: boolean;
  /** Clés de tri composé : la première suit la direction, les suivantes sont toujours croissantes */
  sortKeys?: string[];
};

interface Props {
  entity: string;
  title: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  canWrite: boolean;
  canCreate?: boolean;
  searchKeys?: string[];
  reorderable?: boolean;
  orderKey?: string;
  orderLabel?: string;
  filterFn?: (row: Row) => boolean;
  filterSlot?: React.ReactNode;
  rowActions?: Array<{ icon: React.ReactNode; title: string; onClick: (row: Row) => void }>;
  compact?: boolean;
}

type Row = Record<string, unknown>;

// ── Utilitaires avatar ───────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#0078D4', '#107C10', '#D83B01', '#5C2D91',
  '#038387', '#CA5010', '#00B294', '#B4009E',
];

function nameToColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function toInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

// ── Groupement des champs (layoutGroup) ─────────────────────────────────────

function groupFields(active: FieldDef[]): Array<FieldDef | FieldDef[]> {
  const result: Array<FieldDef | FieldDef[]> = [];
  const seen = new Set<string>();
  for (const f of active) {
    if (!f.layoutGroup) {
      result.push(f);
    } else if (!seen.has(f.layoutGroup)) {
      seen.add(f.layoutGroup);
      result.push(active.filter(g => g.layoutGroup === f.layoutGroup));
    }
  }
  return result;
}

// ── Validation client ────────────────────────────────────────────────────────

function validate(fields: FieldDef[], form: Record<string, unknown>, mode: 'create' | 'edit'): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.createOnly && mode !== 'create') continue;
    const val = form[f.key];
    const empty = val === '' || val === null || val === undefined;
    if ((f.required || (f.createRequired && mode === 'create')) && empty && f.type !== 'avatar') errors[f.key] = 'Ce champ est requis.';
    if (f.pattern && !empty && !f.pattern.test(String(val)))
      errors[f.key] = f.patternMessage ?? 'Format invalide.';
    if (f.type === 'email' && !empty && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val)))
      errors[f.key] = 'Adresse email invalide.';
    if (f.type === 'password' && !empty && String(val).length < 6)
      errors[f.key] = 'Minimum 6 caractères.';
    if (f.type === 'number') {
      const n = Number(val);
      if (f.min !== undefined && n < f.min) errors[f.key] = `Valeur minimum : ${f.min}.`;
      if (f.max !== undefined && n > f.max) errors[f.key] = `Valeur maximum : ${f.max}.`;
    }
  }
  return errors;
}

// ── Mapping erreur serveur → champ ──────────────────────────────────────────

function parseServerError(err: unknown): { fieldErrors: Record<string, string>; globalError: string | null } {
  const resp = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })
    ?.response?.data?.error;
  const code    = resp?.code    ?? '';
  const message = resp?.message ?? 'Erreur lors de la sauvegarde.';
  const lc = message.toLowerCase();
  if (code === 'AUTH_ERROR') {
    if (lc.includes('already') || lc.includes('exist') || lc.includes('email'))
      return { fieldErrors: { email: 'Cet email est déjà utilisé.' }, globalError: null };
    if (lc.includes('password') || lc.includes('mot de passe'))
      return { fieldErrors: { password: message }, globalError: null };
  }
  if (code === 'INVALID_INPUT') {
    if (lc.includes('email'))    return { fieldErrors: { email: message },    globalError: null };
    if (lc.includes('nom'))      return { fieldErrors: { nom: message },      globalError: null };
    if (lc.includes('password')) return { fieldErrors: { password: message }, globalError: null };
  }
  return { fieldErrors: {}, globalError: message };
}

// ── Icônes SVG ───────────────────────────────────────────────────────────────

function PlusIcon()   {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function CameraIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
function TrashIcon()  {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
}
function SpinnerIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
}
function ErrorIcon()  {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function UserIcon()    {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
}
function GripIcon()    {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>;
}
function ReorderIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="5" x2="20" y2="5"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="19" x2="20" y2="19"/></svg>;
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function CrudPage({ entity, title, columns, fields, canWrite, canCreate = true, searchKeys, reorderable, orderKey = 'order', orderLabel = 'nom', filterFn, filterSlot, rowActions, compact = false }: Props) {
  const [rows, setRows]         = useState<Row[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [sort, setSort]         = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [modal, setModal]       = useState<{ mode: 'create' | 'edit'; row?: Row } | null>(null);
  const [form, setForm]         = useState<Record<string, unknown>>({});
  const [saving, setSaving]     = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [dragging, setDragging]         = useState(false);
  const [reorderModal, setReorderModal] = useState(false);
  const [reorderList, setReorderList]   = useState<Row[]>([]);
  const [reordering, setReordering]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dragOverIdx, setDragOverIdx]   = useState<number | null>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const avatarFieldKey  = useRef<string>('');
  const reorderDragIdx  = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await db.list(entity);
setRows(data as Row[]);
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    const defaults: Record<string, unknown> = {};
    fields.forEach(f => {
      defaults[f.key] = f.defaultValue !== undefined
        ? f.defaultValue
        : f.type === 'boolean' ? true : f.type === 'number' ? (f.min ?? 0) : '';
    });
    setForm(defaults); setFieldErrors({}); setGlobalError(null); setAvatarImgFailed(false);
    setModal({ mode: 'create' });
  }

  function openEdit(row: Row) {
    const vals: Record<string, unknown> = {};
    fields.forEach(f => {
      vals[f.key] = row[f.key] ?? (f.type === 'boolean' ? false : f.type === 'number' ? (f.min ?? 0) : '');
    });
    setForm(vals); setFieldErrors({}); setGlobalError(null); setAvatarImgFailed(false);
    setModal({ mode: 'edit', row });
  }

  function clearFieldError(key: string) {
    setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  async function handleAvatarFile(file: File, key: string) {
    if (file.type !== 'image/png') {
      setFieldErrors(prev => ({ ...prev, [key]: 'Seul le format PNG est accepté.' }));
      return;
    }
    clearFieldError(key);
    setAvatarUploading(true);
    try {
      const { data } = await db.uploadAvatar(file);
      setForm(v => ({ ...v, [key]: data.url }));
      setAvatarImgFailed(false);
    } catch {
      setFieldErrors(prev => ({ ...prev, [key]: "Erreur lors de l'envoi de l'image." }));
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!modal) return;
    const clientErrors = validate(fields, form, modal.mode);
    if (Object.keys(clientErrors).length > 0) { setFieldErrors(clientErrors); return; }
    setSaving(true); setFieldErrors({}); setGlobalError(null);
    try {
      if (modal.mode === 'create') {
        await db.create(entity, form);
      } else {
        await db.update(entity, modal.row!.id as string, form);
      }
      setModal(null);
      await load();
    } catch (err) {
      const { fieldErrors: fe, globalError: ge } = parseServerError(err);
      setFieldErrors(fe); setGlobalError(ge);
    } finally {
      setSaving(false);
    }
  }

  function openReorder() {
    const base = filterFn ? rows.filter(filterFn) : rows;
    setReorderList(base.sort((a, b) => Number(a[orderKey] ?? 0) - Number(b[orderKey] ?? 0)));
    setDragOverIdx(null);
    setReorderModal(true);
  }

  function onReorderDragStart(idx: number) {
    reorderDragIdx.current = idx;
  }

  function onReorderDragEnter(idx: number) {
    if (reorderDragIdx.current !== null && reorderDragIdx.current !== idx) setDragOverIdx(idx);
  }

  function onReorderDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const src = reorderDragIdx.current;
    if (src !== null && src !== targetIdx) {
      setReorderList(prev => {
        const next = [...prev];
        const [item] = next.splice(src, 1);
        next.splice(targetIdx, 0, item);
        return next;
      });
    }
    reorderDragIdx.current = null;
    setDragOverIdx(null);
  }

  function onReorderDragEnd() {
    reorderDragIdx.current = null;
    setDragOverIdx(null);
  }

  async function handleSaveOrder() {
    setReordering(true);
    try {
      await Promise.all(reorderList.map((row, i) => db.update(entity, row.id as string, { [orderKey]: i })));
      setReorderModal(false);
      await load();
    } catch { /* géré par l'intercepteur */ }
    finally { setReordering(false); }
  }

  async function handleDelete(id: string) {
    try { await db.remove(entity, id); setDeleteId(null); await load(); }
    catch { /* géré par l'intercepteur */ }
  }

  // ── Rendu d'un champ ─────────────────────────────────────────────────────

  const cH  = compact ? 32 : 38;
  const cFS = compact ? 12 : 13;
  const sInput    = compact ? { ...s.input,    height: cH, fontSize: cFS } : s.input;
  const sSpinWrap = compact ? { ...s.spinWrap, height: cH } : s.spinWrap;
  const sSpinBtn  = compact ? { ...s.spinBtn,  height: cH, width: cH } : s.spinBtn;
  const sSpinInp  = compact ? { ...s.spinInput, height: cH } : s.spinInput;

  function renderField(f: FieldDef) {
    const hasError = Boolean(fieldErrors[f.key]);

    const control = (() => {

      // ── Avatar ──────────────────────────────────────────────────────────
      if (f.type === 'avatar') {
        const displayName = f.nameField ? String(form[f.nameField] ?? '') : '';
        const avatarUrl   = String(form[f.key] ?? '');
        const color       = displayName ? nameToColor(displayName) : '#2D3A52';
        const inits       = toInitials(displayName);

        return (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleAvatarFile(file, f.key);
              }}
            />
            <div
              style={{ ...s.avatarZone, ...(dragging ? s.avatarZoneDrag : {}) }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
              onDrop={e => {
                e.preventDefault(); setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) { avatarFieldKey.current = f.key; handleAvatarFile(file, f.key); }
              }}
            >
              {/* Cercle — initiales en fond, photo par-dessus */}
              <div
                style={{ ...s.avatarCircle, background: color, cursor: 'pointer' }}
                onClick={() => { avatarFieldKey.current = f.key; fileInputRef.current?.click(); }}
                title="Cliquer ou glisser une photo"
              >
                {!avatarImgFailed && avatarUrl
                  ? <img
                      src={avatarUrl}
                      alt=""
                      style={s.avatarImg}
                      onError={() => setAvatarImgFailed(true)}
                    />
                  : inits
                    ? <span style={s.avatarInits}>{inits}</span>
                    : <UserIcon />
                }
              </div>

              {/* Nom centré + boutons à droite */}
              <div style={s.avatarMeta}>
                {displayName && <span style={s.avatarName}>{displayName}</span>}
                <div style={s.avatarActions}>
                  <button
                    type="button"
                    style={avatarUploading ? s.iconBtnDisabled : s.iconBtnPrimary}
                    disabled={avatarUploading}
                    title={avatarUrl ? 'Modifier la photo' : 'Ajouter une photo'}
                    onClick={() => { avatarFieldKey.current = f.key; fileInputRef.current?.click(); }}
                  >
                    {avatarUploading ? <SpinnerIcon /> : <CameraIcon />}
                  </button>
                  {avatarUrl && !avatarUploading && (
                    <button
                      type="button"
                      style={s.iconBtnDanger}
                      title="Retirer la photo"
                      onClick={() => { setForm(v => ({ ...v, [f.key]: '' })); clearFieldError(f.key); }}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      }

      // ── Toggle ──────────────────────────────────────────────────────────
      if (f.type === 'boolean') {
        return (
          <label style={s.toggleWrap}>
            <div
              style={{ ...s.toggleTrack, background: form[f.key] ? C.primary : '#2D3A52' }}
              onClick={() => setForm(v => ({ ...v, [f.key]: !v[f.key] }))}
            >
              <div style={{ ...s.toggleThumb, transform: form[f.key] ? 'translateX(18px)' : 'translateX(2px)' }} />
            </div>
            <span style={s.toggleLabel}>{form[f.key] ? 'Oui' : 'Non'}</span>
          </label>
        );
      }

      // ── Select ──────────────────────────────────────────────────────────
      if (f.type === 'select') {
        const visibleOptions = f.dependsOn
          ? (f.options ?? []).filter(o => o[f.dependsOn!.optionKey] === String(form[f.dependsOn!.field] ?? ''))
          : (f.options ?? []);
        return (
          <select
            value={String(form[f.key] ?? '')}
            onChange={e => {
              const val = e.target.value;
              setForm(v => {
                const next = { ...v, [f.key]: val };
                fields.forEach(dep => { if (dep.dependsOn?.field === f.key) next[dep.key] = ''; });
                return next;
              });
              clearFieldError(f.key);
            }}
            style={{ ...sInput, ...(hasError ? s.inputError : {}) }}
          >
            <option value="">— Choisir —</option>
            {visibleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }

      // ── Spinner numérique ────────────────────────────────────────────────
      if (f.type === 'number') {
        const val  = Number(form[f.key] ?? f.min ?? 0);
        const atMin = f.min !== undefined && val <= f.min;
        const atMax = f.max !== undefined && val >= f.max;
        return (
          <div style={{ ...sSpinWrap, ...(hasError ? s.spinWrapErr : {}) }}>
            <button
              type="button"
              style={{ ...sSpinBtn, ...(atMin ? s.spinBtnOff : {}) }}
              disabled={atMin}
              onClick={() => { setForm(v => ({ ...v, [f.key]: Math.max(f.min ?? 0, val - 1) })); clearFieldError(f.key); }}
            >−</button>
            <div style={s.spinDiv} />
            <input
              type="text"
              inputMode="numeric"
              value={String(form[f.key] ?? 0)}
              onChange={e => {
                const n = parseInt(e.target.value, 10);
                const clamped = isNaN(n) ? (f.min ?? 0) : Math.min(f.max ?? Infinity, Math.max(f.min ?? 0, n));
                setForm(v => ({ ...v, [f.key]: clamped }));
                clearFieldError(f.key);
              }}
              style={sSpinInp}
            />
            {(f.min !== undefined || f.max !== undefined) && (
              <span style={s.spinRange}>{f.min ?? '?'}–{f.max ?? '?'}</span>
            )}
            <div style={s.spinDiv} />
            <button
              type="button"
              style={{ ...sSpinBtn, ...(atMax ? s.spinBtnOff : {}) }}
              disabled={atMax}
              onClick={() => { setForm(v => ({ ...v, [f.key]: Math.min(f.max ?? Infinity, val + 1) })); clearFieldError(f.key); }}
            >+</button>
          </div>
        );
      }

      // ── Textarea ────────────────────────────────────────────────────────
      if (f.type === 'textarea') {
        return (
          <textarea
            value={String(form[f.key] ?? '')}
            onChange={e => { setForm(v => ({ ...v, [f.key]: e.target.value })); clearFieldError(f.key); }}
            style={{ ...s.textarea, ...(hasError ? s.inputError : {}) }}
            rows={3}
          />
        );
      }

      // ── Text / email / password ──────────────────────────────────────────
      if (f.type === 'password') {
        return (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={String(form[f.key] ?? '')}
              onChange={e => { setForm(v => ({ ...v, [f.key]: e.target.value })); clearFieldError(f.key); }}
              style={{ ...sInput, ...(hasError ? s.inputError : {}), paddingRight: 36, width: '100%' }}
              required={f.required}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              title={showPassword ? 'Masquer' : 'Afficher'}
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6B7A99', display: 'flex', alignItems: 'center' }}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        );
      }
      return (
        <input
          type={f.type === 'email' ? 'email' : 'text'}
          value={String(form[f.key] ?? '')}
          onChange={e => { setForm(v => ({ ...v, [f.key]: e.target.value })); clearFieldError(f.key); }}
          style={{ ...sInput, ...(hasError ? s.inputError : {}) }}
          required={f.required}
        />
      );
    })();

    return (
      <div key={f.key} style={{ ...s.fieldGroup, flex: f.layoutFlex ?? 1, minWidth: 0 }}>
        {f.type !== 'avatar' && (
          <label style={s.label}>
            {f.label}{f.required && <span style={s.required}> *</span>}
          </label>
        )}
        {control}
        {hasError && <span style={s.fieldErr}><ErrorIcon /> {fieldErrors[f.key]}</span>}
      </div>
    );
  }

  // ── JSX ──────────────────────────────────────────────────────────────────

  const filtered = rows
    .filter(row => !filterFn || filterFn(row))
    .filter(row => !search.trim() || !searchKeys?.length ||
      searchKeys.some(key => String(row[key] ?? '').toLowerCase().includes(search.toLowerCase())));

  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const col = columns.find(c => c.key === sort.key);
        const keys = col?.sortKeys ?? [sort.key];
        for (let i = 0; i < keys.length; i++) {
          const cmp = String(a[keys[i]] ?? '').localeCompare(String(b[keys[i]] ?? ''), 'fr', { sensitivity: 'base', numeric: true });
          if (cmp !== 0) return i === 0 ? (sort.dir === 'asc' ? cmp : -cmp) : cmp;
        }
        return 0;
      })
    : filtered;

  function toggleSort(key: string) {
    setSort(prev => prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  return (
    <div style={s.root}>
      <div style={s.stickyTop}>
      {/* En-tête */}
      <div style={s.header}>
        <h2 style={s.title}>
          {title}
          <span style={s.count}>{filtered.length} enregistrement{filtered.length > 1 ? 's' : ''}</span>
        </h2>
        {searchKeys && searchKeys.length > 0 && (
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite && reorderable && (
            <button style={s.reorderBtn} onClick={openReorder} title="Réordonner">
              <ReorderIcon />
            </button>
          )}
          {canWrite && canCreate && (
            <button style={s.addBtn} onClick={openCreate} title="Ajouter">
              <PlusIcon />
            </button>
          )}
        </div>
      </div>

      {/* Slot filtre optionnel */}
      {filterSlot && <div style={s.filterSlot}>{filterSlot}</div>}
      </div>

      <div style={s.scrollArea}>
      {/* Table */}
      {loading ? (
        <div style={s.loadWrap}><div style={s.loadSpinner} /></div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={{ ...s.th, ...(col.sortable ? s.thSortable : {}), ...(sort?.key === col.key ? s.thActive : {}) }}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {col.label}
                      {col.sortable && (
                        <span style={{ fontSize: 10, color: sort?.key === col.key ? C.accent : C.muted, lineHeight: 1, opacity: sort?.key === col.key ? 1 : 0.6 }}>
                          {sort?.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
                {canWrite && <th style={{ ...s.th, width: 80 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={columns.length + 1} style={s.empty}>{search.trim() ? 'Aucun résultat' : 'Aucune donnée'}</td></tr>
              ) : sorted.map((row, i) => (
                <tr key={row.id as string} style={{ background: i % 2 === 0 ? '#161B27' : '#1A2032' }}>
                  {columns.map(col => (
                    <td key={col.key} style={s.td}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                  {canWrite && (
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {rowActions?.map((action, idx) => (
                          <button key={idx} style={s.rowEditBtn} onClick={() => action.onClick(row)} title={action.title}>
                            {action.icon}
                          </button>
                        ))}
                        <button style={s.rowEditBtn} onClick={() => openEdit(row)} title="Modifier">
                          <PencilIcon />
                        </button>
                        <button style={s.rowDelBtn} onClick={() => setDeleteId(row.id as string)} title="Supprimer">
                          ✕
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Modale création / édition */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? `Ajouter — ${title}` : `Modifier — ${title}`}
          onClose={() => { setModal(null); setShowPassword(false); }}
          maxWidth={560}
          footer={
            <div style={s.modalFoot}>
              <button style={s.cancelBtn} onClick={() => { setModal(null); setShowPassword(false); }} disabled={saving}>Annuler</button>
              <button style={saving ? s.saveBtnOff : s.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? <><SpinnerIcon /> Sauvegarde…</> : 'Sauvegarder'}
              </button>
            </div>
          }
        >
          <div style={{ ...s.modalBody, gap: compact ? 10 : 16 }}>
            {groupFields(fields.filter(f => !f.createOnly || modal?.mode === 'create')).map((item, idx) =>
              Array.isArray(item) ? (
                <div key={item[0].layoutGroup ?? idx} style={{ display: 'flex', gap: compact ? 8 : 12 }}>
                  {item.map(f => renderField(f))}
                </div>
              ) : renderField(item)
            )}
            {globalError && (
              <div style={s.errBox}><ErrorIcon /> {globalError}</div>
            )}
          </div>
        </Modal>
      )}

      {/* Modale réordonnancement */}
      {reorderModal && (
        <Modal
          title="Réordonner"
          onClose={() => setReorderModal(false)}
          maxWidth={420}
          footer={
            <div style={s.modalFoot}>
              <button style={s.cancelBtn} onClick={() => setReorderModal(false)} disabled={reordering}>Annuler</button>
              <button style={reordering ? s.saveBtnOff : s.saveBtn} onClick={handleSaveOrder} disabled={reordering}>
                {reordering ? <><SpinnerIcon /> Sauvegarde…</> : 'Sauvegarder'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reorderList.map((row, i) => (
              <div
                key={row.id as string}
                draggable
                onDragStart={() => onReorderDragStart(i)}
                onDragEnter={() => onReorderDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onReorderDrop(e, i)}
                onDragEnd={onReorderDragEnd}
                style={{ ...s.reorderItem, ...(dragOverIdx === i ? s.reorderItemOver : {}) }}
              >
                <span style={s.reorderGrip}><GripIcon /></span>
                <span style={{ fontSize: 13, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(row[orderLabel] ?? '')}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Modale suppression */}
      {deleteId && (
        <Modal
          title="Confirmation"
          onClose={() => setDeleteId(null)}
          maxWidth={400}
          footer={
            <div style={s.modalFoot}>
              <button style={s.cancelBtn} onClick={() => setDeleteId(null)}>Annuler</button>
              <button style={{ ...s.saveBtn, background: '#C0392B' }} onClick={() => handleDelete(deleteId)}>Supprimer</button>
            </div>
          }
        >
          <p style={{ color: '#9BA8C0', fontSize: 13, margin: 0 }}>Cette action est irréversible.</p>
        </Modal>
      )}
    </div>
  );
}

// ── Design tokens + styles ───────────────────────────────────────────────────

const C = {
  bg: '#0E1117', surface: '#161B27', border: '#232B3E',
  primary: '#185FA5', accent: '#378ADD',
  text: '#E8EDF5', muted: '#6B7A99',
  error: '#E05252', errorBg: '#2A1515', errorBorder: '#C0392B55',
};

const s: Record<string, React.CSSProperties> = {
  // ── Page ──
  root:      { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  stickyTop: { flexShrink: 0, padding: '28px 32px 0', background: C.bg },
  scrollArea:{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 32px 28px', boxSizing: 'border-box' as const },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title:  { margin: 0, fontSize: 18, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 12 },
  count:  { fontSize: 12, fontWeight: 400, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px' },
  // Bouton "Ajouter" — icône ronde
  addBtn:      { width: 34, height: 34, background: C.primary, border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reorderBtn:  { width: 34, height: 34, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '50%', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reorderItem:     { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.surface, borderWidth: 1, borderStyle: 'solid' as const, borderColor: C.border, borderRadius: 8, cursor: 'grab', userSelect: 'none' as const, transition: 'border-color 0.1s, background 0.1s' },
  reorderItemOver: { borderColor: C.accent, background: '#12213A' },
  reorderGrip:     { color: C.muted, flexShrink: 0, display: 'flex' },
  searchInput: { height: 34, padding: '0 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', width: 220, boxSizing: 'border-box' as const },

  filterSlot: { marginBottom: 16 },

  // ── Table ──
  loadWrap:    { display: 'flex', justifyContent: 'center', padding: 60 },
  loadSpinner: { width: 24, height: 24, border: '2px solid #232B3E', borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  tableWrap:   { flex: 1, overflowX: 'auto' as const, overflowY: 'auto' as const, borderRadius: 10, border: `1px solid ${C.border}` },
  table:       { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th:          { padding: '10px 14px', background: '#1C2333', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'left' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, zIndex: 2 },
  thSortable:  { cursor: 'pointer', userSelect: 'none' as const },
  thActive:    { color: C.accent },
  td:          { padding: '10px 14px', color: C.text, borderBottom: `1px solid ${C.border}`, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  empty:       { padding: '32px 14px', textAlign: 'center' as const, color: C.muted, fontSize: 13 },
  // Bouton "Modifier" en ligne — icône crayon
  rowEditBtn:  { width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  rowDelBtn:   { width: 28, height: 28, background: 'transparent', border: `1px solid ${C.errorBorder}`, borderRadius: 6, color: '#C0392B', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

  // ── Champ ──
  fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label:      { fontSize: 12, fontWeight: 500, color: C.muted, letterSpacing: '0.03em' },
  required:   { color: C.error },
  input:      { height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '0 12px', fontSize: 13, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  textarea:   { minHeight: 80, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', fontSize: 13, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'inherit' },
  inputError: { borderColor: '#C0392B' },
  fieldErr:   { display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, color: C.error, marginTop: 1 },
  errBox:     { display: 'flex', alignItems: 'flex-start', gap: 8, background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 7, padding: '10px 14px', fontSize: 12, color: C.error },

  // ── Spinner numérique ──
  spinWrap:    { display: 'flex', alignItems: 'center', height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' },
  spinWrapErr: { borderColor: '#C0392B' },
  spinBtn:     { width: 38, height: 38, flexShrink: 0, background: 'transparent', border: 'none', color: C.accent, fontSize: 20, fontWeight: 300, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  spinBtnOff:  { color: C.border, cursor: 'not-allowed' },
  spinDiv:     { width: 1, height: 18, background: C.border, flexShrink: 0 },
  spinInput:   { flex: 1, height: 38, background: 'transparent', border: 'none', textAlign: 'center' as const, fontSize: 14, fontWeight: 600, color: C.text, outline: 'none', minWidth: 0 },
  spinRange:   { fontSize: 10, color: C.muted, padding: '0 6px', whiteSpace: 'nowrap' as const, flexShrink: 0 },

  // ── Toggle ──
  toggleWrap:  { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' as const, height: 38 },
  toggleTrack: { width: 42, height: 24, borderRadius: 12, position: 'relative' as const, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 },
  toggleThumb: { position: 'absolute' as const, top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'transform 0.2s' },
  toggleLabel: { fontSize: 13, color: C.text },

  // ── Avatar ──
  avatarZone:    { display: 'flex', alignItems: 'center', gap: 18, padding: '14px 16px', background: C.bg, border: `1.5px dashed ${C.border}`, borderRadius: 10, transition: 'border-color 0.15s, background 0.15s' },
  avatarZoneDrag:{ borderColor: C.accent, background: '#12213A' },
  // Cercle 72×72 — position relative pour l'overlay de l'image
  avatarCircle:  { width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  avatarInits:   { fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', userSelect: 'none' as const },
  avatarImg:     { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },
  avatarMeta:    { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, gap: 8 },
  avatarName:    { fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, minWidth: 0 },
  avatarActions: { display: 'flex', gap: 8, flexShrink: 0 },
  // Boutons icône avatar
  iconBtnPrimary:  { width: 32, height: 32, background: C.primary, border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnDisabled: { width: 32, height: 32, background: '#1A2C45', border: 'none', borderRadius: 7, color: C.muted, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger:   { width: 32, height: 32, background: 'transparent', border: `1px solid ${C.errorBorder}`, borderRadius: 7, color: '#C0392B', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

  // ── Boutons modale ──
  cancelBtn:  { height: 36, padding: '0 18px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 13, cursor: 'pointer' },
  saveBtn:    { height: 36, padding: '0 18px', background: C.primary, border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 },
  saveBtnOff: { height: 36, padding: '0 18px', background: '#1A2C45', border: 'none', borderRadius: 7, color: C.muted, fontSize: 13, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8 },

  // ── Pied de modale ──
  modalBody: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  modalFoot: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
};
