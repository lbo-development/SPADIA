import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db, type Marker } from '@/api/database';
import { Modal } from '@/components/Modal';

const C = {
  bg:      '#0E1117',
  surface: '#161B27',
  surface2:'#1C2333',
  border:  '#232B3E',
  text:    '#E8EDF5',
  muted:   '#6B7A99',
  accent:  '#378ADD',
  danger:  '#E05252',
  success: '#3DB07A',
};

const btn = (color = C.accent, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
  borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  background: outlined ? 'transparent' : color + '22',
  border: `1px solid ${outlined ? C.border : color + '55'}`,
  color: outlined ? C.muted : color,
});

const inp = {
  width: '100%', padding: '8px 11px', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' as const,
};

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function UploadIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

// ── Tag input ─────────────────────────────────────────────────────────────────

// ── SVG colorisé ─────────────────────────────────────────────────────────────

function ColoredSvg({ url, color, size = 80 }: { url: string; color?: string | null; size?: number }) {
  const [raw, setRaw] = useState<string | null>(null);

  useEffect(() => {
    if (!url) { setRaw(''); return; }
    let live = true;
    fetch(url)
      .then(r => r.ok ? r.text() : '')
      .then(t => { if (live) setRaw(t); })
      .catch(() => { if (live) setRaw(''); });
    return () => { live = false; };
  }, [url]);

  const html = useMemo(() => {
    if (!raw) return '';
    if (!color) return raw;

    const skip = (v: string) => {
      const t = v.trim().toLowerCase();
      return t === 'none' || t === 'transparent' || t.startsWith('url(') ||
             t === 'white' || t === '#fff' || t === '#ffffff';
    };

    return raw
      // style="...fill:COLOR;..." (CSS inline)
      .replace(/\bfill(?![-a-zA-Z])\s*:\s*([^;}"'\s]+)/gi,
        (_, val) => skip(val) ? `fill:${val}` : `fill:${color}`)
      // fill="COLOR" (attribut direct)
      .replace(/\bfill="([^"]*)"/gi,
        (_, val) => skip(val) ? `fill="${val}"` : `fill="${color}"`);
  }, [raw, color]);

  if (raw === null) return <div style={{ width: size, height: size, background: C.border, borderRadius: 6, flexShrink: 0 }} />;

  return (
    <div
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function add(val: string) {
    const trimmed = val.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) onChange(tags.slice(0, -1));
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'text', minHeight: 38 }}
    >
      {tags.map(t => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: C.accent + '22', border: `1px solid ${C.accent}44`, borderRadius: 20, fontSize: 11, color: C.accent }}>
          {t}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(tags.filter(x => x !== t)); }}
            style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={tags.length === 0 ? 'Ajouter un mot-clé…' : ''}
        style={{ flex: 1, minWidth: 100, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: C.text, padding: '2px 0' }}
      />
    </div>
  );
}

// ── Marker modal ──────────────────────────────────────────────────────────────

type MarkerForm = { nom: string; couleur: string; mots_cles: string[]; storage_path: string; preview_url: string };

