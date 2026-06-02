import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, type DashboardData, type DashboardPV, type DashboardCalque, type DashboardFavori } from '@/api/dashboard';
import { C } from '@/constants/colors';

// ── Helpers ──────────────────────────────────────────────────────────────────

function calqueNavState(c: DashboardCalque): { nodeId: string; expanded: string[] } {
  if (c.plan_id) {
    // Priorité aux IDs du plan joint (le calque peut ne pas avoir site_id/installation_id directs)
    const siteId = c.plan_site_id ?? c.site_id;
    const instId = c.plan_installation_id ?? c.installation_id;
    if (siteId && instId) {
      return {
        nodeId: c.plan_id,
        expanded: [siteId, `grp-inst-${siteId}`, instId, `grp-plans-${instId}`],
      };
    }
  }
  if (c.installation_id && c.site_id) {
    return { nodeId: c.installation_id, expanded: [c.site_id, `grp-inst-${c.site_id}`] };
  }
  if (c.site_id) {
    return { nodeId: c.site_id, expanded: [] };
  }
  return { nodeId: '', expanded: [] };
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
}

function pvNom(pv: DashboardPV): string {
  const n = (pv.payload as Record<string, unknown>)?.nom;
  return typeof n === 'string' && n ? n : '—';
}

function pvContext(pv: DashboardPV): string {
  const parts = [pv.site_nom, pv.installation_nom, pv.dossier_nom, pv.plan_nom].filter(Boolean);
  return parts.join(' › ') || '—';
}

// ── Micro-composants ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ width: 20, height: 20, border: '2px solid var(--accent-33)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ height: 1, width: 18, background: C.border, flexShrink: 0 }} />
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ height: 1, flex: 1, background: C.border }} />
    </div>
  );
}

type StatutValue = 'En attente' | 'A compléter' | 'Validé' | 'Rejeté';

const STATUT_STYLE: Record<StatutValue, { bg: string; color: string; label: string }> = {
  'En attente':  { bg: 'var(--warning-18, #f59e0b18)', color: 'var(--warning)', label: 'En attente' },
  'A compléter': { bg: 'var(--accent-14)',              color: 'var(--accent)',   label: 'À compléter' },
  'Validé':      { bg: 'var(--success-18)',              color: 'var(--success)', label: 'Validé' },
  'Rejeté':      { bg: 'var(--danger-44)',               color: 'var(--danger)',  label: 'Rejeté' },
};

