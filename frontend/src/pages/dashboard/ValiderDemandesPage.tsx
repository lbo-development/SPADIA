import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import { db, type PourValidation } from '@/api/database';
import { Spinner } from '@/components/ui';
import { C } from '@/constants/colors';
import { TraiterModal } from './valider/TraiterModal';
import { TraiterCalqueModal } from './valider/TraiterCalqueModal';
import { TraiterPlanModal } from './valider/TraiterPlanModal';
import { VoirEntityModal } from './valider/VoirEntityModal';
import { TYPE_META, Pill, RattachBadge, EntityIcon, payloadNom } from './valider/shared';
import { type Statut } from '@/types';

// ── Types page ────────────────────────────────────────────────────────────────

type Tab     = Statut;
type SortCol = 'type' | 'validateur' | 'rattachement' | 'date';

function sortPV(list: PourValidation[], col: SortCol, dir: 'asc' | 'desc'): PourValidation[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (col) {
      case 'type':         return sign * a.entity_type.localeCompare(b.entity_type);
      case 'validateur':   return sign * a.validateur_nom.localeCompare(b.validateur_nom, 'fr');
      case 'rattachement': return sign * (Number(a.avec_rattachement) - Number(b.avec_rattachement));
      case 'date':         return sign * (new Date(a.date_propose).getTime() - new Date(b.date_propose).getTime());
    }
  });
}

// ── Composants page ───────────────────────────────────────────────────────────

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        {message}
      </td>
    </tr>
  );
}

function SortableTh({ col, label, sort, onSort, thStyle }: {
  col: SortCol;
  label: string;
  sort: { col: SortCol; dir: 'asc' | 'desc' } | null;
  onSort: (col: SortCol) => void;
  thStyle: React.CSSProperties;
}) {
  const active = sort?.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', color: active ? C.accent : C.muted }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {label}
        <span style={{ fontSize: 10, color: active ? C.accent : C.muted, lineHeight: 1, opacity: active ? 1 : 0.6 }}>
          {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );
}

