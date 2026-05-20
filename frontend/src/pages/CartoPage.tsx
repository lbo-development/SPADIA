import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/api/database';
import type { Plan, FichierPdf, Calque, Point, Photo } from '@/api/database';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const C = {
  bg:      '#0E1117',
  surface: '#161B27',
  border:  '#232B3E',
  accent:  '#378ADD',
  text:    '#E8EDF5',
  muted:   '#6B7A99',
  success: '#3DB07A',
};

const PALETTE = ['#0078D4','#107C10','#D83B01','#5C2D91','#038387','#CA5010','#00B294','#B4009E'];
function nameColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

type SiteRaw    = { id: string; nom: string; lat: number | null; lng: number | null; zoom_defaut: number };
type InstRaw    = { id: string; nom: string; site_id: string; lat: number | null; lng: number | null; zoom_defaut: number };
type DossierRaw = { id: string; nom: string; site_id: string | null; installation_id: string | null };

interface TreeNode {
  id:           string;
  label:        string;
  type:         'site' | 'installation' | 'plan' | 'dossier' | 'calque' | 'fichier' | 'group';
  children?:    TreeNode[];
  fichierUrl?:  string | null;
  isUploadable?: boolean;
  lat?:         number | null;
  lng?:         number | null;
  zoom?:        number;
  svgUrl?:      string | null;
  svgWidth?:    number | null;
  svgHeight?:   number | null;
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) { const f = findNode(node.children, id); if (f) return f; }
  }
  return null;
}

function findPath(nodes: TreeNode[], targetId: string, path: TreeNode[] = []): TreeNode[] | null {
  for (const node of nodes) {
    const current = [...path, node];
    if (node.id === targetId) return current;
    if (node.children) {
      const found = findPath(node.children, targetId, current);
      if (found) return found;
    }
  }
  return null;
}

function collectExpandableIds(nodes: TreeNode[], acc: Set<string> = new Set()): Set<string> {
  for (const n of nodes) {
    if (n.children && n.children.length > 0) {
      acc.add(n.id);
      collectExpandableIds(n.children, acc);
    }
  }
  return acc;
}

function makeDossierNode(d: DossierRaw, fichiersByDossier: Record<string, FichierPdf[]>): TreeNode {
  const fichiers = fichiersByDossier[d.id] ?? [];
  return {
    id: d.id, label: d.nom, type: 'dossier',
    children: fichiers.length > 0
      ? fichiers.map(f => ({ id: f.id, label: f.nom, type: 'fichier' as const, fichierUrl: f.storage_public_url, isUploadable: f.is_uploadable }))
      : undefined,
  };
}

function buildTree(
  sites:             SiteRaw[],
  insts:             InstRaw[],
  dossiers:          DossierRaw[],
  plans:             Plan[],
  fichiersByDossier: Record<string, FichierPdf[]>,
): TreeNode[] {
  return sites.map(site => {
    const siteDossiers = dossiers.filter(d => d.site_id === site.id && !d.installation_id);
    const siteInsts    = insts.filter(i => i.site_id === site.id);
    const children: TreeNode[] = [];

    if (siteDossiers.length > 0) {
      children.push({
        id: `grp-docs-${site.id}`, label: 'Documents', type: 'group',
        children: siteDossiers.map(d => makeDossierNode(d, fichiersByDossier)),
      });
    }

    if (siteInsts.length > 0) {
      children.push({
        id: `grp-inst-${site.id}`, label: 'Installations', type: 'group',
        children: siteInsts.map(inst => {
          const instDossiers = dossiers.filter(d => d.installation_id === inst.id);
          const instPlans    = plans.filter(p => p.installation_id === inst.id);
          const instChildren: TreeNode[] = [];

          if (instDossiers.length > 0) {
            instChildren.push({
              id: `grp-docs-${inst.id}`, label: 'Documents', type: 'group',
              children: instDossiers.map(d => makeDossierNode(d, fichiersByDossier)),
            });
          }

          if (instPlans.length > 0) {
            instChildren.push({
              id: `grp-plans-${inst.id}`, label: 'Plans', type: 'group',
              children: instPlans.map(plan => ({
                id: plan.id, label: plan.nom, type: 'plan' as const,
                svgUrl: plan.svg_public_url, svgWidth: plan.largeur_px, svgHeight: plan.hauteur_px,
              })),
            });
          }

          return { id: inst.id, label: inst.nom, type: 'installation' as const, children: instChildren, lat: inst.lat, lng: inst.lng, zoom: inst.zoom_defaut };
        }),
      });
    }

    return { id: site.id, label: site.nom, type: 'site' as const, children, lat: site.lat, lng: site.lng, zoom: site.zoom_defaut };
  });
}

const ICON_COLOR: Record<string, string> = {
  site:         '#378ADD',
  installation: '#B4A9D5',
  plan:         '#7EC8E3',
  dossier:      '#E8A87C',
  calque:       '#8FBCDA',
  fichier:      '#E07A7A',
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease', flexShrink: 0 }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </span>
  );
}

function NodeIcon({ type }: { type: TreeNode['type'] }) {
  const color = ICON_COLOR[type] ?? C.muted;
  const p = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'site':         return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'installation': return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
    case 'plan':         return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case 'dossier':      return <svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case 'calque':       return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case 'fichier':      return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>;
    default:             return null;
  }
}

function TreeItem({ node, depth, expanded, selected, onToggle, onSelect, onDoubleClick }: {
  node:          TreeNode;
  depth:         number;
  expanded:      Set<string>;
  selected:      string | null;
  onToggle:      (id: string) => void;
  onSelect:      (id: string) => void;
  onDoubleClick?: (node: TreeNode) => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isOpen      = expanded.has(node.id);
  const isSelected  = selected === node.id;
  const lastTapRef  = useRef<number>(0);

  function handleTouchEnd() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleClick?.(node);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  /* ── Group header (Documents / Installations / Plans) ── */
  if (node.type === 'group') {
    return (
      <>
        <div
          onClick={() => hasChildren && onToggle(node.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: `7px 10px 3px ${12 + depth * 16}px`, cursor: hasChildren ? 'pointer' : 'default', userSelect: 'none' }}
        >
          <span style={{ color: C.muted, opacity: hasChildren ? 0.5 : 0 }}>
            <Chevron open={isOpen} />
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {node.label}
          </span>
          {hasChildren && (
            <span style={{ fontSize: 9, color: C.muted, background: C.border, borderRadius: 8, padding: '1px 5px' }}>
              {node.children!.length}
            </span>
          )}
        </div>
        {isOpen && node.children?.map(child => (
          <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect} onDoubleClick={onDoubleClick} />
        ))}
      </>
    );
  }

  /* ── Regular node ── */
  const isSite     = node.type === 'site';
  const labelColor = isSite ? C.text : node.type === 'plan' ? '#A8D4F5' : C.muted;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => { onSelect(node.id); if (hasChildren) onToggle(node.id); }}
        onDoubleClick={() => onDoubleClick?.(node)}
        onTouchEnd={handleTouchEnd}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onSelect(node.id); if (hasChildren) onToggle(node.id); } }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#ffffff09'; }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        6,
          margin:     '1px 6px',
          padding:    `5px 8px 5px ${8 + depth * 16}px`,
          borderRadius: 6,
          cursor:     'pointer',
          userSelect: 'none',
          background: isSelected ? '#378ADD22' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        <span style={{ color: C.muted, opacity: hasChildren ? 0.6 : 0, flexShrink: 0 }}>
          <Chevron open={isOpen} />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <NodeIcon type={node.type} />
        </span>
        <span style={{ fontSize: 12, color: isSelected ? C.text : labelColor, fontWeight: isSite ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </span>
      </div>
      {isOpen && node.children?.map(child => (
        <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect} onDoubleClick={onDoubleClick} />
      ))}
    </>
  );
}

function PointPanelToggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? 'Afficher le détail' : 'Réduire le détail'}
      style={{ width: 12, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', background: 'transparent' }}
    >
      <div style={{
        width: 12, height: 44, borderRadius: '6px 0 0 6px',
        background: hovered ? C.accent : C.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.18s',
        boxShadow: hovered ? `-2px 0 8px ${C.accent}44` : 'none',
      }}>
        <svg width="6" height="12" viewBox="0 0 6 12" fill="none" stroke={hovered ? '#fff' : C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.18s' }}>
          {collapsed ? <polyline points="5 1 1 6 5 11"/> : <polyline points="1 1 5 6 1 11"/>}
        </svg>
      </div>
    </div>
  );
}

function SidebarToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={open ? 'Réduire la sidebar' : 'Afficher la sidebar'}
      style={{ width: 12, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', userSelect: 'none' }}
    >
      <div style={{
        width: 12, height: 44, borderRadius: '0 6px 6px 0',
        background: hovered ? C.accent : C.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.18s, width 0.18s',
        boxShadow: hovered ? `2px 0 8px ${C.accent}44` : 'none',
      }}>
        <svg width="6" height="12" viewBox="0 0 6 12" fill="none" stroke={hovered ? '#fff' : C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.18s' }}>
          {open ? <polyline points="5 1 1 6 5 11"/> : <polyline points="1 1 5 6 1 11"/>}
        </svg>
      </div>
    </div>
  );
}

export default function CartoPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const tileLayerRef    = useRef<L.TileLayer | null>(null);

  const [tree,     setTree]     = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [counts,   setCounts]   = useState({ sites: 0, installations: 0, plans: 0, calques: 0 });
  const [loading,  setLoading]  = useState(true);
  const [basemap,     setBasemap]     = useState<'plan' | 'satellite'>('plan');
  const [zoom,        setZoom]        = useState(6);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [pdfViewer,   setPdfViewer]   = useState<{ url: string; nom: string; isUploadable: boolean } | null>(null);
  const [planViewer,  setPlanViewer]  = useState<{ url: string; nom: string; width: number | null; height: number | null; planId: string } | null>(null);
  const planMapRef           = useRef<L.Map | null>(null);
  const planMapContainerRef  = useRef<HTMLDivElement>(null);
  const planMarkersRef       = useRef<L.Marker[]>([]);
  const planPendingMarkerRef = useRef<L.CircleMarker | null>(null);
  const planAddModeRef       = useRef(false);
  const planSelCalqueIdRef   = useRef<string | null>(null);
  const planMoveModeRef      = useRef(false);

  const [planCalques,     setPlanCalques]     = useState<Calque[]>([]);
  const [planPointsMap,   setPlanPointsMap]   = useState<Record<string, Point[]>>({});
  const [planSelCalqueId, setPlanSelCalqueId] = useState<string | null>(null);
  const [planAddMode,     setPlanAddMode]     = useState(false);
  const [planPendingPos,  setPlanPendingPos]  = useState<{ x: number; y: number } | null>(null);
  const [planPendingNom,  setPlanPendingNom]  = useState('');
  const [planSaving,      setPlanSaving]      = useState(false);
  const [planSelectedPoint, setPlanSelectedPoint] = useState<Point | null>(null);
  const [planMoveMode,       setPlanMoveMode]       = useState(false);
  const [planPanelCollapsed, setPlanPanelCollapsed] = useState(false);
  const [planEditMode,       setPlanEditMode]       = useState(false);
  const [planEditNom,        setPlanEditNom]        = useState('');
  const [planEditValues,     setPlanEditValues]     = useState<Record<string, string>>({});
  const [planEditSaving,     setPlanEditSaving]     = useState(false);
  const [planDeleteConfirm,  setPlanDeleteConfirm]  = useState(false);
  const [pointPhotos,        setPointPhotos]        = useState<Photo[]>([]);
  const [photosLoading,      setPhotosLoading]      = useState(false);
  const [carouselIndex,      setCarouselIndex]      = useState(0);
  const [photoDragOver,      setPhotoDragOver]      = useState(false);
  const [photoUploading,     setPhotoUploading]     = useState(false);
  const [photoModalIndex,    setPhotoModalIndex]    = useState<number | null>(null);
  const [photoDeleteConfirm, setPhotoDeleteConfirm] = useState(false);
  const [dragFromPhotoIdx,   setDragFromPhotoIdx]   = useState<number | null>(null);
  const [dragOverPhotoIdx,   setDragOverPhotoIdx]   = useState<number | null>(null);
  const [pointPdfs,          setPointPdfs]          = useState<Photo[]>([]);
  const [pdfDragOver,        setPdfDragOver]        = useState(false);
  const [pdfUploading,       setPdfUploading]       = useState(false);
  const [renamingId,         setRenamingId]         = useState<string | null>(null);
  const [renameValue,        setRenameValue]        = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);

  const [calquesOpen,    setCalquesOpen]    = useState(false);
  const [calquesLoading, setCalquesLoading] = useState(false);
  const [calquesList,    setCalquesList]    = useState<Calque[]>([]);
  const [calquesVisible, setCalquesVisible] = useState<Record<string, boolean>>({});
  const [calquesActif,   setCalquesActif]   = useState<string | null>(null);

  async function openCalquesModal() {
    const node = selected ? findNode(tree, selected) : null;
    if (!node || (node.type !== 'site' && node.type !== 'plan')) return;
    setCalquesOpen(true);
    setCalquesLoading(true);
    setCalquesList([]);
    setCalquesActif(null);
    try {
      const res = node.type === 'site'
        ? await db.listCalquesGeo(node.id)
        : await db.listCalques(node.id);
      setCalquesList(res.data);
      const vis: Record<string, boolean> = {};
      for (const c of res.data) vis[c.id] = true;
      setCalquesVisible(vis);
    } finally {
      setCalquesLoading(false);
    }
  }

  function handleNodeDoubleClick(node: TreeNode) {
    if (node.type === 'site' || node.type === 'installation') {
      if (planViewer) {
        setPlanViewer(null);
        setPlanAddMode(false);
        setPlanPendingPos(null);
      }
      if (node.lat != null && node.lng != null && mapRef.current) {
        mapRef.current.flyTo([node.lat, node.lng], node.zoom ?? 13);
      }
      return;
    }
    if (node.type === 'plan') {
      if (node.svgUrl) {
        setPlanViewer({ url: node.svgUrl, nom: node.label, width: node.svgWidth ?? null, height: node.svgHeight ?? null, planId: node.id });
        setPlanAddMode(false); setPlanPendingPos(null); setPlanPendingNom(''); setPlanSelectedPoint(null);
        setPlanMoveMode(false);
      }
      return;
    }
    if (node.type !== 'fichier' || !node.fichierUrl) return;
    setPdfViewer({ url: node.fichierUrl, nom: node.label, isUploadable: node.isUploadable ?? false });
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function toggleNode(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, i, d, p] = await Promise.all([
          db.list('sites'),
          db.list('installations'),
          db.list('dossiers'),
          db.list('plans'),
        ]);
        if (cancelled) return;
        const sites    = s.data as SiteRaw[];
        const insts    = i.data as InstRaw[];
        const dossiers = d.data as DossierRaw[];
        const plans    = p.data as Plan[];

        const fichierResults = await Promise.all(
          dossiers.map(dos =>
            db.listFichiersPdf(dos.id)
              .then(r => ({ id: dos.id, fichiers: r.data }))
              .catch(() => ({ id: dos.id, fichiers: [] as FichierPdf[] }))
          )
        );
        if (cancelled) return;
        const fichiersByDossier: Record<string, FichierPdf[]> = {};
        for (const { id, fichiers } of fichierResults) fichiersByDossier[id] = fichiers;

        setTree(buildTree(sites, insts, dossiers, plans, fichiersByDossier));
        setCounts({ sites: sites.length, installations: insts.length, plans: plans.length, calques: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const TILES = {
    plan: {
      url:            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxNativeZoom:  19,
      maxZoom:        22,
    },
    satellite: {
      url:            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:    'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
      maxNativeZoom:  18,
      maxZoom:        22,
    },
  };

  function switchBasemap(next: 'plan' | 'satellite') {
    if (!mapRef.current) return;
    tileLayerRef.current?.remove();
    const cfg = TILES[next];
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxNativeZoom: cfg.maxNativeZoom, maxZoom: cfg.maxZoom })
      .addTo(mapRef.current);
    setBasemap(next);
  }

  // ── Sync refs (évite les closures périmées dans les handlers Leaflet) ──────
  useEffect(() => {
    planAddModeRef.current = planAddMode;
    const container = planMapRef.current?.getContainer();
    if (container) container.style.cursor = planAddMode ? 'crosshair' : (planMoveModeRef.current ? 'move' : '');
  }, [planAddMode]);

  useEffect(() => { planSelCalqueIdRef.current = planSelCalqueId; }, [planSelCalqueId]);

  useEffect(() => { planMoveModeRef.current = planMoveMode; }, [planMoveMode]);

  useEffect(() => {
    setPlanEditMode(false);
    setPlanDeleteConfirm(false);
    setPhotoDeleteConfirm(false);
    setRenamingId(null);
    setPointPhotos([]);
    setPointPdfs([]);
    setCarouselIndex(0);
    if (!planSelectedPoint) return;
    setPhotosLoading(true);
    db.listPhotos(planSelectedPoint.id)
      .then(r => {
        setPointPhotos(r.data.filter(p => p.file_type === 'image'));
        setPointPdfs(r.data.filter(p => p.file_type === 'pdf'));
      })
      .catch(() => {})
      .finally(() => setPhotosLoading(false));
  }, [planSelectedPoint]);

  // ── Carte Leaflet CRS.Simple (plan non-géographique) ──────────────────────
  useEffect(() => {
    if (!planViewer || !planMapContainerRef.current) return;
    const W = planViewer.width ?? 1000;
    const H = planViewer.height ?? 1000;
    const bounds: L.LatLngBoundsExpression = [[0, 0], [H, W]];

    const map = L.map(planMapContainerRef.current, {
      crs:              L.CRS.Simple,
      minZoom:          -5,
      maxZoom:          8,
      zoomControl:      false,
      attributionControl: false,
    });

    L.imageOverlay(planViewer.url, bounds).addTo(map);
    map.fitBounds(bounds, { padding: [20, 20] });

    map.on('zoomend', () => setZoom(Math.round(map.getZoom())));

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (planAddModeRef.current) {
        setPlanPendingPos({ x: e.latlng.lng, y: e.latlng.lat });
        setPlanPendingNom('');
        return;
      }
      if (!planMoveModeRef.current) setPlanSelectedPoint(null);
    });

    planMapRef.current = map;
    return () => {
      map.remove();
      planMapRef.current     = null;
      planMarkersRef.current = [];
      planPendingMarkerRef.current?.remove();
      planPendingMarkerRef.current = null;
      setZoom(Math.round(mapRef.current?.getZoom() ?? 6));
    };
  }, [planViewer?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Marqueurs des points existants ────────────────────────────────────────
  useEffect(() => {
    const map = planMapRef.current;
    if (!map) return;
    planMarkersRef.current.forEach(m => m.remove());
    planMarkersRef.current = [];
    for (const [calqueId, pts] of Object.entries(planPointsMap)) {
      if (calquesVisible[calqueId] === false) continue;
      const calque  = planCalques.find(c => c.id === calqueId);
      if (calque && calque.zoom_min !== null && zoom < calque.zoom_min) continue;
      if (calque && calque.zoom_max !== null && zoom > calque.zoom_max) continue;
      const color   = calque?.couleur ?? '#333';
      const iconUrl = calque?.icone_public_url;
      for (const p of pts) {
        const iconHtml = iconUrl
          ? `<div style="width:20px;height:20px;background-color:${color};-webkit-mask-image:url(${iconUrl});mask-image:url(${iconUrl});-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;"></div>`
          : `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`;
        const icon = L.divIcon({
          html: `<div style="pointer-events:none;">${iconHtml}</div>`,
          className: '',
          iconAnchor: [10, 10],
        });
        const marker = L.marker([p.coord_y_ou_lat, p.coord_x_ou_lon], { icon, draggable: planMoveMode });
        marker.on('click', () => {
          if (planAddModeRef.current || planMoveModeRef.current) return;
          setPlanSelectedPoint(p); setPlanPanelCollapsed(false);
        });
        if (planMoveMode) {
          marker.on('dragend', async () => {
            const pos = marker.getLatLng();
            const x = Math.round(pos.lng);
            const y = Math.round(pos.lat);
            try {
              const res = await db.updatePoint(p.id, { coord_x_ou_lon: x, coord_y_ou_lat: y });
              setPlanPointsMap(prev => ({
                ...prev,
                [calqueId]: (prev[calqueId] ?? []).map(pt => pt.id === p.id ? res.data : pt),
              }));
            } catch {
              marker.setLatLng([p.coord_y_ou_lat, p.coord_x_ou_lon]);
            }
          });
        }
        marker.addTo(map);
        planMarkersRef.current.push(marker);
      }
    }
  }, [planPointsMap, planCalques, planMoveMode, calquesVisible, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Marqueur du point en cours de placement ───────────────────────────────
  useEffect(() => {
    const map = planMapRef.current;
    planPendingMarkerRef.current?.remove();
    planPendingMarkerRef.current = null;
    if (!map || !planPendingPos) return;
    const color = planCalques.find(c => c.id === planSelCalqueId)?.couleur ?? C.accent;
    const m = L.circleMarker([planPendingPos.y, planPendingPos.x], { radius: 7, color: 'white', fillColor: color, fillOpacity: 0.75, weight: 2 });
    m.addTo(map);
    planPendingMarkerRef.current = m;
  }, [planPendingPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chargement calques + points du plan ───────────────────────────────────
  useEffect(() => {
    if (!planViewer) return;
    setPlanCalques([]); setPlanPointsMap({}); setPlanSelCalqueId(null); setPlanSelectedPoint(null);
    setPlanMoveMode(false);
    db.listCalques(planViewer.planId).then(async res => {
      const calques = res.data;
      setPlanCalques(calques);
      if (calques.length > 0) setPlanSelCalqueId(calques[0].id);
      const results = await Promise.all(
        calques.map(c => db.listPoints(c.id).then(r => ({ id: c.id, pts: r.data })).catch(() => ({ id: c.id, pts: [] as Point[] })))
      );
      const byCalque: Record<string, Point[]> = {};
      for (const { id, pts } of results) byCalque[id] = pts;
      setPlanPointsMap(byCalque);
    }).catch(() => {});
  }, [planViewer?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const EXCLUDED_PROPS = new Set(['marker-size', 'marker-color']);

  function resolveChampSource(champs: Record<string, unknown> | null): Record<string, unknown> {
    if (!champs) return {};
    return (champs.properties && typeof champs.properties === 'object' && champs.properties !== null)
      ? champs.properties as Record<string, unknown>
      : champs;
  }

  function enterEditMode() {
    if (!planSelectedPoint) return;
    const source = resolveChampSource(planSelectedPoint.champs);
    const vals: Record<string, string> = {};
    for (const [k, v] of Object.entries(source)) {
      if (!EXCLUDED_PROPS.has(k)) vals[k] = v === null || v === undefined ? '' : String(v);
    }
    setPlanEditNom(planSelectedPoint.nom);
    setPlanEditValues(vals);
    setPlanEditMode(true);
  }

  async function handleSaveEditPoint() {
    if (!planSelectedPoint || planEditSaving) return;
    setPlanEditSaving(true);
    const raw = planSelectedPoint.champs;
    const updatedChamps = raw ? JSON.parse(JSON.stringify(raw)) : {};
    const target = (raw?.properties && typeof raw.properties === 'object' && raw.properties !== null)
      ? (updatedChamps.properties as Record<string, unknown>)
      : updatedChamps;
    for (const [k, v] of Object.entries(planEditValues)) {
      target[k] = v.trim() === '' ? null : v.trim();
    }
    try {
      const res = await db.updatePoint(planSelectedPoint.id, {
        nom: planEditNom.trim() || planSelectedPoint.nom,
        champs: updatedChamps,
      });
      setPlanPointsMap(prev => ({
        ...prev,
        [planSelectedPoint.calque_id]: (prev[planSelectedPoint.calque_id] ?? []).map(p =>
          p.id === planSelectedPoint.id ? res.data : p
        ),
      }));
      setPlanSelectedPoint(res.data);
      setPlanEditMode(false);
    } finally {
      setPlanEditSaving(false);
    }
  }

  async function handleDeletePoint() {
    if (!planSelectedPoint) return;
    try {
      await db.removePoint(planSelectedPoint.id);
      setPlanPointsMap(prev => ({
        ...prev,
        [planSelectedPoint.calque_id]: (prev[planSelectedPoint.calque_id] ?? []).filter(p => p.id !== planSelectedPoint.id),
      }));
      setPlanSelectedPoint(null);
    } catch {}
  }

  async function handleDeletePhoto(photo: Photo) {
    try {
      await db.removePhoto(photo.id);
      if (photo.file_type === 'pdf') {
        setPointPdfs(prev => prev.filter(p => p.id !== photo.id));
      } else {
        setPointPhotos(prev => {
          const updated = prev.filter(p => p.id !== photo.id);
          setCarouselIndex(i => Math.min(i, Math.max(0, updated.length - 1)));
          return updated;
        });
        setPhotoDeleteConfirm(false);
      }
    } catch {}
  }

  async function saveRename(fichier: Photo) {
    const nom = renameValue.trim();
    setRenamingId(null);
    if (!nom || nom === fichier.nom) return;
    try {
      const res = await db.updatePhoto(fichier.id, { nom });
      if (fichier.file_type === 'pdf') {
        setPointPdfs(prev => prev.map(p => p.id === fichier.id ? res.data : p));
      } else {
        setPointPhotos(prev => prev.map(p => p.id === fichier.id ? res.data : p));
      }
    } catch {}
  }

  async function handlePdfFiles(files: FileList | File[]) {
    if (!planSelectedPoint || pdfUploading) return;
    const arr = Array.from(files).filter(f => f.type === 'application/pdf');
    if (arr.length === 0) return;
    setPdfUploading(true);
    try {
      for (const file of arr) {
        const res = await db.uploadFichierPoint(file, planSelectedPoint.id);
        setPointPdfs(prev => [...prev, res.data]);
        setRenamingId(res.data.id);
        setRenameValue(res.data.nom);
      }
    } finally {
      setPdfUploading(false);
    }
  }

  function reorderPhotos(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setPointPhotos(prev => {
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const updated = reordered.map((ph, i) => ({ ...ph, order: i }));
      for (const ph of updated) {
        db.updatePhoto(ph.id, { order: ph.order }).catch(() => {});
      }
      return updated;
    });
  }

  async function handlePhotoFiles(files: FileList | File[]) {
    if (!planSelectedPoint || photoUploading) return;
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setPhotoUploading(true);
    try {
      for (const file of arr) {
        const res = await db.uploadPhoto(file, planSelectedPoint.id);
        setPointPhotos(prev => [...prev, res.data]);
        setRenamingId(res.data.id);
        setRenameValue(res.data.nom);
      }
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSaveNewPoint() {
    if (!planPendingPos || !planSelCalqueId || !planPendingNom.trim() || planSaving) return;
    setPlanSaving(true);
    const calque = planCalques.find(c => c.id === planSelCalqueId);
    const champsInitiaux = calque?.template_champs
      ? JSON.parse(JSON.stringify(calque.template_champs))
      : null;
    try {
      const res = await db.createPoint({
        calque_id:      planSelCalqueId,
        nom:            planPendingNom.trim(),
        coord_x_ou_lon: Math.round(planPendingPos.x),
        coord_y_ou_lat: Math.round(planPendingPos.y),
        champs:         champsInitiaux,
      });
      setPlanPointsMap(prev => ({ ...prev, [planSelCalqueId]: [...(prev[planSelCalqueId] ?? []), res.data] }));
      setPlanPendingPos(null);
      setPlanPendingNom('');
    } finally {
      setPlanSaving(false);
    }
  }

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center:      [46.2276, 2.2137],
      zoom:        6,
      zoomControl: false,
      maxZoom:     22,
    });

    const cfg = TILES.plan;
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxNativeZoom: cfg.maxNativeZoom, maxZoom: cfg.maxZoom })
      .addTo(mapRef.current);

    mapRef.current.on('zoomend', () => setZoom(mapRef.current!.getZoom()));

    return () => {
      mapRef.current?.remove();
      mapRef.current     = null;
      tileLayerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: '"Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <nav style={{ height: 48, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', flexShrink: 0, zIndex: 100 }}>
        <img src="/logos-DBo.png" alt="Logo" style={{ height: 30, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '0.1em' }}>SPADIA</span>
        <span style={{ fontSize: 14, color: C.muted }}>/</span>
        <span style={{ fontSize: 13, color: C.muted }}>Cartographie</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('/database')} style={s.navBtn}>Base de données</button>
        <button onClick={() => navigate('/dashboard')} style={s.navBtn}>Tableau de bord</button>
        {user && (
          <div
            title={`${user.nom}\n${user.role}`}
            style={{ width: 28, height: 28, borderRadius: '50%', background: nameColor(user.nom), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'default' }}
          >
            {user.avatar_url && !avatarFailed
              ? <img src={user.avatar_url} alt="" onError={() => setAvatarFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', userSelect: 'none' }}>{initials(user.nom)}</span>
            }
          </div>
        )}
        <button style={s.navBtn} onClick={handleLogout}>Déconnexion</button>
      </nav>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{ width: sidebarOpen ? 240 : 0, background: C.surface, borderRight: sidebarOpen ? `1px solid ${C.border}` : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', transition: 'width 0.22s ease' }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
              Arborescence
            </span>
            <button
              title="Tout déplier"
              onClick={() => setExpanded(collectExpandableIds(tree))}
              style={s.treeCtrlBtn}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>
              </svg>
            </button>
            <button
              title="Tout replier"
              onClick={() => setExpanded(new Set())}
              style={s.treeCtrlBtn}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 11 12 6 17 11"/><polyline points="7 18 12 13 17 18"/>
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {loading && (
              <p style={{ padding: '14px 12px', fontSize: 12, color: C.muted, margin: 0 }}>Chargement…</p>
            )}
            {!loading && tree.length === 0 && (
              <p style={{ padding: '14px 12px', fontSize: 12, color: C.muted, margin: 0 }}>Aucun site disponible.</p>
            )}
            {tree.map(node => (
              <TreeItem key={node.id} node={node} depth={0} expanded={expanded} selected={selected} onToggle={toggleNode} onSelect={setSelected} onDoubleClick={handleNodeDoubleClick} />
            ))}
          </div>
        </aside>

        {/* TOGGLE STRIP */}
        <SidebarToggle open={sidebarOpen} onClick={() => setSidebarOpen(o => !o)} />

        {/* MAP */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* Plan SVG overlay — Leaflet CRS.Simple */}
          {planViewer && (
            <div style={{ position: 'absolute', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', zIndex: 500 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{planViewer.nom}</span>
                {planCalques.length > 0 && (
                  <select value={planSelCalqueId ?? ''} onChange={e => setPlanSelCalqueId(e.target.value)}
                    style={{ height: 26, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, padding: '0 6px', cursor: 'pointer', flexShrink: 0 }}>
                    {planCalques.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                )}
                <button
                  onClick={() => {
                    const next = !planAddMode;
                    setPlanAddMode(next); setPlanPendingPos(null);
                    if (next) { setPlanMoveMode(false); }
                  }}
                  title={planAddMode ? 'Annuler ajout' : 'Ajouter un point'}
                  disabled={!planSelCalqueId}
                  style={{ ...s.planZoomBtn, color: planAddMode ? C.accent : C.muted, borderColor: planAddMode ? C.accent : C.border }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                </button>
                <button
                  onClick={() => {
                    const next = !planMoveMode;
                    setPlanMoveMode(next);
                    if (next) { setPlanAddMode(false); setPlanPendingPos(null); }
                  }}
                  title={planMoveMode ? 'Annuler déplacement' : 'Déplacer un point'}
                  disabled={!planSelCalqueId}
                  style={{ ...s.planZoomBtn, color: planMoveMode ? C.accent : C.muted, borderColor: planMoveMode ? C.accent : C.border }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
                    <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
                    <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
                  </svg>
                </button>
                <button onClick={() => { if (planViewer.width && planViewer.height) planMapRef.current?.fitBounds([[0,0],[planViewer.height, planViewer.width]], { padding: [20,20] }); }} title="Ajuster" style={s.planZoomBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button onClick={() => { setPlanViewer(null); setPlanAddMode(false); setPlanMoveMode(false); setPlanPendingPos(null); setPlanSelectedPoint(null); }} title="Fermer" style={{ ...s.planZoomBtn, marginLeft: 4 }}>×</button>
              </div>

              {/* Formulaire nouveau point */}
              {planPendingPos && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>Nouveau point :</span>
                  <input autoFocus value={planPendingNom} onChange={e => setPlanPendingNom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNewPoint(); if (e.key === 'Escape') setPlanPendingPos(null); }}
                    placeholder="Nom du point…"
                    style={{ flex: 1, height: 26, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, padding: '0 8px', outline: 'none', minWidth: 0 }} />
                  <button onClick={handleSaveNewPoint} disabled={planSaving || !planPendingNom.trim()}
                    style={{ height: 26, padding: '0 10px', background: C.accent, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#fff', opacity: planSaving || !planPendingNom.trim() ? 0.5 : 1, flexShrink: 0 }}>
                    {planSaving ? '…' : 'Créer'}
                  </button>
                  <button onClick={() => setPlanPendingPos(null)} style={{ height: 26, width: 26, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 14, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>
              )}

              {/* Barre de statut — mode déplacement */}
              {planMoveMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
                    <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
                    <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
                  </svg>
                  <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>Faites glisser un point pour le repositionner</span>
                </div>
              )}

              {/* Conteneur Leaflet CRS.Simple + panel latéral */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', overflow: 'hidden' }}>
                <div ref={planMapContainerRef} style={{ flex: 1, height: '100%', minWidth: 0 }} />

                {/* Panel latéral point sélectionné */}
                {planSelectedPoint && (() => {
                  const source = resolveChampSource(planSelectedPoint.champs);
                  const entries = Object.entries(source).filter(([k]) => !EXCLUDED_PROPS.has(k));
                  const calqueNom = planCalques.find(c => c.id === planSelectedPoint.calque_id)?.nom;
                  return (
                    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
                      <PointPanelToggle collapsed={planPanelCollapsed} onClick={() => setPlanPanelCollapsed(c => !c)} />
                      <div style={{ width: planPanelCollapsed ? 0 : 300, background: C.surface, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.22s ease', flexShrink: 0 }}>

                        {/* ── Header ── */}
                        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                          {planEditMode ? (
                            <input
                              autoFocus
                              value={planEditNom}
                              onChange={e => setPlanEditNom(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveEditPoint(); if (e.key === 'Escape') setPlanEditMode(false); }}
                              style={{ width: '100%', background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 5, color: C.text, fontSize: 14, fontWeight: 700, padding: '5px 8px', outline: 'none', boxSizing: 'border-box' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3, wordBreak: 'break-word' }}>{planSelectedPoint.nom}</div>
                                {calqueNom && <div style={{ fontSize: 11, color: C.accent, marginTop: 3 }}>{calqueNom}</div>}
                              </div>
                              {/* Modifier */}
                              <button onClick={enterEditMode} title="Modifier" style={s.panelIconBtn}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              {/* Supprimer */}
                              {planDeleteConfirm ? (
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <button onClick={handleDeletePoint} title="Confirmer" style={{ ...s.panelIconBtn, color: '#E07A7A', borderColor: '#E07A7A40' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  </button>
                                  <button onClick={() => setPlanDeleteConfirm(false)} title="Annuler" style={s.panelIconBtn}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setPlanDeleteConfirm(true)} title="Supprimer" style={s.panelIconBtn}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              )}
                              {/* Fermer */}
                              <button onClick={() => setPlanSelectedPoint(null)} title="Fermer" style={{ ...s.panelIconBtn, marginLeft: 2 }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* ── Corps ── */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                          {planEditMode ? (
                            <>
                              {entries.length > 0 ? entries.map(([key]) => (
                                <div key={key} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}20` }}>
                                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{key}</div>
                                  <input
                                    value={planEditValues[key] ?? ''}
                                    onChange={e => setPlanEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    placeholder="—"
                                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, padding: '4px 8px', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                </div>
                              )) : null}

                              {/* Zone upload photos */}
                              <div style={{ padding: '12px 14px' }}>
                                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Photos</div>
                                <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) handlePhotoFiles(e.target.files); e.target.value = ''; }} />
                                <input ref={pdfInputRef} type="file" accept="application/pdf" multiple hidden onChange={e => { if (e.target.files) handlePdfFiles(e.target.files); e.target.value = ''; }} />
                                <div
                                  onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
                                  onDragLeave={() => setPhotoDragOver(false)}
                                  onDrop={e => { e.preventDefault(); setPhotoDragOver(false); handlePhotoFiles(e.dataTransfer.files); }}
                                  onClick={() => !photoUploading && photoInputRef.current?.click()}
                                  style={{ border: `2px dashed ${photoDragOver ? C.accent : C.border}`, borderRadius: 6, padding: '16px 12px', textAlign: 'center', cursor: photoUploading ? 'default' : 'pointer', background: photoDragOver ? '#378ADD0D' : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}
                                >
                                  {photoUploading ? (
                                    <span style={{ fontSize: 12, color: C.muted }}>Upload en cours…</span>
                                  ) : (
                                    <>
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={photoDragOver ? C.accent : C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                      </svg>
                                      <div style={{ fontSize: 12, color: photoDragOver ? C.accent : C.muted }}>Glissez des photos ici</div>
                                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ou cliquez pour sélectionner</div>
                                    </>
                                  )}
                                </div>
                                {/* Miniatures */}
                                {renamingId && pointPhotos.some(p => p.id === renamingId) && (
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 8 }}>
                                    <input
                                      autoFocus
                                      value={renameValue}
                                      onChange={e => setRenameValue(e.target.value)}
                                      onBlur={() => { const ph = pointPhotos.find(p => p.id === renamingId); if (ph) saveRename(ph); else setRenamingId(null); }}
                                      onKeyDown={e => { if (e.key === 'Enter') { const ph = pointPhotos.find(p => p.id === renamingId); if (ph) saveRename(ph); } if (e.key === 'Escape') setRenamingId(null); }}
                                      placeholder="Nom de la photo…"
                                      style={{ flex: 1, height: 26, background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 4, color: C.text, fontSize: 11, padding: '0 8px', outline: 'none', minWidth: 0 }}
                                    />
                                    <button onClick={() => setRenamingId(null)} style={{ width: 26, height: 26, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', color: C.muted, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                                  </div>
                                )}
                                {pointPhotos.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {pointPhotos.map((ph, i) => (
                                      <div key={ph.id}
                                        draggable
                                        onDragStart={() => setDragFromPhotoIdx(i)}
                                        onDragOver={e => { e.preventDefault(); setDragOverPhotoIdx(i); }}
                                        onDragLeave={() => setDragOverPhotoIdx(null)}
                                        onDrop={e => { e.preventDefault(); setDragOverPhotoIdx(null); if (dragFromPhotoIdx !== null) reorderPhotos(dragFromPhotoIdx, i); setDragFromPhotoIdx(null); }}
                                        onDragEnd={() => { setDragFromPhotoIdx(null); setDragOverPhotoIdx(null); }}
                                        title={ph.nom}
                                        style={{ position: 'relative', width: 52, height: 52, borderRadius: 4, overflow: 'hidden', cursor: 'grab', border: `2px solid ${dragOverPhotoIdx === i ? C.accent : C.border}`, flexShrink: 0, opacity: dragFromPhotoIdx === i ? 0.4 : 1, transition: 'border-color 0.12s, opacity 0.12s' }}>
                                        {ph.public_url
                                          ? <img src={ph.public_url} alt={ph.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }} />
                                          : <div style={{ width: '100%', height: '100%', background: C.bg }} />
                                        }
                                        <button
                                          onClick={e => { e.stopPropagation(); setRenamingId(ph.id); setRenameValue(ph.nom); }}
                                          title="Renommer"
                                          style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 3, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); handleDeletePhoto(ph); }}
                                          title="Supprimer"
                                          style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 3, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: 12, lineHeight: 1 }}>
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              {entries.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <tbody>
                                    {entries.map(([key, val]) => (
                                      <tr key={key}>
                                        <td style={{ padding: '9px 14px', color: C.muted, borderBottom: `1px solid ${C.border}20`, width: '44%', fontWeight: 500, verticalAlign: 'top', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{key}</td>
                                        <td style={{ padding: '9px 14px', color: C.text, borderBottom: `1px solid ${C.border}20`, wordBreak: 'break-word' }}>
                                          {val === null || val === undefined ? <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span> : String(val)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p style={{ padding: '14px', fontSize: 12, color: C.muted, margin: 0, fontStyle: 'italic' }}>Aucune propriété.</p>
                              )}

                              {/* ── Fichiers PDF ── */}
                              {pointPdfs.length > 0 && (
                                <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Fichiers PDF</div>
                                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                                    {pointPdfs.map((pdf, i) => (
                                      <div key={pdf.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < pointPdfs.length - 1 ? `1px solid ${C.border}20` : 'none', background: 'transparent' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                        </svg>
                                        <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.nom}</span>
                                        {pdf.public_url && (
                                          <button onClick={e => { e.stopPropagation(); setPdfViewer({ url: pdf.public_url!, nom: pdf.nom, isUploadable: false }); }} title="Ouvrir"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, color: C.accent, flexShrink: 0, background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'background 0.12s', padding: 0 }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#378ADD22')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                          >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ── Carousel photos ── */}
                              {(photosLoading || pointPhotos.length > 0) && (
                                <div style={{ borderTop: `1px solid ${C.border}` }}>
                                  {photosLoading ? (
                                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ fontSize: 11, color: C.muted }}>Chargement…</span>
                                    </div>
                                  ) : (() => {
                                    const photo = pointPhotos[carouselIndex];
                                    return (
                                      <div style={{ position: 'relative' }}>
                                        <div onClick={() => photo.public_url && setPhotoModalIndex(carouselIndex)}
                                          style={{ height: 180, background: '#0a0e17', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: photo.public_url ? 'zoom-in' : 'default' }}>
                                          {photo.public_url
                                            ? <img src={photo.public_url} alt={photo.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <span style={{ fontSize: 11, color: C.muted }}>Image indisponible</span>}
                                        </div>
                                        {pointPhotos.length > 1 && (
                                          <>
                                            <button onClick={() => { setCarouselIndex(i => (i - 1 + pointPhotos.length) % pointPhotos.length); setPhotoDeleteConfirm(false); }}
                                              style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            </button>
                                            <button onClick={() => { setCarouselIndex(i => (i + 1) % pointPhotos.length); setPhotoDeleteConfirm(false); }}
                                              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                            </button>
                                          </>
                                        )}
                                        <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.45)', position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ flex: 1, fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.nom}</span>
                                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>{carouselIndex + 1}/{pointPhotos.length}</span>
                                          {photoDeleteConfirm ? (
                                            <>
                                              <button onClick={() => handleDeletePhoto(photo)} title="Confirmer suppression"
                                                style={{ width: 20, height: 20, background: 'rgba(224,122,122,0.9)', border: 'none', borderRadius: 3, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                              </button>
                                              <button onClick={() => setPhotoDeleteConfirm(false)} title="Annuler"
                                                style={{ width: 20, height: 20, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 3, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                              </button>
                                            </>
                                          ) : (
                                            <button onClick={() => setPhotoDeleteConfirm(true)} title="Supprimer cette photo"
                                              style={{ width: 20, height: 20, background: 'transparent', border: 'none', borderRadius: 3, cursor: 'pointer', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                        {pointPhotos.length > 1 && (
                                          <div style={{ position: 'absolute', top: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                                            {pointPhotos.map((_, i) => (
                                              <div key={i} onClick={() => setCarouselIndex(i)} style={{ width: i === carouselIndex ? 14 : 6, height: 6, borderRadius: 3, background: i === carouselIndex ? C.accent : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'width 0.2s, background 0.2s' }} />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* ── Section PDF (mode édition) ── */}
                        {planEditMode && (
                          <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Fichiers PDF</div>
                            <div
                              onDragOver={e => { e.preventDefault(); setPdfDragOver(true); }}
                              onDragLeave={() => setPdfDragOver(false)}
                              onDrop={e => { e.preventDefault(); setPdfDragOver(false); handlePdfFiles(e.dataTransfer.files); }}
                              onClick={() => !pdfUploading && pdfInputRef.current?.click()}
                              style={{ border: `2px dashed ${pdfDragOver ? C.accent : C.border}`, borderRadius: 6, padding: '12px', textAlign: 'center', cursor: pdfUploading ? 'default' : 'pointer', background: pdfDragOver ? '#378ADD0D' : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}
                            >
                              {pdfUploading ? (
                                <span style={{ fontSize: 12, color: C.muted }}>Upload en cours…</span>
                              ) : (
                                <>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={pdfDragOver ? C.accent : C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 4 }}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                                  </svg>
                                  <div style={{ fontSize: 11, color: pdfDragOver ? C.accent : C.muted }}>Glissez des PDF ici</div>
                                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>ou cliquez pour sélectionner</div>
                                </>
                              )}
                            </div>

                            {/* Combobox PDF */}
                            {pointPdfs.length > 0 && (
                              <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', maxHeight: 130, overflowY: 'auto' }}>
                                {pointPdfs.map((pdf, i) => (
                                  <div key={pdf.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: i < pointPdfs.length - 1 ? `1px solid ${C.border}20` : 'none', background: 'transparent' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                    {renamingId === pdf.id ? (
                                      <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onBlur={() => saveRename(pdf)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveRename(pdf); if (e.key === 'Escape') setRenamingId(null); }}
                                        style={{ flex: 1, background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 3, color: C.text, fontSize: 11, padding: '2px 6px', outline: 'none', minWidth: 0, height: 22 }}
                                      />
                                    ) : (
                                      <span
                                        onClick={() => { setRenamingId(pdf.id); setRenameValue(pdf.nom); }}
                                        title="Cliquer pour renommer"
                                        style={{ flex: 1, fontSize: 11, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}>
                                        {pdf.nom}
                                      </span>
                                    )}
                                    {pdf.public_url && renamingId !== pdf.id && (
                                      <button onClick={e => { e.stopPropagation(); setPdfViewer({ url: pdf.public_url!, nom: pdf.nom, isUploadable: false }); }} title="Ouvrir"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, color: C.accent, flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                        </svg>
                                      </button>
                                    )}
                                    <button onClick={() => handleDeletePhoto(pdf)} title="Supprimer"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, flexShrink: 0, padding: 0, fontSize: 14, lineHeight: 1 }}>
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Footer édition ── */}
                        {planEditMode && (
                          <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button onClick={handleSaveEditPoint} disabled={planEditSaving}
                              style={{ flex: 1, height: 30, background: C.accent, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: '#fff', opacity: planEditSaving ? 0.6 : 1 }}>
                              {planEditSaving ? '…' : 'Enregistrer'}
                            </button>
                            <button onClick={() => setPlanEditMode(false)}
                              style={{ height: 30, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, color: C.muted }}>
                              Annuler
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* TOOLBAR DROITE */}
        <aside style={{ width: 48, background: C.surface, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0', flexShrink: 0 }}>

          {/* Fond de carte */}
          <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Fond</span>
          <button onClick={() => switchBasemap('plan')} title="Vue Plan" style={{ ...s.toolBtn, background: basemap === 'plan' ? C.accent : 'transparent', color: basemap === 'plan' ? '#fff' : C.muted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            <span style={{ fontSize: 9, marginTop: 1 }}>Plan</span>
          </button>
          <button onClick={() => switchBasemap('satellite')} title="Vue Satellite" style={{ ...s.toolBtn, background: basemap === 'satellite' ? C.accent : 'transparent', color: basemap === 'satellite' ? '#fff' : C.muted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 2a10 10 0 0 0-10 10"/>
              <path d="M2 12a10 10 0 0 0 10 10"/><path d="M22 12a10 10 0 0 1-10 10"/>
              <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
            </svg>
            <span style={{ fontSize: 9, marginTop: 1 }}>Satellite</span>
          </button>

          {/* Séparateur */}
          <div style={{ width: 28, height: 1, background: C.border, margin: '6px 0' }} />

          {/* Zoom */}
          <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Zoom</span>
          <button onClick={() => planViewer ? planMapRef.current?.zoomIn() : mapRef.current?.zoomIn()} title="Zoom +" style={s.toolBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button onClick={() => planViewer ? planMapRef.current?.zoomOut() : mapRef.current?.zoomOut()} title="Zoom −" style={s.toolBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>

          {/* Séparateur */}
          <div style={{ width: 28, height: 1, background: C.border, margin: '6px 0' }} />

          {/* Calques */}
          {(() => {
            const selNode = selected ? findNode(tree, selected) : null;
            const active  = selNode?.type === 'site' || (selNode?.type === 'plan' && !!planViewer);
            return (
              <button
                onClick={openCalquesModal}
                title={active ? 'Calques' : 'Sélectionnez un site ou un plan'}
                disabled={!active}
                style={{ ...s.toolBtn, color: active ? C.accent : C.muted, opacity: active ? 1 : 0.4, cursor: active ? 'pointer' : 'default' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
                <span style={{ fontSize: 9, marginTop: 1 }}>Calques</span>
              </button>
            );
          })()}
        </aside>
      </div>

      {/* ── CALQUES MODAL ── */}
      {calquesOpen && (() => {
        const selNode = selected ? findNode(tree, selected) : null;
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setCalquesOpen(false)}
          >
            <div
              style={{ width: 364, maxHeight: '80vh', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>
                  Calques{selNode ? ` — ${selNode.label}` : ''}
                </span>
                <button onClick={() => setCalquesOpen(false)} style={{ width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', color: C.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>



              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {calquesLoading && <p style={{ padding: '20px 16px', fontSize: 12, color: C.muted, margin: 0 }}>Chargement…</p>}
                {!calquesLoading && calquesList.length === 0 && <p style={{ padding: '20px 16px', fontSize: 12, color: C.muted, margin: 0 }}>Aucun calque pour cette sélection.</p>}
                {!calquesLoading && calquesList.map(c => {
                  const isVisible = calquesVisible[c.id] ?? true;
                  const isActif   = calquesActif === c.id;
                  return (
                    <div
                      key={c.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderBottom: `1px solid ${C.border}20`, background: isActif ? '#378ADD0D' : 'transparent', transition: 'background 0.12s' }}
                    >
                      {/* Visibility toggle */}
                      <button
                        title={isVisible ? 'Masquer' : 'Afficher'}
                        onClick={() => setCalquesVisible(prev => ({ ...prev, [c.id]: !isVisible }))}
                        style={{ width: 28, height: 28, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isVisible ? C.accent : C.muted, flexShrink: 0, padding: 0, borderRadius: 4 }}
                      >
                        {isVisible
                          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        }
                      </button>

                      {/* Icone */}
                      {c.icone_public_url
                        ? <div style={{ width: 16, height: 16, flexShrink: 0, opacity: isVisible ? 1 : 0.35, backgroundColor: c.couleur ?? C.muted, WebkitMaskImage: `url(${c.icone_public_url})`, maskImage: `url(${c.icone_public_url})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
                        : <div style={{ width: 16, flexShrink: 0 }} />
                      }

                      {/* Nom */}
                      <span style={{ flex: 1, fontSize: 12, color: isVisible ? C.text : C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nom}
                      </span>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PDF VIEWER MODAL ── */}
      {pdfViewer && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPdfViewer(null)}
        >
          <div
            style={{ width: '80vw', height: '90vh', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pdfViewer.nom}
              </span>
              {pdfViewer.isUploadable && (
                <a
                  href={pdfViewer.url}
                  download={pdfViewer.nom}
                  target="_blank"
                  rel="noreferrer"
                  style={{ height: 28, padding: '0 12px', background: C.accent, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Télécharger
                </a>
              )}
              <button
                onClick={() => setPdfViewer(null)}
                style={{ width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', color: C.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
            <iframe
              src={`${pdfViewer.url}#toolbar=0&navpanes=0`}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title={pdfViewer.nom}
            />
          </div>
        </div>
      )}

      {/* ── PHOTO MODAL ── */}
      {photoModalIndex !== null && pointPhotos[photoModalIndex] && (() => {
        const photo = pointPhotos[photoModalIndex];
        const prev  = () => setPhotoModalIndex(i => ((i ?? 0) - 1 + pointPhotos.length) % pointPhotos.length);
        const next  = () => setPhotoModalIndex(i => ((i ?? 0) + 1) % pointPhotos.length);
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setPhotoModalIndex(null)}
            onKeyDown={e => { if (e.key === 'Escape') setPhotoModalIndex(null); if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); }}
            tabIndex={0}
            ref={el => el?.focus()}
          >
            {/* Header */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)', zIndex: 1 }}
              onClick={e => e.stopPropagation()}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.nom}</span>
              {photo.description && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{photo.description}</span>}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{(photoModalIndex ?? 0) + 1} / {pointPhotos.length}</span>
              <button onClick={() => setPhotoModalIndex(null)} style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>

            {/* Image */}
            <img
              src={photo.public_url ?? ''}
              alt={photo.nom}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', userSelect: 'none' }}
            />

            {/* Flèches */}
            {pointPhotos.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); prev(); }}
                  style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(4px)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); next(); }}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(4px)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </>
            )}

            {/* Dots */}
            {pointPhotos.length > 1 && (
              <div style={{ position: 'absolute', bottom: 20, display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                {pointPhotos.map((_, i) => (
                  <div key={i} onClick={() => setPhotoModalIndex(i)}
                    style={{ width: i === photoModalIndex ? 20 : 8, height: 8, borderRadius: 4, background: i === photoModalIndex ? C.accent : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'width 0.2s, background 0.2s' }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── FOOTER ── */}
      <div style={{ height: 28, background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', flexShrink: 0, fontSize: 11, color: C.muted, overflow: 'hidden' }}>
        {(() => {
          const path = selected ? findPath(tree, selected) : null;
          const segments = path ? path.filter(n => n.type !== 'group') : [];
          const crumbColor = '#A0B2C8';
          if (segments.length === 0) return <span style={{ color: C.muted, fontStyle: 'italic' }}>Aucun élément sélectionné</span>;
          return segments.map((n, i) => (
            <span key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={crumbColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>
                </svg>
              )}
              <span style={{ color: crumbColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.label}
              </span>
            </span>
          ));
        })()}
        <div style={{ flex: 1 }} />
        <span style={{ flexShrink: 0 }}>Zoom : <strong style={{ color: C.text }}>{zoom}</strong></span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  navBtn:  { height: 28, padding: '0 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, color: C.muted },
  toolBtn:     { width: 40, height: 40, background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.muted, transition: 'background 0.15s, color 0.15s', fontFamily: '"Segoe UI", sans-serif' },
  treeCtrlBtn: { width: 22, height: 22, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0, padding: 0 },
  planZoomBtn:  { width: 26, height: 26, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0, padding: 0, fontSize: 14 },
  panelIconBtn: { width: 26, height: 26, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0, padding: 0 },
};