function StatutBadge({ statut }: { statut: StatutValue }) {
  const s = STATUT_STYLE[statut] ?? STATUT_STYLE['En attente'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

const ENTITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  plan:        { bg: 'var(--accent-14)',               color: 'var(--accent)',   label: 'Plan' },
  calque:      { bg: 'var(--warning-18, #f59e0b18)',   color: 'var(--warning)',  label: 'Calque' },
  fichier_pdf: { bg: 'var(--success-18)',               color: 'var(--success)', label: 'Fichier PDF' },
};

function TypeBadge({ type }: { type: string }) {
  const s = ENTITY_STYLE[type] ?? { bg: C.surface2, color: C.muted, label: type };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

const NODE_TYPE_LABELS: Record<string, string> = {
  site:         'Site',
  installation: 'Installation',
  plan:         'Plan',
  calque:       'Calque',
  dossier:      'Dossier',
};

// ── Tableau générique pour pour_validation ───────────────────────────────────

interface PVTableProps {
  rows:          DashboardPV[];
  showProposedBy?: boolean;
  showValidateur?: boolean;
}

const TH_STYLE: React.CSSProperties = {
  padding: '7px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  background: C.surface2,
};
const TD_STYLE: React.CSSProperties = {
  padding: '9px 12px', fontSize: 'var(--text-sm)', color: C.text,
  borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle',
};
const TD_MUTED: React.CSSProperties = { ...TD_STYLE, color: C.muted, fontSize: 12 };

function PVTable({ rows, showProposedBy = false, showValidateur = false }: PVTableProps) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '16px 0', color: C.muted, fontSize: 'var(--text-sm)' }}>
        Aucune demande.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--r-lg)', border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={TH_STYLE}>Type</th>
            <th style={TH_STYLE}>Nom</th>
            <th style={TH_STYLE}>Contexte</th>
            {showProposedBy && <th style={TH_STYLE}>Soumis par</th>}
            {showValidateur && <th style={TH_STYLE}>Validateur</th>}
            <th style={TH_STYLE}>Date</th>
            <th style={TH_STYLE}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(pv => (
            <tr key={pv.id} style={{ background: C.surface }}>
              <td style={TD_STYLE}><TypeBadge type={pv.entity_type} /></td>
              <td style={TD_STYLE}>{pvNom(pv)}</td>
              <td style={TD_MUTED}>{pvContext(pv)}</td>
              {showProposedBy && <td style={TD_MUTED}>{pv.proposedby_nom || '—'}</td>}
              {showValidateur && <td style={TD_MUTED}>{pv.validateur_nom || '—'}</td>}
              <td style={TD_MUTED}>{fmtDate(pv.date_propose)}</td>
              <td style={TD_STYLE}><StatutBadge statut={pv.statut} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── List boxes côte à côte ────────────────────────────────────────────────────

const LISTBOX_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
};
const LISTBOX_EMPTY: React.CSSProperties = {
  padding: '14px', color: C.muted, fontSize: 'var(--text-sm)', fontStyle: 'italic',
};

function ListBoxShell({
  title, count, maxHeight, children,
}: { title: string; count: number; maxHeight: number; children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      border: `1px solid ${C.border}`, borderRadius: 'var(--r-xl)',
      background: C.surface, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
        background: C.surface2,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
          background: C.surface, color: C.muted, border: `1px solid ${C.border}`,
        }}>
          {count}
        </span>
      </div>
      {/* scrollable list */}
      <div style={{ maxHeight, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function FavoriListBox({ favoris, onNavigate }: { favoris: DashboardFavori[]; onNavigate: (nodeId: string, expanded: string[]) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <ListBoxShell title="Mes favoris" count={favoris.length} maxHeight={200}>
      {favoris.length === 0
        ? <div style={LISTBOX_EMPTY}>Aucun favori enregistré.</div>
        : favoris.map(f => (
          <div
            key={f.id}
            role="button"
            tabIndex={0}
            onClick={() => onNavigate(f.node_id, f.expanded)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onNavigate(f.node_id, f.expanded); }}
            onMouseEnter={() => setHovered(f.id)}
            onMouseLeave={() => setHovered(null)}
            title="Ouvrir dans la carte"
            style={{
              ...LISTBOX_ITEM,
              cursor: 'pointer',
              background: hovered === f.id ? 'var(--accent-08)' : 'transparent',
              transition: 'background 0.12s',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.label}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0,
              background: C.surface2, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
              border: `1px solid ${C.border}`,
            }}>
              {NODE_TYPE_LABELS[f.node_type] ?? f.node_type}
            </span>
          </div>
        ))
      }
    </ListBoxShell>
  );
}

function CalqueListBox({ calques, onNavigate }: { calques: DashboardCalque[]; onNavigate: (nodeId: string, expanded: string[]) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <ListBoxShell title="Mes calques" count={calques.length} maxHeight={290}>
      {calques.length === 0
        ? <div style={LISTBOX_EMPTY}>Aucun calque.</div>
        : calques.map(c => {
          const ctx = [c.site_nom, c.installation_nom, c.plan_nom].filter(Boolean).join(' › ') || null;
          const isGeo = c.type === 'geographique';
          const { nodeId, expanded: ids } = calqueNavState(c);
          const canNav = !!nodeId;
          return (
            <div
              key={c.id}
              role={canNav ? 'button' : undefined}
              tabIndex={canNav ? 0 : undefined}
              onClick={canNav ? () => onNavigate(nodeId, ids) : undefined}
              onKeyDown={canNav ? e => { if (e.key === 'Enter' || e.key === ' ') onNavigate(nodeId, ids); } : undefined}
              onMouseEnter={() => canNav && setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              title={canNav ? 'Ouvrir dans la carte' : undefined}
              style={{
                ...LISTBOX_ITEM,
                alignItems: 'flex-start',
                cursor: canNav ? 'pointer' : 'default',
                background: hovered === c.id ? 'var(--accent-08)' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.nom}
                </div>
                {ctx && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ctx}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0, marginTop: 2,
                background: isGeo ? 'var(--accent-14)' : C.surface2,
                color: isGeo ? 'var(--accent)' : C.muted,
                border: `1px solid ${isGeo ? 'var(--accent-33)' : C.border}`,
              }}>
                {isGeo ? 'Géo' : 'Non-géo'}
              </span>
            </div>
          );
        })
      }
    </ListBoxShell>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function DataAccessPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  function goToCarte(nodeId: string, expanded: string[]) {
    navigate('/carte', { state: { nodeId, expanded } });
  }

  useEffect(() => {
    dashboardApi.getData()
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const role = user?.role ?? '';
  const nom  = user?.nom  ?? '';
  const acred = user?.niveau_accreditation ?? 0;

  const isAdminApp  = role === 'Admin_app';
  const isAdminData = role === 'Admin_data';

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-2xl)', fontWeight: 700, color: C.text }}>
          Tableau de bord
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: C.muted }}>
          {nom && <><strong style={{ color: C.text }}>{nom}</strong> · </>}
          {role && <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: 99,
            background: C.surface2, color: C.muted, fontSize: 11, fontWeight: 600, marginRight: 8,
          }}>{role}</span>}
          Accréditation&nbsp;
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-22)',
            color: 'var(--accent)', fontSize: 11, fontWeight: 700,
          }}>{acred}</span>
        </p>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 'var(--text-sm)' }}>
          <Spinner /> Chargement…
        </div>
      )}

      {error && !loading && (
        <div style={{
          background: 'var(--error-bg)', border: '1px solid var(--error-border)',
          borderRadius: 'var(--r-lg)', padding: '12px 16px',
          fontSize: 'var(--text-sm)', color: 'var(--danger)',
        }}>
          Impossible de charger les données du tableau de bord.
        </div>
      )}

      {!loading && !error && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* ── 1. Favoris + Mes calques côte à côte ── */}
          <section>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <FavoriListBox favoris={data.favoris} onNavigate={goToCarte} />
              <CalqueListBox calques={data.mesCalques} onNavigate={goToCarte} />
            </div>
          </section>

          {/* ── 2. Toutes les soumissions (admin_app) ── */}
          {isAdminApp && (
            <section>
              <SectionHeader label="Toutes les soumissions" />
              <PVTable rows={data.soumis} showProposedBy showValidateur />
            </section>
          )}

          {/* ── 3. À valider (admin_data) ── */}
          {isAdminData && (
            <section>
              <SectionHeader label="À valider" />
              <PVTable rows={data.aValider} showProposedBy />
            </section>
          )}

          {/* ── 4. Mes demandes ── */}
          <section>
            <SectionHeader label="Mes demandes de validation" />
            <PVTable rows={data.mesDemandes} showValidateur />
          </section>


        </div>
      )}
    </div>
  );
}