function MarkerModal({ initial, onSave, onClose }: {
  initial?: Marker;
  onSave: (data: MarkerForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MarkerForm>({
    nom:          initial?.nom          ?? '',
    couleur:      initial?.couleur      ?? '#378ADD',
    mots_cles:    initial?.mots_cles    ?? [],
    storage_path: initial?.storage_path ?? '',
    preview_url:  initial?.public_url   ?? '',
  });
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const [err,       setErr]       = useState('');

  async function handleFile(file: File) {
    if (file.type !== 'image/svg+xml') { setErr('Seul le format SVG est accepté.'); return; }
    setUploading(true); setErr('');
    try {
      const { data } = await db.uploadMarker(file);
      setForm(f => ({ ...f, storage_path: data.path, preview_url: data.url, ...(data.color ? { couleur: data.color } : {}) }));
    } catch { setErr("Erreur lors de l'upload."); }
    finally { setUploading(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onClickZone() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/svg+xml';
    input.onchange = () => { const f = input.files?.[0]; if (f) handleFile(f); };
    input.click();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setErr('Le nom est requis.'); return; }
    if (!form.storage_path) { setErr('Un fichier SVG est requis.'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch { setErr('Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      title={initial ? 'Modifier le marker' : 'Nouveau marker'}
      onClose={onClose}
      maxWidth={480}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={btn(C.muted, true)} onClick={onClose}>Annuler</button>
          <button type="submit" form="marker-form" disabled={saving || uploading} style={btn(C.accent)}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      }
    >
      <form id="marker-form" onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Nom + Couleur */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Nom *</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inp} placeholder="Nom du marker" />
            </div>
            <div style={{ flexShrink: 0 }}>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Couleur</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" value={form.couleur || '#378ADD'}
                  onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                  style={{ width: 36, height: 36, border: `1px solid ${C.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', padding: 2 }}
                />
                <input value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                  style={{ ...inp, width: 90 }} placeholder="#rrggbb" />
              </div>
            </div>
          </div>

          {/* Mots-clés */}
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Mots-clés <span style={{ color: C.muted, fontSize: 10 }}>(Entrée ou virgule pour valider)</span></label>
            <TagInput tags={form.mots_cles} onChange={tags => setForm(f => ({ ...f, mots_cles: tags }))} />
          </div>

          {/* SVG drop zone */}
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Fichier SVG *</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={onClickZone}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: 120, border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 10, cursor: 'pointer', background: dragOver ? C.accent + '0A' : C.bg, transition: 'border-color .15s, background .15s', position: 'relative', overflow: 'hidden' }}
            >
              {uploading ? (
                <span style={{ fontSize: 12, color: C.muted }}>Upload en cours…</span>
              ) : form.preview_url ? (
                <>
                  <ColoredSvg url={form.preview_url} color={form.couleur} size={72} />
                  <span style={{ fontSize: 10, color: C.muted }}>Cliquer ou déposer pour remplacer</span>
                </>
              ) : (
                <>
                  <span style={{ color: C.muted }}><UploadIcon /></span>
                  <span style={{ fontSize: 12, color: C.muted }}>Glisser-déposer ou cliquer pour choisir un SVG</span>
                </>
              )}
            </div>
          </div>
        </div>

        {err && <p style={{ color: C.danger, fontSize: 12, margin: '12px 0 0' }}>{err}</p>}
      </form>
    </Modal>
  );
}

// ── Marker card ───────────────────────────────────────────────────────────────

function MarkerCard({ marker, canWrite, onEdit, onDelete }: {
  marker: Marker; canWrite: boolean; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Ligne 1 : Nom */}
      <div style={{ padding: '10px 10px 6px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textAlign: 'center' }} title={marker.nom}>
          {marker.nom}
        </span>
      </div>

      {/* Ligne 2 : Icône */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', background: C.bg }}>
        <ColoredSvg url={marker.public_url} color={marker.couleur} size={48} />
      </div>

      {/* Ligne 3 : Actions */}
      {canWrite && (
        <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onEdit} title="Modifier"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted }}>
            <PencilIcon />
          </button>
          <div style={{ width: 1, background: C.border }} />
          <button onClick={onDelete} title="Supprimer"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.danger }}>
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarkersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === ROLES.ADMIN_APP || user?.role === ROLES.ADMIN_DATA;

  const [markers,  setMarkers]  = useState<Marker[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState<{ mode: 'create' | 'edit'; marker?: Marker } | null>(null);
  const [delTarget, setDelTarget] = useState<Marker | null>(null);

  const loadMarkers = useCallback(async () => {
    setLoading(true);
    try { const { data } = await db.listMarkers(); setMarkers(data ?? []); }
    catch { setMarkers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMarkers(); }, [loadMarkers]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? markers.filter(m =>
        m.nom.toLowerCase().includes(q) ||
        m.mots_cles.some(k => k.includes(q))
      )
    : markers;

  async function saveMarker(form: MarkerForm) {
    const payload = { nom: form.nom, storage_path: form.storage_path, mots_cles: form.mots_cles, couleur: form.couleur || null };
    if (modal?.mode === 'edit' && modal.marker) {
      await db.updateMarker(modal.marker.id, payload);
    } else {
      await db.createMarker(payload);
    }
    await loadMarkers();
  }

  async function confirmDelete() {
    if (!delTarget) return;
    await db.removeMarker(delTarget.id);
    setDelTarget(null);
    await loadMarkers();
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 40px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Bibliothèque de markers</h1>
        {canWrite && (
          <button style={btn(C.accent)} onClick={() => setModal({ mode: 'create' })}>
            <PlusIcon /> Nouveau marker
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 360 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, display: 'flex' }}><SearchIcon /></span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou mot-clé…"
          style={{ ...inp, paddingLeft: 32 }}
        />
      </div>

      {/* Grid */}
      {loading && <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: 60 }}>Chargement…</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: 60 }}>
          {search ? 'Aucun marker correspondant.' : 'Aucun marker. Cliquez sur « Nouveau marker » pour commencer.'}
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
          {filtered.map(m => (
            <MarkerCard
              key={m.id}
              marker={m}
              canWrite={canWrite}
              onEdit={() => setModal({ mode: 'edit', marker: m })}
              onDelete={() => setDelTarget(m)}
            />
          ))}
        </div>
      )}

      {modal && (
        <MarkerModal
          initial={modal.marker}
          onSave={saveMarker}
          onClose={() => setModal(null)}
        />
      )}
      {delTarget && (
        <Modal
          title="Confirmation"
          onClose={() => setDelTarget(null)}
          maxWidth={400}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btn(C.muted, true)} onClick={() => setDelTarget(null)}>Annuler</button>
              <button style={btn(C.danger)} onClick={confirmDelete}>Supprimer</button>
            </div>
          }
        >
          <p style={{ margin: 0, fontSize: 14, color: C.text }}>{`Supprimer le marker « ${delTarget.nom} » ?`}</p>
        </Modal>
      )}
    </div>
  );
}