function TabBtn({ value, count, active, onClick }: { value: Tab; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
        background: active ? C.accent18 : 'transparent',
        border: `1px solid ${active ? C.accent44 : C.border}`,
        color: active ? C.accent : C.muted,
        fontWeight: active ? 600 : 400,
      }}
    >
      {value}
      {count > 0 && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: active ? C.accent : C.border,
          color: active ? '#fff' : C.muted, fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function CommentPopup({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '20px 22px', maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Commentaire</span>
          <button type="button" onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: C.warning, fontStyle: 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</p>
      </div>
    </div>
  );
}

function PvRow({ pv, odd, readOnly, onTraiter }: { pv: PourValidation; odd: boolean; readOnly?: boolean; onTraiter: () => void }) {
  const [hover,       setHover]       = useState(false);
  const [showComment, setShowComment] = useState(false);
  const typeMeta = TYPE_META[pv.entity_type];

  const td: React.CSSProperties = {
    padding: '12px 14px', fontSize: 13, color: C.text,
    borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle',
  };

  const rowBg = hover ? C.accent08 : odd ? C.surface280 : 'transparent';

  return (
    <tr
      style={{ background: rowBg, transition: 'background .1s' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={{ ...td, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: typeMeta.color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EntityIcon type={pv.entity_type} size={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              title={(pv.payload as { description?: string })?.description || 'Aucune description'}
              style={{ fontWeight: 600, color: C.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >{payloadNom(pv)}</div>
            {pv.proposedby_nom && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>par {pv.proposedby_nom}</div>
            )}
            {pv.commentaire_admin && (
              <div
                onClick={e => { e.stopPropagation(); setShowComment(true); }}
                style={{ fontSize: 11, color: C.warning, marginTop: 3, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  cursor: 'pointer', textDecoration: 'underline dotted' }}
              >
                {pv.commentaire_admin}
              </div>
            )}
            {showComment && pv.commentaire_admin && (
              <CommentPopup text={pv.commentaire_admin} onClose={() => setShowComment(false)} />
            )}
          </div>
        </div>
      </td>

      <td style={{ ...td, overflow: 'hidden' }}>
        <Pill label={typeMeta.label} color={typeMeta.color} />
      </td>

      <td style={{ ...td, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pv.validateur_nom || '—'}
      </td>

      <td style={{ ...td, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RattachBadge value={pv.avec_rattachement} />
          {pv.avec_rattachement && pv.site_nom && (
            <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[pv.site_nom, pv.installation_nom, pv.dossier_nom || pv.plan_nom].filter(Boolean).join(' › ')}
            </span>
          )}
        </div>
      </td>

      <td style={{ ...td, color: C.muted, whiteSpace: 'nowrap' }}>
        {new Date(pv.date_propose).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </td>

      <td style={{ ...td, textAlign: 'right', overflow: 'hidden' }}>
        <button
          onClick={onTraiter}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            background: (pv.statut === 'Validé' || readOnly) ? C.success18 : C.accent18,
            border: `1px solid ${(pv.statut === 'Validé' || readOnly) ? C.success44 : C.accent44}`,
            color: (pv.statut === 'Validé' || readOnly) ? C.success : C.accent,
            transition: 'background .15s',
          }}
        >
          {pv.statut === 'Validé' || readOnly ? 'Voir' : 'Traiter'}
        </button>
      </td>
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ValiderDemandesPage() {
  const { user } = useAuth();
  const [items,    setItems]    = useState<PourValidation[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>('En attente');
  const [selected, setSelected] = useState<PourValidation | null>(null);
  const [sort,     setSort]     = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null);

  function toggleSort(col: SortCol) {
    setSort(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' },
    );
  }

  const isAdminApp = user?.role === ROLES.ADMIN_APP;

  useEffect(() => {
    setLoading(true);
    db.listPourValidation()
      .then(({ data }) => {
        const filtered = isAdminApp
          ? data
          : data.filter(pv => pv.validateur_id === user?.id);
        setItems(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdminApp, user?.id]);

  function handleUpdated(updated: PourValidation) {
    setItems(prev => prev.map(pv => pv.id === updated.id ? updated : pv));
  }

  const pending    = items.filter(pv => pv.statut === 'En attente');
  const toComplete = items.filter(pv => pv.statut === 'A compléter');
  const validated  = items.filter(pv => pv.statut === 'Validé');
  const rejected   = items.filter(pv => pv.statut === 'Rejeté');

  const base      = { 'En attente': pending, 'A compléter': toComplete, 'Validé': validated, 'Rejeté': rejected }[tab];
  const displayed = sort ? sortPV(base, sort.col, sort.dir) : base;

  const th: React.CSSProperties = {
    padding: '10px 14px', background: '#1C2333', color: C.muted, fontWeight: 600,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: C.bg, minHeight: '100%' }}>

      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: C.bg,
        padding: '28px 40px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: C.text }}>
            Valider les demandes
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {isAdminApp
              ? 'Toutes les demandes en attente de traitement.'
              : 'Demandes pour lesquelles vous êtes le validateur désigné.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabBtn value="En attente"  count={pending.length}    active={tab === 'En attente'}  onClick={() => setTab('En attente')} />
          <TabBtn value="A compléter" count={toComplete.length} active={tab === 'A compléter'} onClick={() => setTab('A compléter')} />
          <TabBtn value="Validé"      count={validated.length}  active={tab === 'Validé'}      onClick={() => setTab('Validé')} />
          <TabBtn value="Rejeté"      count={rejected.length}   active={tab === 'Rejeté'}      onClick={() => setTab('Rejeté')} />
        </div>
      </div>

      <div style={{ padding: '24px 40px 32px' }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Spinner size={26} />
              <span style={{ fontSize: 12, color: C.muted }}>Chargement…</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: C.surface2 }}>
                  <th style={{ ...th, width: 220 }}>Nom de la demande</th>
                  <SortableTh col="type"         label="Type"         sort={sort} onSort={toggleSort} thStyle={{ ...th, width: 120 }} />
                  <SortableTh col="validateur"   label="Validateur"   sort={sort} onSort={toggleSort} thStyle={{ ...th, width: 150 }} />
                  <SortableTh col="rattachement" label="Rattachement" sort={sort} onSort={toggleSort} thStyle={th} />
                  <SortableTh col="date"         label="Date"         sort={sort} onSort={toggleSort} thStyle={{ ...th, width: 100 }} />
                  <th style={{ ...th, width: 88, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0
                  ? <EmptyRow message={{
                      'En attente':  'Aucune demande en attente de validation.',
                      'A compléter': 'Aucune demande à compléter.',
                      'Validé':      'Aucune demande validée.',
                      'Rejeté':      'Aucune demande rejetée.',
                    }[tab]} />
                  : displayed.map((pv, i) => (
                    <PvRow
                      key={pv.id}
                      pv={pv}
                      odd={i % 2 === 1}
                      readOnly={!isAdminApp}
                      onTraiter={() => setSelected(pv)}
                    />
                  ))
                }
              </tbody>
            </table>
          )}
        </div>

        {selected && (selected.statut === 'Validé' || !isAdminApp) ? (
          <VoirEntityModal pv={selected} onClose={() => setSelected(null)} />
        ) : selected && selected.entity_type === 'calque' ? (
          <TraiterCalqueModal
            pv={selected}
            onClose={() => setSelected(null)}
            onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
          />
        ) : selected && selected.entity_type === 'plan' ? (
          <TraiterPlanModal
            pv={selected}
            onClose={() => setSelected(null)}
            onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
          />
        ) : selected ? (
          <TraiterModal
            pv={selected}
            onClose={() => setSelected(null)}
            onUpdated={updated => { handleUpdated(updated); setSelected(null); }}
          />
        ) : null}
      </div>
    </div>
  );
}
