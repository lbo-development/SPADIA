import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import AppNav from '@/components/AppNav';
import { Modal } from '@/components/Modal';
import { extractErrorMessage } from '@/lib/errors';
import { Spinner } from '@/components/ui';
import { db } from '@/api/database';
import type { Calque, Point, Photo, FichierCalque, Favori, MapStateFavori } from '@/api/database';
import * as XLSX from 'xlsx';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { C } from '@/constants/colors';
import { useTreeData, findNode, findPath, findNodeLabel, findNodeType, collectExpandableIds } from '@/hooks/useTreeData';
import type { TreeNode } from '@/hooks/useTreeData';
import { useGeoMap } from '@/hooks/useGeoMap';
import { usePlanOverlay } from '@/hooks/usePlanOverlay';
import type { PlanViewerState } from '@/hooks/usePlanOverlay';

function safeColor(c: string): string {
  return /^#[0-9a-fA-F]{3,8}$|^rgb\(\d+,\s*\d+,\s*\d+\)$/.test(c) ? c : '#333333';
}
function safeCssUrl(url: string): string {
  return url.replace(/['"\\()]/g, '');
}

const PALETTE = ['#0078D4','#107C10','#D83B01','#5C2D91','#038387','#CA5010','#00B294','#B4009E'];
function nameColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
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

function NodeIcon({ type, open }: { type: TreeNode['type']; open?: boolean }) {
  const color = ICON_COLOR[type] ?? C.muted;
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'site':         return <svg {...p}><rect x="2" y="2" width="14" height="14" rx="2"/><line x1="2" y1="9" x2="9" y2="2"/><line x1="7" y1="16" x2="16" y2="7"/><path d="M17.5 22C14.5 19 14 17 14 15.5a3.5 3.5 0 0 1 7 0C21 17 20.5 19 17.5 22Z"/><circle cx="17.5" cy="15.5" r="1.2" fill={color} stroke="none"/></svg>;
    case 'installation': return <svg {...p}><path d="M12 22C8.5 18 4 13.5 4 9.5a8 8 0 0 1 16 0C20 13.5 15.5 18 12 22Z"/><circle cx="12" cy="9.5" r="5.2"/><path d="M10 14V8h4v6M11 14v-2.5h2V14"/></svg>;
    case 'plan':
      return <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: color, borderRadius: 2, padding: '0 3px', lineHeight: '14px', fontFamily: 'inherit', letterSpacing: '0.04em', display: 'inline-block', flexShrink: 0 }}>SVG</span>;
    case 'dossier':
      return open ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          {/* Fond du dossier (panneau arrière) */}
          <path d="M2 7a2 2 0 0 1 2-2h4l2 2h10a2 2 0 0 1 2 2v2H2V7z" fill={color} fillOpacity="0.5"/>
          {/* Corps ouvert (panneau avant) */}
          <path d="M2 11h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V11z" fill={color}/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M2 7a2 2 0 0 1 2-2h4l2 2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" fill={color}/>
        </svg>
      );
    case 'calque':       return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case 'fichier':
      return <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: color, borderRadius: 2, padding: '0 3px', lineHeight: '14px', fontFamily: 'inherit', letterSpacing: '0.04em', display: 'inline-block', flexShrink: 0 }}>PDF</span>;
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
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: `7px 10px 3px ${12 + depth * 12}px`, cursor: hasChildren ? 'pointer' : 'default', userSelect: 'none' }}
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
          padding:    `5px 8px 5px ${8 + depth * 12}px`,
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
          <NodeIcon type={node.type} open={isOpen} />
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
        boxShadow: hovered ? `-2px 0 8px ${C.accent44}` : 'none',
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
        boxShadow: hovered ? `2px 0 8px ${C.accent44}` : 'none',
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
  const [avatarFailed,    setAvatarFailed]    = useState(false);
  const [viewportHeight,  setViewportHeight]  = useState(() => `${window.innerHeight}px`);

  const location = useLocation();
  const pendingMapStateRef    = useRef<MapStateFavori | null>(null);
  const pendingNavMapRef      = useRef<MapStateFavori | null>(
    (location.state as { map_state?: MapStateFavori } | null)?.map_state ?? null
  );
  const pendingNavNodeRef     = useRef<string | null>(
    !(location.state as { map_state?: unknown } | null)?.map_state
      ? ((location.state as { nodeId?: string } | null)?.nodeId ?? null)
      : null
  );
  const pendingCalqueIdRef    = useRef<string | null>(
    (location.state as { calque_id?: string } | null)?.calque_id ?? null
  );

  const [zoom,        setZoom]        = useState(6);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pdfViewer,   setPdfViewer]   = useState<{ url: string; nom: string; isUploadable: boolean } | null>(null);
  const [planViewer,  setPlanViewer]  = useState<PlanViewerState | null>(null);
  const planAddModeRef       = useRef(false);
  const planSelCalqueIdRef   = useRef<string | null>(null);
  const planMoveModeRef      = useRef(false);
  const planToolbarRef       = useRef<HTMLDivElement>(null);
  const [planToolbarH,       setPlanToolbarH]       = useState(0);

  // Refs pour les calques géo des sites (carte principale)
  const geoMarkersRef        = useRef<L.Marker[]>([]);
  const geoPendingMarkerRef  = useRef<L.CircleMarker | null>(null);
  const geoAddModeRef        = useRef(false);
  const geoMoveModeRef       = useRef(false);
  const geoSelCalqueIdRef    = useRef<string | null>(null);

  const [planCalques,     setPlanCalques]     = useState<Calque[]>([]);
  const [planPointsMap,   setPlanPointsMap]   = useState<Record<string, Point[]>>({});
  const [planSelCalqueId, setPlanSelCalqueId] = useState<string | null>(null);
  const [planAddMode,     setPlanAddMode]     = useState(false);
  const [planPendingPos,  setPlanPendingPos]  = useState<{ x: number; y: number } | null>(null);
  const [planPendingNom,  setPlanPendingNom]  = useState('');
  const [planSaving,      setPlanSaving]      = useState(false);
  const [planSelectedPoint, setPlanSelectedPoint] = useState<Point | null>(null);
  const [planMoveMode,       setPlanMoveMode]       = useState(false);
  const [showPointsListModal, setShowPointsListModal] = useState(false);
  const [pointsListMode,      setPointsListMode]      = useState<'plan' | 'geo'>('plan');
  const [pointsFilters,      setPointsFilters]      = useState<Record<string, Set<string>>>({});
  const [filterDropKey,      setFilterDropKey]      = useState<string | null>(null);
  const [filterSearch,       setFilterSearch]       = useState('');
  const [colWidths,          setColWidths]          = useState<Record<string, number>>({});
  const filterBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const colResizeRef  = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // ── Modal fichiers PDF du calque ──────────────────────────────────────────
  const [showCalquePdfModal,    setShowCalquePdfModal]    = useState(false);
  const [calquePdfMode,         setCalquePdfMode]         = useState<'plan' | 'geo'>('plan');
  const [calqueFichiers,        setCalqueFichiers]        = useState<FichierCalque[]>([]);
  const [calqueFichiersLoading, setCalqueFichiersLoading] = useState(false);
  const [calquePdfUploading,    setCalquePdfUploading]    = useState(false);
  const [calquePdfDeleteId,     setCalquePdfDeleteId]     = useState<string | null>(null);
  const [calquePdfEditId,       setCalquePdfEditId]       = useState<string | null>(null);
  const [calquePdfShowUpload,   setCalquePdfShowUpload]   = useState(false);
  const [calquePdfError,        setCalquePdfError]        = useState<string | null>(null);
  const [calquePdfFormNom,      setCalquePdfFormNom]      = useState('');
  const [calquePdfFormDesc,     setCalquePdfFormDesc]     = useState('');
  const [calquePdfFormDl,       setCalquePdfFormDl]       = useState(false);
  const [calquePdfFile,         setCalquePdfFile]         = useState<File | null>(null);
  const [calquePdfDragOver,     setCalquePdfDragOver]     = useState(false);
  const calquePdfFileInputRef   = useRef<HTMLInputElement>(null);
  const [planPanelCollapsed, setPlanPanelCollapsed] = useState(false);
  const [planEditMode,       setPlanEditMode]       = useState(false);
  const [planEditNom,        setPlanEditNom]        = useState('');
  const [planEditValues,     setPlanEditValues]     = useState<Record<string, string>>({});
  const [planEditSaving,     setPlanEditSaving]     = useState(false);
  const [planDeleteConfirm,  setPlanDeleteConfirm]  = useState(false);
  const [deletePointError,   setDeletePointError]   = useState<string | null>(null);

  // State pour les calques géo des sites (carte principale)
  const [geoPointsMap,   setGeoPointsMap]   = useState<Record<string, Point[]>>({});
  const [geoSiteNom,     setGeoSiteNom]     = useState('');
  const [geoInstNom,     setGeoInstNom]     = useState('');
  const [planSiteNom,    setPlanSiteNom]    = useState('');
  const [planInstNom,    setPlanInstNom]    = useState('');
  const [geoAddMode,     setGeoAddMode]     = useState(false);
  const [geoMoveMode,    setGeoMoveMode]    = useState(false);
  const [geoPendingPos,  setGeoPendingPos]  = useState<{ lat: number; lng: number } | null>(null);
  const [geoPendingNom,  setGeoPendingNom]  = useState('');
  const [geoSaving,      setGeoSaving]      = useState(false);

  const [pointPhotos,        setPointPhotos]        = useState<Photo[]>([]);
  const [photosLoading,      setPhotosLoading]      = useState(false);
  const [carouselIndex,      setCarouselIndex]      = useState(0);
  const [photoDragOver,      setPhotoDragOver]      = useState(false);
  const [photoUploading,     setPhotoUploading]     = useState(false);
  const [favoriApplying,    setFavoriApplying]    = useState(false);
  const [photoModalIndex,    setPhotoModalIndex]    = useState<number | null>(null);
  const [photoDeleteConfirm, setPhotoDeleteConfirm] = useState(false);
  const [dragFromPhotoIdx,   setDragFromPhotoIdx]   = useState<number | null>(null);
  const [dragOverPhotoIdx,   setDragOverPhotoIdx]   = useState<number | null>(null);
  const [pointPdfs,          setPointPdfs]          = useState<Photo[]>([]);
  const [selectedPdfId,      setSelectedPdfId]      = useState<string | null>(null);
  const [pdfDragOver,        setPdfDragOver]        = useState(false);
  const [pdfUploading,       setPdfUploading]       = useState(false);
  const [renamingId,         setRenamingId]         = useState<string | null>(null);
  const [renameValue,        setRenameValue]        = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);

  const [calquesList,         setCalquesList]         = useState<Calque[]>([]);
  const [calquesVisible,      setCalquesVisible]      = useState<Record<string, boolean>>({});
  const [calquesActif,        setCalquesActif]        = useState<string | null>(null);
  const [geoCalquesDropOpen,  setGeoCalquesDropOpen]  = useState(false);
  const [planCalquesDropOpen, setPlanCalquesDropOpen] = useState(false);
  const planCalquesBtnRef = useRef<HTMLButtonElement>(null);

  const [favoris,        setFavoris]        = useState<Favori[]>([]);
  const [favorisPanelOpen, setFavorisPanelOpen] = useState(false);
  const [favorisSaving,  setFavorisSaving]  = useState(false);
  const [favorisNewLabel, setFavorisNewLabel] = useState('');
  const [favorisAddOpen,  setFavorisAddOpen]  = useState(false);
  const [favorisRenaming, setFavorisRenaming] = useState<string | null>(null);
  const [favorisRenameVal, setFavorisRenameVal] = useState('');

  const { tree, expanded, setExpanded, selected, setSelected, loading, counts, toggleNode } = useTreeData(location.state);

  const { mapRef, mapContainerRef, tileLayerRef, basemap, switchBasemap } = useGeoMap(
    setZoom,
    (lat, lng) => {
      if (geoAddModeRef.current && geoSelCalqueIdRef.current) {
        setGeoPendingPos({ lat, lng });
        setGeoPendingNom('');
      }
    },
  );

  const { planMapRef, planMapContainerRef, planMarkersRef, planPendingMarkerRef } = usePlanOverlay(
    planViewer,
    setZoom,
    mapRef,
    (x, y) => {
      if (planAddModeRef.current) {
        setPlanPendingPos({ x, y });
        setPlanPendingNom('');
      } else if (!planMoveModeRef.current) {
        setPlanSelectedPoint(null);
      }
    },
  );

  const isAdminAppOrData      = user?.role === ROLES.ADMIN_APP || user?.role === ROLES.ADMIN_DATA;
  const canEditGeo            = isAdminAppOrData || (calquesList.find(c => c.id === calquesActif)?.owner_id === user?.id);
  const canEditPlan           = isAdminAppOrData || (planCalques.find(c => c.id === planSelCalqueId)?.owner_id === user?.id);
  const canEditSelectedPoint  = isAdminAppOrData || (planCalques.find(c => c.id === planSelectedPoint?.calque_id)?.owner_id === user?.id);
  const canDownloadGeo        = canEditGeo || (calquesList.find(c => c.id === calquesActif)?.is_downloadable ?? false);
  const canDownloadPlan       = canEditPlan || (planCalques.find(c => c.id === planSelCalqueId)?.is_downloadable ?? false);

  function handleNodeDoubleClick(node: TreeNode) {
    if (node.type === 'site' || node.type === 'installation') {
      if (planViewer) {
        setPlanViewer(null);
        setPlanAddMode(false);
        setPlanPendingPos(null);
      }
      if (!pendingMapStateRef.current && node.lat != null && node.lng != null && mapRef.current) {
        mapRef.current.flyTo([node.lat, node.lng], node.zoom ?? 13);
      }
      if (node.type === 'site') {
        setGeoSiteNom('');
        setCalquesList([]);
        setGeoPointsMap({});
        setGeoInstNom('');
        setCalquesActif(null);
        setGeoAddMode(false);
        setGeoMoveMode(false);
        setGeoPendingPos(null);
        setPlanSelectedPoint(null);
        db.listCalquesGeo(node.id).then(async res => {
          const calques = res.data;
          const results = await Promise.all(
            calques.map(c => db.listPoints(c.id).then(r => ({ id: c.id, pts: r.data })).catch(() => ({ id: c.id, pts: [] as Point[] })))
          );
          const byCalque: Record<string, Point[]> = {};
          for (const { id, pts } of results) byCalque[id] = pts;
          setCalquesList(calques);
          setGeoPointsMap(byCalque);
          setGeoSiteNom(node.label);
          const pending = pendingMapStateRef.current;
          if (pending?.context === 'geo') {
            pendingMapStateRef.current = null;
            setCalquesVisible(pending.calques_visible);
            setCalquesActif(pending.calques_actif);
            mapRef.current?.setView([pending.lat, pending.lng], pending.zoom, { animate: false });
          } else {
            const pendingCalqueId = pendingCalqueIdRef.current;
            if (pendingCalqueId && calques.find(c => c.id === pendingCalqueId)) {
              pendingCalqueIdRef.current = null;
              setCalquesActif(pendingCalqueId);
            } else if (calques.length > 0) {
              setCalquesActif(calques[0].id);
            }
          }
          setFavoriApplying(false);
        }).catch(() => { setFavoriApplying(false); });
      } else {
        const path = findPath(tree, node.id);
        const siteNode = path?.find(n => n.type === 'site');
        setGeoSiteNom(siteNode?.label ?? '');
        setGeoInstNom(node.label);
        setCalquesList([]);
        setGeoPointsMap({});
        setCalquesActif(null);
        setGeoAddMode(false);
        setGeoMoveMode(false);
        setGeoPendingPos(null);
        setPlanSelectedPoint(null);
      }
      return;
    }
    if (node.type === 'plan') {
      if (node.svgUrl) {
        const path = findPath(tree, node.id);
        const siteNode = path?.find(n => n.type === 'site');
        const instNode  = path?.find(n => n.type === 'installation');
        setPlanSiteNom(siteNode?.label ?? '');
        setPlanInstNom(instNode?.label ?? '');
        setCalquesList([]); setGeoPointsMap({}); setCalquesActif(null);
        setGeoSiteNom(''); setGeoInstNom('');
        setGeoAddMode(false); setGeoMoveMode(false); setGeoPendingPos(null);
        setPlanAddMode(false); setPlanPendingPos(null); setPlanPendingNom(''); setPlanSelectedPoint(null);
        setPlanMoveMode(false);
        if (planViewer?.planId === node.id) {
          // Même plan déjà ouvert — l'effet calques ne se re-déclenchera pas (URL inchangée)
          // → restaurer la position directement sans recharger
          const pending = pendingMapStateRef.current;
          if (pending?.context === 'plan') {
            pendingMapStateRef.current = null;
            setPlanSelCalqueId(pending.calques_actif);
            planMapRef.current?.setView([pending.lat, pending.lng], pending.zoom, { animate: false });
          }
          setFavoriApplying(false);
        } else {
          setPlanViewer({ url: node.svgUrl, nom: node.label, width: node.svgWidth ?? null, height: node.svgHeight ?? null, planId: node.id });
        }
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

  useEffect(() => {
    db.listFavoris().then(r => setFavoris(r.data)).catch(() => {});
  }, []);

  async function saveFavori() {
    if (!selected || favorisSaving) return;
    setFavorisSaving(true);
    try {
      const label = favorisNewLabel.trim() || findNodeLabel(tree, selected) || 'Favori';

      let mapState: MapStateFavori | null = null;
      if (planViewer && planMapRef.current) {
        const c = planMapRef.current.getCenter();
        mapState = {
          context: 'plan',
          lat: c.lat, lng: c.lng,
          zoom: planMapRef.current.getZoom(),
          load_id: planViewer.planId,
          load_type: 'plan',
          calques_actif: planSelCalqueId,
          calques_visible: {},
        };
      } else if (mapRef.current && calquesList.length > 0) {
        const siteId = calquesList[0].site_id;
        if (siteId) {
          const c = mapRef.current.getCenter();
          mapState = {
            context: 'geo',
            lat: c.lat, lng: c.lng,
            zoom: mapRef.current.getZoom(),
            load_id: siteId,
            load_type: 'site',
            calques_actif: calquesActif,
            calques_visible: { ...calquesVisible },
          };
        }
      }

      const res = await db.createFavori({ label, node_id: selected, node_type: findNodeType(tree, selected) ?? 'site', expanded: [...expanded], map_state: mapState });
      setFavoris(prev => [...prev, res.data]);
      setFavorisNewLabel('');
      setFavorisAddOpen(false);
    } finally {
      setFavorisSaving(false);
    }
  }

  async function deleteFavori(id: string) {
    await db.removeFavori(id);
    setFavoris(prev => prev.filter(f => f.id !== id));
  }

  async function renameFavori(id: string) {
    if (!favorisRenameVal.trim()) return;
    const res = await db.updateFavori(id, favorisRenameVal.trim());
    setFavoris(prev => prev.map(f => f.id === id ? res.data : f));
    setFavorisRenaming(null);
  }

  function applyFavori(f: Favori) {
    setExpanded(new Set(f.expanded));
    setSelected(f.node_id);
    setFavorisPanelOpen(false);
    if (f.map_state) {
      setFavoriApplying(true);
      pendingMapStateRef.current = f.map_state;
      const targetNode = findNode(tree, f.map_state.load_id);
      if (targetNode) handleNodeDoubleClick(targetNode);
      else setFavoriApplying(false);
    }
  }


  // ── Applique le map_state transmis par la navigation depuis le dashboard ────
  useEffect(() => {
    if (loading || tree.length === 0) return;
    if (pendingNavMapRef.current) {
      const ms = pendingNavMapRef.current;
      pendingNavMapRef.current = null;
      pendingMapStateRef.current = ms;
      setFavoriApplying(true);
      const targetNode = findNode(tree, ms.load_id);
      if (targetNode) handleNodeDoubleClick(targetNode);
      else setFavoriApplying(false);
      return;
    }
    if (pendingNavNodeRef.current) {
      const nodeId = pendingNavNodeRef.current;
      pendingNavNodeRef.current = null;
      const targetNode = findNode(tree, nodeId);
      if (targetNode) handleNodeDoubleClick(targetNode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tree]);

  // ── Sync refs (évite les closures périmées dans les handlers Leaflet) ──────
  useEffect(() => {
    planAddModeRef.current = planAddMode;
    const container = planMapRef.current?.getContainer();
    if (container) container.style.cursor = planAddMode ? 'crosshair' : (planMoveModeRef.current ? 'move' : '');
  }, [planAddMode]);

  useEffect(() => { planSelCalqueIdRef.current = planSelCalqueId; }, [planSelCalqueId]);

  useEffect(() => { planMoveModeRef.current = planMoveMode; }, [planMoveMode]);

  // ── Sync refs géo ─────────────────────────────────────────────────────────
  useEffect(() => {
    geoAddModeRef.current = geoAddMode;
    const container = mapRef.current?.getContainer();
    if (container) container.style.cursor = geoAddMode ? 'crosshair' : (geoMoveModeRef.current ? 'move' : '');
  }, [geoAddMode]);

  useEffect(() => { geoMoveModeRef.current = geoMoveMode; }, [geoMoveMode]);
  useEffect(() => { geoSelCalqueIdRef.current = calquesActif; }, [calquesActif]);

  useEffect(() => {
    setPlanEditMode(false);
    setPlanDeleteConfirm(false);
    setPhotoDeleteConfirm(false);
    setRenamingId(null);
    setSelectedPdfId(null);
    setPointPhotos([]);
    setPointPdfs([]);
    setCarouselIndex(0);
    if (!planSelectedPoint) return;
    setPhotosLoading(true);
    db.listPhotos(planSelectedPoint.id)
      .then(r => {
        setPointPhotos(r.data.filter(p => p.file_type === 'image'));
        const pdfs = r.data.filter(p => p.file_type === 'pdf');
        setPointPdfs(pdfs);
        setSelectedPdfId(pdfs[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setPhotosLoading(false));
  }, [planSelectedPoint]);


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
      const rawColor = calque?.couleur ?? null;
      const color    = safeColor(rawColor ?? '#333');
      const iconUrl  = calque?.icone_public_url;
      for (const p of pts) {
        const isSel   = p.id === planSelectedPoint?.id;
        const safeUrl = iconUrl ? safeCssUrl(iconUrl) : '';
        const iconHtml = safeUrl
          ? rawColor
            ? `<div style="width:20px;height:20px;background-color:${color};-webkit-mask-image:url(${safeUrl});mask-image:url(${safeUrl});-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;"></div>`
            : `<img src="${safeUrl}" style="width:20px;height:20px;object-fit:contain;display:block;" />`
          : `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`;
        const ring = isSel ? `<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid #e53e3e;pointer-events:none;"></div>` : '';
        const icon = L.divIcon({
          html: `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;pointer-events:none;">${iconHtml}${ring}</div>`,
          className: '',
          iconAnchor: [10, 10],
        });
        const isDraggablePlan = planMoveMode && calqueId === planSelCalqueId;
        const marker = L.marker([p.coord_y_ou_lat, p.coord_x_ou_lon], { icon, draggable: isDraggablePlan });
        marker.on('click', () => {
          if (planAddModeRef.current || planMoveModeRef.current) return;
          setPlanSelectedPoint(p); setPlanPanelCollapsed(false);
        });
        if (isDraggablePlan) {
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
  }, [planPointsMap, planCalques, planMoveMode, planSelCalqueId, calquesVisible, zoom, planSelectedPoint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Marqueurs géo des points de site sur la carte principale ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    geoMarkersRef.current.forEach(m => m.remove());
    geoMarkersRef.current = [];
    if (planViewer) return; // plan viewer actif : pas de marqueurs géo
    for (const [calqueId, pts] of Object.entries(geoPointsMap)) {
      if (calquesVisible[calqueId] === false) continue;
      const calque = calquesList.find(c => c.id === calqueId);
      const rawColor = calque?.couleur ?? null;
      const color    = safeColor(rawColor ?? C.accent);
      const iconUrl  = calque?.icone_public_url;
      for (const p of pts) {
        const isSel   = p.id === planSelectedPoint?.id;
        const safeUrl = iconUrl ? safeCssUrl(iconUrl) : '';
        const iconHtml = safeUrl
          ? rawColor
            ? `<div style="width:20px;height:20px;background-color:${color};-webkit-mask-image:url(${safeUrl});mask-image:url(${safeUrl});-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;"></div>`
            : `<img src="${safeUrl}" style="width:20px;height:20px;object-fit:contain;display:block;" />`
          : `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`;
        const ring = isSel ? `<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid #e53e3e;pointer-events:none;"></div>` : '';
        const icon = L.divIcon({ html: `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;pointer-events:none;">${iconHtml}${ring}</div>`, className: '', iconAnchor: [10, 10] });
        const isDraggableGeo = geoMoveMode && calqueId === calquesActif;
        const marker = L.marker([p.coord_y_ou_lat, p.coord_x_ou_lon], { icon, draggable: isDraggableGeo });
        marker.on('click', () => {
          if (geoAddModeRef.current || geoMoveModeRef.current) return;
          setPlanSelectedPoint(p); setPlanPanelCollapsed(false);
        });
        if (isDraggableGeo) {
          marker.on('dragend', async () => {
            const pos = marker.getLatLng();
            try {
              const res = await db.updatePoint(p.id, { coord_x_ou_lon: pos.lng, coord_y_ou_lat: pos.lat });
              setGeoPointsMap(prev => ({
                ...prev,
                [calqueId]: (prev[calqueId] ?? []).map(pt => pt.id === p.id ? res.data : pt),
              }));
            } catch {
              marker.setLatLng([p.coord_y_ou_lat, p.coord_x_ou_lon]);
            }
          });
        }
        marker.addTo(map);
        geoMarkersRef.current.push(marker);
      }
    }
  }, [geoPointsMap, calquesList, geoMoveMode, calquesActif, calquesVisible, planViewer, planSelectedPoint]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Marqueur géo du point en cours de placement ──────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    geoPendingMarkerRef.current?.remove();
    geoPendingMarkerRef.current = null;
    if (!map || !geoPendingPos) return;
    const color = calquesList.find(c => c.id === calquesActif)?.couleur ?? C.accent;
    const m = L.circleMarker([geoPendingPos.lat, geoPendingPos.lng], { radius: 7, color: 'white', fillColor: color, fillOpacity: 0.75, weight: 2 });
    m.addTo(map);
    geoPendingMarkerRef.current = m;
  }, [geoPendingPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chargement calques + points du plan ───────────────────────────────────
  useEffect(() => {
    if (!planViewer) return;
    setPlanCalques([]); setPlanPointsMap({}); setPlanSelCalqueId(null); setPlanSelectedPoint(null);
    setPlanMoveMode(false);
    db.listCalques(planViewer.planId).then(async res => {
      const calques = res.data;
      setPlanCalques(calques);
      const pending = pendingMapStateRef.current;
      if (pending?.context === 'plan') {
        pendingMapStateRef.current = null;
        setPlanSelCalqueId(pending.calques_actif);
      } else {
        const pendingCalqueId = pendingCalqueIdRef.current;
        if (pendingCalqueId && calques.find(c => c.id === pendingCalqueId)) {
          pendingCalqueIdRef.current = null;
          setPlanSelCalqueId(pendingCalqueId);
        } else if (calques.length > 0) {
          setPlanSelCalqueId(calques[0].id);
        }
      }
      const results = await Promise.all(
        calques.map(c => db.listPoints(c.id).then(r => ({ id: c.id, pts: r.data })).catch(() => ({ id: c.id, pts: [] as Point[] })))
      );
      const byCalque: Record<string, Point[]> = {};
      for (const { id, pts } of results) byCalque[id] = pts;
      setPlanPointsMap(byCalque);
      if (pending?.context === 'plan') {
        planMapRef.current?.setView([pending.lat, pending.lng], pending.zoom, { animate: false });
        setFavoriApplying(false);
      }
    }).catch(() => { setFavoriApplying(false); });
  }, [planViewer?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const EXCLUDED_PROPS = new Set(['marker-size', 'marker-color']);

  function resolveChampSource(champs: Record<string, unknown> | null): Record<string, unknown> {
    if (!champs) return {};
    return (champs.properties && typeof champs.properties === 'object' && champs.properties !== null)
      ? champs.properties as Record<string, unknown>
      : champs;
  }

  function exportCalqueExcel(calque: Calque, points: Point[]) {
    const isGeo = calque.type === 'geographique';
    const colX  = isGeo ? 'LONGITUDE' : 'X';
    const colY  = isGeo ? 'LATITUDE'  : 'Y';

    const EXCLUDED = new Set(['marker-size', 'marker-color']);
    const propKeys = Array.from(
      new Set(points.flatMap(p => Object.keys(resolveChampSource(p.champs)).filter(k => !EXCLUDED.has(k))))
    );

    const rows = points.map(p => {
      const props = resolveChampSource(p.champs);
      const base: Record<string, unknown> = {
        SITE:        calque.site_nom         || '',
        INSTALLATION: calque.installation_nom || '',
        PLAN:        calque.plan_nom         || '',
        CALQUE:      calque.nom,
        NOM:         p.nom,
        [colX]:      p.coord_x_ou_lon,
        [colY]:      p.coord_y_ou_lat,
      };
      for (const k of propKeys) base[k] = props[k] ?? '';
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Points');
    const filename = `${calque.nom.replace(/[^\w\s-]/g, '').trim()}_points.xlsx`;
    XLSX.writeFile(wb, filename);
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
      if (planViewer) {
        setPlanPointsMap(prev => ({
          ...prev,
          [planSelectedPoint.calque_id]: (prev[planSelectedPoint.calque_id] ?? []).map(p =>
            p.id === planSelectedPoint.id ? res.data : p
          ),
        }));
      } else {
        setGeoPointsMap(prev => ({
          ...prev,
          [planSelectedPoint.calque_id]: (prev[planSelectedPoint.calque_id] ?? []).map(p =>
            p.id === planSelectedPoint.id ? res.data : p
          ),
        }));
      }
      setPlanSelectedPoint(res.data);
      setPlanEditMode(false);
    } finally {
      setPlanEditSaving(false);
    }
  }

  async function handleDeletePoint() {
    if (!planSelectedPoint) return;
    setDeletePointError(null);
    try {
      await db.removePoint(planSelectedPoint.id);
      if (planViewer) {
        setPlanPointsMap(prev => ({
          ...prev,
          [planSelectedPoint.calque_id]: (prev[planSelectedPoint.calque_id] ?? []).filter(p => p.id !== planSelectedPoint.id),
        }));
      } else {
        setGeoPointsMap(prev => ({
          ...prev,
          [planSelectedPoint.calque_id]: (prev[planSelectedPoint.calque_id] ?? []).filter(p => p.id !== planSelectedPoint.id),
        }));
      }
      setPlanSelectedPoint(null);
      setPlanDeleteConfirm(false);
    } catch (err) {
      setDeletePointError(extractErrorMessage(err, 'Erreur lors de la suppression.'));
    }
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

  async function handleSaveNewGeoPoint() {
    if (!geoPendingPos || !calquesActif || !geoPendingNom.trim() || geoSaving) return;
    setGeoSaving(true);
    const calque = calquesList.find(c => c.id === calquesActif);
    const champsInitiaux = calque?.template_champs ? JSON.parse(JSON.stringify(calque.template_champs)) : null;
    try {
      const res = await db.createPoint({
        calque_id:      calquesActif,
        nom:            geoPendingNom.trim(),
        coord_x_ou_lon: geoPendingPos.lng,
        coord_y_ou_lat: geoPendingPos.lat,
        champs:         champsInitiaux,
      });
      setGeoPointsMap(prev => ({ ...prev, [calquesActif]: [...(prev[calquesActif] ?? []), res.data] }));
      setGeoPendingPos(null);
      setGeoPendingNom('');
    } finally {
      setGeoSaving(false);
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
    const update = () => setViewportHeight(`${window.innerHeight}px`);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);


  return (
    <div style={{ height: viewportHeight, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <AppNav />

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{ width: sidebarOpen ? 240 : 0, background: C.surface, borderRight: sidebarOpen ? `1px solid ${C.border}` : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', transition: 'width 0.22s ease' }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {favorisPanelOpen ? (
              <button onClick={() => setFavorisPanelOpen(false)} title="Retour à l'arborescence" style={{ ...s.treeCtrlBtn, color: C.accent, borderColor: C.accent44 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, cursor: 'pointer' }} onClick={() => setFavorisPanelOpen(true)}>
                Arborescence
              </span>
            )}
            {!favorisPanelOpen && <>
              <button title="Tout déplier" onClick={() => setExpanded(collectExpandableIds(tree))} style={s.treeCtrlBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
              </button>
              <button title="Tout replier" onClick={() => setExpanded(new Set())} style={s.treeCtrlBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 11 12 6 17 11"/><polyline points="7 18 12 13 17 18"/></svg>
              </button>
            </>}
            <button
              title={favorisPanelOpen ? 'Fermer les favoris' : 'Favoris'}
              onClick={() => setFavorisPanelOpen(o => !o)}
              style={{ ...s.treeCtrlBtn, color: 'var(--warning)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={favorisPanelOpen ? 'var(--warning)' : 'none'} stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>

          {favorisPanelOpen ? (
            <div className="scrollbar-styled" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Sauvegarder l'état courant */}
              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                {favorisAddOpen ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={favorisNewLabel}
                      onChange={e => setFavorisNewLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveFavori(); if (e.key === 'Escape') setFavorisAddOpen(false); }}
                      placeholder={findNodeLabel(tree, selected ?? '') ?? 'Nom du favori'}
                      style={{ flex: 1, fontSize: 11, background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 4, color: C.text, padding: '4px 7px', outline: 'none' }}
                    />
                    <button onClick={saveFavori} disabled={favorisSaving} style={{ ...s.treeCtrlBtn, color: C.accent }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button onClick={() => setFavorisAddOpen(false)} style={s.treeCtrlBtn}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setFavorisNewLabel(''); setFavorisAddOpen(true); }}
                    disabled={!selected}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-14)', border: `1px solid var(--accent-33)`, borderRadius: 5, padding: '5px 8px', cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.45, color: C.accent, fontSize: 11, fontWeight: 500 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Sauvegarder la sélection courante
                  </button>
                )}
              </div>

              {/* Liste des favoris */}
              {favoris.length === 0 ? (
                <p style={{ padding: '14px 12px', fontSize: 11, color: C.muted, margin: 0, fontStyle: 'italic' }}>Aucun favori enregistré.</p>
              ) : (
                <div style={{ padding: '4px 0' }}>
                  {favoris.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, margin: '1px 4px' }}>
                      {favorisRenaming === f.id ? (
                        <input
                          autoFocus
                          value={favorisRenameVal}
                          onChange={e => setFavorisRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameFavori(f.id); if (e.key === 'Escape') setFavorisRenaming(null); }}
                          onBlur={() => renameFavori(f.id)}
                          style={{ flex: 1, fontSize: 11, background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 4, color: C.text, padding: '3px 6px', outline: 'none' }}
                        />
                      ) : (
                        <button
                          onClick={() => applyFavori(f)}
                          title="Naviguer vers ce favori"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--warning)" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          <span style={{ fontSize: 11, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                        </button>
                      )}
                      <button onClick={() => { setFavorisRenaming(f.id); setFavorisRenameVal(f.label); }} style={{ ...s.treeCtrlBtn, flexShrink: 0 }} title="Renommer">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => deleteFavori(f.id)} style={{ ...s.treeCtrlBtn, flexShrink: 0, color: 'var(--danger)' }} title="Supprimer">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="scrollbar-styled" style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                    <Spinner size={26} />
                    <span style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>Chargement de l'arborescence…</span>
                  </div>
                </div>
              )}
              {!loading && tree.length === 0 && <p style={{ padding: '14px 12px', fontSize: 12, color: C.muted, margin: 0 }}>Aucun site disponible.</p>}
              {tree.map(node => (
                <TreeItem key={node.id} node={node} depth={0} expanded={expanded} selected={selected} onToggle={toggleNode} onSelect={setSelected} onDoubleClick={handleNodeDoubleClick} />
              ))}
            </div>
          )}
        </aside>

        {/* TOGGLE STRIP */}
        <SidebarToggle open={sidebarOpen} onClick={() => setSidebarOpen(o => !o)} />

        {/* MAP */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── En-tête géo calques de site (toujours visible quand chargés) ── */}
          {!planViewer && !!geoSiteNom && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

              {/* Ligne principale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>

                {geoInstNom ? (
                  /* ── Mode installation : breadcrumb Site / Installation ── */
                  <>
                    <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{geoSiteNom}</span>
                    <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>/</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flexShrink: 0 }}>{geoInstNom}</span>
                  </>
                ) : (
                  /* ── Mode site : nom + dropdown calques + boutons ── */
                  <>
                    {geoSiteNom && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flexShrink: 0 }}>{geoSiteNom}</span>
                    )}
                    <div style={{ position: 'relative', width: '35%', flexShrink: 0, marginLeft: 'auto' }}>
                      <button
                        onClick={() => setGeoCalquesDropOpen(o => !o)}
                        style={{ width: '100%', height: 26, background: C.surface, border: `1px solid ${geoCalquesDropOpen ? C.accent : C.border}`, borderRadius: 4, color: calquesActif ? C.text : C.muted, fontSize: 11, padding: '0 6px 0 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {calquesList.find(c => c.id === calquesActif)?.nom ?? '— Aucun calque associé —'}
                        </span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: geoCalquesDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {geoCalquesDropOpen && (
                        <>
                          <div onClick={() => setGeoCalquesDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, zIndex: 200, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.45)' }}>
                            {calquesList.length === 0 && (
                              <div style={{ padding: '8px 10px', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>Aucun calque</div>
                            )}
                            {calquesList.map(c => {
                              const isVisible = calquesVisible[c.id] ?? true;
                              const isActif   = calquesActif === c.id;
                              return (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', background: isActif ? C.accent14 : 'transparent', borderBottom: `1px solid ${C.border20}` }}>
                                  <button
                                    title={isVisible ? 'Masquer' : 'Afficher'}
                                    onClick={e => { e.stopPropagation(); setCalquesVisible(prev => ({ ...prev, [c.id]: !isVisible })); }}
                                    style={{ width: 22, height: 22, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isVisible ? C.accent : C.muted, flexShrink: 0, padding: 0, borderRadius: 3 }}
                                  >
                                    {isVisible
                                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    }
                                  </button>
                                  <span
                                    onClick={() => { setCalquesActif(isActif ? null : c.id); setGeoAddMode(false); setGeoMoveMode(false); setGeoPendingPos(null); setGeoCalquesDropOpen(false); }}
                                    style={{ flex: 1, fontSize: 11, color: isActif ? C.text : (isVisible ? C.muted : `${C.muted88}`), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                                  >
                                    {c.nom}
                                  </span>
                                  <span style={{ fontSize: 10, color: C.muted, background: C.border, borderRadius: 8, padding: '1px 5px', flexShrink: 0, marginLeft: 2 }}>
                                    {(geoPointsMap[c.id] ?? []).length}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {canEditGeo && <button
                      onClick={() => { const next = !geoAddMode; setGeoAddMode(next); setPlanSelectedPoint(null); if (next) { setGeoMoveMode(false); setGeoPendingPos(null); } }}
                      title={geoAddMode ? 'Annuler ajout' : 'Ajouter un point'}
                      disabled={!calquesActif}
                      style={{ ...s.planZoomBtn, color: geoAddMode ? C.accent : C.muted, borderColor: geoAddMode ? C.accent : C.border }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    </button>}
                    {canEditGeo && <button
                      onClick={() => { const next = !geoMoveMode; setGeoMoveMode(next); if (next) { setGeoAddMode(false); setGeoPendingPos(null); setPlanSelectedPoint(null); } }}
                      title={geoMoveMode ? 'Annuler déplacement' : 'Déplacer un point'}
                      disabled={!calquesActif}
                      style={{ ...s.planZoomBtn, color: geoMoveMode ? C.accent : C.muted, borderColor: geoMoveMode ? C.accent : C.border }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
                    </button>}
                    <button
                      onClick={() => { const calque = calquesList.find(c => c.id === calquesActif); if (calque) exportCalqueExcel(calque, geoPointsMap[calquesActif!] ?? []); }}
                      title="Exporter les points (Excel)"
                      disabled={!calquesActif || !canDownloadGeo}
                      style={{ ...s.planZoomBtn, color: C.muted, opacity: (!calquesActif || !canDownloadGeo) ? 0.35 : 1 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button
                      onClick={() => { setPointsListMode('geo'); setShowPointsListModal(true); }}
                      title="Liste des points"
                      disabled={!calquesActif}
                      style={{ ...s.planZoomBtn, opacity: !calquesActif ? 0.35 : 1 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => { setCalquePdfMode('geo'); setShowCalquePdfModal(true); setCalqueFichiers([]); setCalquePdfError(null); setCalquePdfShowUpload(false); setCalquePdfEditId(null); if (calquesActif) { setCalqueFichiersLoading(true); db.listFichiersCalque(calquesActif).then(r => setCalqueFichiers(r.data)).catch(() => {}).finally(() => setCalqueFichiersLoading(false)); } }}
                      title="Fichiers PDF du calque"
                      disabled={!calquesActif}
                      style={{ ...s.planZoomBtn, opacity: !calquesActif ? 0.35 : 1 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/>
                      </svg>
                    </button>
                  </>
                )}

                <button
                  onClick={() => { setCalquesList([]); setGeoPointsMap({}); setGeoSiteNom(''); setGeoInstNom(''); setCalquesActif(null); setGeoAddMode(false); setGeoMoveMode(false); setGeoPendingPos(null); setPlanSelectedPoint(null); }}
                  title="Fermer"
                  style={{ ...s.planZoomBtn, marginLeft: geoInstNom ? 'auto' : 4 }}
                >×</button>
              </div>

              {/* Sous-barre contextuelle : formulaire pending OU instructions mode */}
              {geoPendingPos ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>Nouveau point :</span>
                  <input autoFocus value={geoPendingNom} onChange={e => setGeoPendingNom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNewGeoPoint(); if (e.key === 'Escape') setGeoPendingPos(null); }}
                    placeholder="Nom du point…"
                    style={{ flex: 1, height: 24, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, padding: '0 8px', outline: 'none', minWidth: 0 }} />
                  <button onClick={handleSaveNewGeoPoint} disabled={geoSaving || !geoPendingNom.trim()}
                    style={{ height: 24, padding: '0 10px', background: C.accent, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#fff', opacity: geoSaving || !geoPendingNom.trim() ? 0.5 : 1, flexShrink: 0 }}>
                    {geoSaving ? '…' : 'Créer'}
                  </button>
                  <button onClick={() => setGeoPendingPos(null)} style={{ height: 24, width: 24, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 14, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>
              ) : geoAddMode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  <span style={{ fontSize: 11, color: C.muted }}>Cliquez sur la carte pour placer un point</span>
                </div>
              ) : geoMoveMode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
                  <span style={{ fontSize: 11, color: C.muted }}>Faites glisser un point pour le repositionner</span>
                </div>
              ) : null}

            </div>
          )}

          {/* Zone carte + overlays */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Leaflet isolé dans son propre stacking context → ses panes internes (z-index 200-700) ne débordent pas */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
          </div>

          {/* Plan SVG overlay — Leaflet CRS.Simple */}
          {planViewer && (
            <div style={{ position: 'absolute', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', zIndex: 500 }}>
              {/* Header */}
              <div ref={el => { (planToolbarRef as React.MutableRefObject<HTMLDivElement | null>).current = el; if (el) setPlanToolbarH(el.offsetHeight); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                {planSiteNom && <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{planSiteNom}</span>}
                {planSiteNom && <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>/</span>}
                {planInstNom && <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{planInstNom}</span>}
                {planInstNom && <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>/</span>}
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flexShrink: 0 }}>{planViewer.nom}</span>
                {planCalques.length > 0 && (
                  <div style={{ position: 'relative', width: '35%', flexShrink: 0, marginLeft: 'auto' }}>
                    <button
                      ref={planCalquesBtnRef}
                      onClick={() => setPlanCalquesDropOpen(o => !o)}
                      style={{ width: '100%', height: 26, background: C.surface, border: `1px solid ${planCalquesDropOpen ? C.accent : C.border}`, borderRadius: 4, color: planSelCalqueId ? C.text : C.muted, fontSize: 11, padding: '0 6px 0 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {planCalques.find(c => c.id === planSelCalqueId)?.nom ?? '— Calques —'}
                      </span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: planCalquesDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {planCalquesDropOpen && (() => {
                      const r = planCalquesBtnRef.current?.getBoundingClientRect();
                      return (
                      <>
                        <div onClick={() => setPlanCalquesDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                        <div style={{ position: 'fixed', top: r ? r.bottom + 2 : 0, left: r ? r.left : 0, width: r ? r.width : 0, zIndex: 9999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.45)' }}>
                          {planCalques.map(c => {
                            const isVisible = calquesVisible[c.id] ?? true;
                            const isActif   = planSelCalqueId === c.id;
                            return (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', background: isActif ? C.accent14 : 'transparent', borderBottom: `1px solid ${C.border20}` }}>
                                <button
                                  title={isVisible ? 'Masquer' : 'Afficher'}
                                  onClick={e => { e.stopPropagation(); setCalquesVisible(prev => ({ ...prev, [c.id]: !isVisible })); }}
                                  style={{ width: 22, height: 22, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isVisible ? C.accent : C.muted, flexShrink: 0, padding: 0, borderRadius: 3 }}
                                >
                                  {isVisible
                                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                  }
                                </button>
                                <span
                                  onClick={() => { setPlanSelCalqueId(c.id); setPlanCalquesDropOpen(false); }}
                                  style={{ flex: 1, fontSize: 11, color: isActif ? C.text : (isVisible ? C.muted : `${C.muted88}`), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                                >
                                  {c.nom}
                                </span>
                                <span style={{ fontSize: 10, color: C.muted, background: C.border, borderRadius: 8, padding: '1px 5px', flexShrink: 0, marginLeft: 2 }}>
                                  {(planPointsMap[c.id] ?? []).length}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                      );
                    })()}
                  </div>
                )}
                {canEditPlan && <button
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
                </button>}
                {canEditPlan && <button
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
                </button>}
                <button onClick={() => { if (planViewer.width && planViewer.height) planMapRef.current?.fitBounds([[0,0],[planViewer.height, planViewer.width]], { padding: [20,20] }); }} title="Ajuster" style={s.planZoomBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button
                  onClick={() => { const calque = planCalques.find(c => c.id === planSelCalqueId); if (calque) exportCalqueExcel(calque, planPointsMap[planSelCalqueId!] ?? []); }}
                  title="Exporter les points (Excel)"
                  disabled={!planSelCalqueId || !canDownloadPlan}
                  style={{ ...s.planZoomBtn, color: C.muted, opacity: (!planSelCalqueId || !canDownloadPlan) ? 0.35 : 1 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button
                  onClick={() => { setPointsListMode('plan'); setShowPointsListModal(true); }}
                  title="Liste des points"
                  disabled={!planSelCalqueId}
                  style={{ ...s.planZoomBtn, opacity: !planSelCalqueId ? 0.35 : 1 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </button>
                <button
                  onClick={() => { setCalquePdfMode('plan'); setShowCalquePdfModal(true); setCalqueFichiers([]); setCalquePdfError(null); setCalquePdfShowUpload(false); setCalquePdfEditId(null); if (planSelCalqueId) { setCalqueFichiersLoading(true); db.listFichiersCalque(planSelCalqueId).then(r => setCalqueFichiers(r.data)).catch(() => {}).finally(() => setCalqueFichiersLoading(false)); } }}
                  title="Fichiers PDF du calque"
                  disabled={!planSelCalqueId}
                  style={{ ...s.planZoomBtn, opacity: !planSelCalqueId ? 0.35 : 1 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/>
                  </svg>
                </button>
                <button onClick={() => { setPlanViewer(null); setPlanAddMode(false); setPlanMoveMode(false); setPlanPendingPos(null); setPlanSelectedPoint(null); setPlanSiteNom(''); setPlanInstNom(''); }} title="Fermer" style={{ ...s.planZoomBtn, marginLeft: 4 }}>×</button>
              </div>

              {/* Message d'aide — mode ajout */}
              {planAddMode && !planPendingPos && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  <span style={{ fontSize: 11, color: C.muted }}>Cliquez sur le plan pour placer un point</span>
                </div>
              )}

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

              {/* Conteneur Leaflet CRS.Simple */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                <div ref={planMapContainerRef} style={{ position: 'absolute', inset: 0 }} />
              </div>
            </div>
          )}

          {/* ── Modale liste des points du calque actif ── */}
          {showPointsListModal && (() => {
            const isGeoMode  = pointsListMode === 'geo';
            const activeId   = isGeoMode ? calquesActif : planSelCalqueId;
            if (!activeId) return null;
            const calque   = isGeoMode ? calquesList.find(c => c.id === activeId) : planCalques.find(c => c.id === activeId);
            const pts      = (isGeoMode ? geoPointsMap[activeId] : planPointsMap[activeId]) ?? [];
            const panTo    = (p: Point) => isGeoMode ? mapRef.current?.panTo([p.coord_y_ou_lat, p.coord_x_ou_lon]) : planMapRef.current?.panTo([p.coord_y_ou_lat, p.coord_x_ou_lon]);
            const color    = safeColor(calque?.couleur ?? C.accent);
            const allKeys  = Array.from(new Set(pts.flatMap(p => Object.keys(resolveChampSource(p.champs)).filter(k => !EXCLUDED_PROPS.has(k)))));
            const columns  = ['__nom__', ...allKeys];
            const getColW  = (key: string) => colWidths[key] ?? (key === '__nom__' ? 180 : 150);
            const colTpl   = columns.map(k => `${getColW(k)}px`).join(' ');

            const startResize = (key: string, e: React.MouseEvent) => {
              e.preventDefault();
              colResizeRef.current = { key, startX: e.clientX, startW: getColW(key) };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              const onMove = (ev: MouseEvent) => {
                if (!colResizeRef.current) return;
                const delta = ev.clientX - colResizeRef.current.startX;
                const newW  = Math.max(60, colResizeRef.current.startW + delta);
                setColWidths(prev => ({ ...prev, [colResizeRef.current!.key]: newW }));
              };
              const onUp = () => {
                colResizeRef.current = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            };

            const getVal = (p: Point, key: string) =>
              key === '__nom__' ? p.nom : String(resolveChampSource(p.champs)[key] ?? '');

            const uniqueVals = (key: string) =>
              [...new Set(pts.map(p => getVal(p, key)))].sort((a, b) => a.localeCompare(b, 'fr'));

            const filteredPts = pts.filter(p =>
              Object.entries(pointsFilters).every(([key, allowed]) => allowed.has(getVal(p, key)))
            );

            const isFiltered = (key: string) => key in pointsFilters;
            const hasFilters = Object.keys(pointsFilters).length > 0;

            const toggleVal = (key: string, val: string) => {
              setPointsFilters(prev => {
                const all  = uniqueVals(key);
                const cur  = prev[key] ?? new Set(all);
                const next = new Set(cur);
                if (next.has(val)) next.delete(val); else next.add(val);
                if (next.size === all.length) { const { [key]: _, ...rest } = prev; return rest; }
                return { ...prev, [key]: next };
              });
            };

            const toggleAll = (key: string) => {
              setPointsFilters(prev => {
                if (isFiltered(key)) { const { [key]: _, ...rest } = prev; return rest; }
                return { ...prev, [key]: new Set<string>() };
              });
            };

            const ROW_H = 32;
            const cellStyle = (key: string): React.CSSProperties => ({
              height: ROW_H, padding: '0 10px', fontSize: 12,
              color: key === '__nom__' ? C.text : C.muted,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              borderBottom: `1px solid ${C.border20}`,
              fontWeight: key === '__nom__' ? 600 : 400,
              boxSizing: 'border-box',
            });

            return (
              <Modal
                title={`Points — ${calque?.nom ?? ''} (${filteredPts.length}/${pts.length})`}
                onClose={() => { setShowPointsListModal(false); setFilterDropKey(null); setPointsFilters({}); }}
                maxWidth={900}
                draggable
                footer={
                  <div className="modal-footer">
                    {hasFilters && (
                      <button className="modal-btn modal-btn-cancel" onClick={() => setPointsFilters({})}>
                        Effacer les filtres
                      </button>
                    )}
                    <button className="modal-btn modal-btn-cancel" onClick={() => { setShowPointsListModal(false); setFilterDropKey(null); setPointsFilters({}); }}>Fermer</button>
                  </div>
                }
              >
                {/* Annule le padding du corps modal pour un tableau pleine largeur */}
                <div style={{ margin: -22 }}>
                  {pts.length === 0 ? (
                    <p style={{ margin: 0, padding: 22, color: C.muted, fontSize: 13 }}>Aucun point dans ce calque.</p>
                  ) : (
                    <>
                      {/* En-tête colonnes avec filtres + poignées de redimensionnement */}
                      <div style={{ display: 'grid', gridTemplateColumns: colTpl, borderBottom: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden' }}>
                        {columns.map(key => {
                          const active = isFiltered(key);
                          return (
                            <div key={key} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px 8px 10px', overflow: 'hidden' }}>
                              <span style={{ flex: 1, fontSize: 11, color: active ? C.accent : C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>
                                {key === '__nom__' ? 'Nom' : key}
                              </span>
                              <button
                                ref={el => { if (el) filterBtnRefs.current.set(key, el); else filterBtnRefs.current.delete(key); }}
                                onClick={e => { e.stopPropagation(); setFilterSearch(''); setFilterDropKey(k => k === key ? null : key); }}
                                title="Filtrer"
                                style={{ width: 20, height: 20, background: active ? C.accent14 : 'transparent', border: `1px solid ${active ? C.accent44 : C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? C.accent : C.muted, padding: 0, flexShrink: 0 }}
                              >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                                </svg>
                              </button>
                              {/* Poignée redimensionnement */}
                              <div
                                onMouseDown={e => startResize(key, e)}
                                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2, background: 'transparent' }}
                                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.accent44}
                                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Corps scrollable */}
                      <div className="scrollbar-styled" style={{ overflowY: 'auto', maxHeight: ROW_H * 10 }}>
                        {filteredPts.length === 0 ? (
                          <div style={{ padding: '16px 22px', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Aucun résultat pour les filtres actifs.</div>
                        ) : filteredPts.map(p => {
                          const isSel = planSelectedPoint?.id === p.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => { setPlanSelectedPoint(p); setPlanPanelCollapsed(false); panTo(p); }}
                              style={{ display: 'grid', gridTemplateColumns: colTpl, background: isSel ? C.accent14 : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = C.surface2; }}
                              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = isSel ? C.accent14 : 'transparent'; }}
                            >
                              {columns.map((key, i) => (
                                <div key={key} style={{ ...cellStyle(key), display: 'flex', alignItems: 'center', gap: i === 0 ? 8 : 0 }}>
                                  {i === 0 && <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {getVal(p, key) || <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {/* Dropdown filtre (position fixed) */}
                      {filterDropKey && (() => {
                        const r    = filterBtnRefs.current.get(filterDropKey)?.getBoundingClientRect();
                        const vals = uniqueVals(filterDropKey);
                        const shown = filterSearch ? vals.filter(v => v.toLowerCase().includes(filterSearch.toLowerCase())) : vals;
                        const active  = pointsFilters[filterDropKey];
                        const allSel  = !active || vals.every(v => active.has(v));
                        return (
                          <>
                            <div onClick={() => setFilterDropKey(null)} style={{ position: 'fixed', inset: 0, zIndex: 1001 }} />
                            <div style={{ position: 'fixed', top: r ? r.bottom + 2 : 0, left: r ? r.left : 0, width: 240, zIndex: 1002, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                                <input
                                  autoFocus
                                  value={filterSearch}
                                  onChange={e => setFilterSearch(e.target.value)}
                                  placeholder="Rechercher une valeur…"
                                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, padding: '5px 8px', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                              <div
                                onClick={e => { e.stopPropagation(); toggleAll(filterDropKey); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.surface2}
                                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                              >
                                <input type="checkbox" checked={allSel} onChange={() => toggleAll(filterDropKey)} onClick={e => e.stopPropagation()} style={{ accentColor: C.accent, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: C.text, fontStyle: 'italic' }}>(Tout sélectionner)</span>
                              </div>
                              <div className="scrollbar-styled" style={{ maxHeight: 220, overflowY: 'auto' }}>
                                {shown.map(val => {
                                  const checked = !active || active.has(val);
                                  return (
                                    <div
                                      key={val}
                                      onClick={e => { e.stopPropagation(); toggleVal(filterDropKey, val); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.surface2}
                                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    >
                                      <input type="checkbox" checked={checked} onChange={() => toggleVal(filterDropKey, val)} onClick={e => e.stopPropagation()} style={{ accentColor: C.accent, flexShrink: 0 }} />
                                      <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {val || <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              </Modal>
            );
          })()}

          {/* ── Modal fichiers PDF du calque ── */}
          {showCalquePdfModal && (() => {
            const isGeo           = calquePdfMode === 'geo';
            const activeCalqueId  = isGeo ? calquesActif : planSelCalqueId;
            const activeCalque    = isGeo
              ? calquesList.find(c => c.id === activeCalqueId)
              : planCalques.find(c => c.id === activeCalqueId);
            const canEdit         = isGeo ? canEditGeo : canEditPlan;
            if (!activeCalqueId) return null;

            async function handleDeleteFichier(id: string) {
              setCalquePdfError(null);
              try {
                await db.removeFichierCalque(id);
                setCalqueFichiers(prev => prev.filter(f => f.id !== id));
                setCalquePdfDeleteId(null);
              } catch (e) {
                setCalquePdfError(extractErrorMessage(e));
              }
            }

            async function handleSaveEdit() {
              if (!calquePdfEditId) return;
              setCalquePdfUploading(true); setCalquePdfError(null);
              try {
                const res = await db.updateFichierCalque(calquePdfEditId, {
                  nom: calquePdfFormNom.trim(),
                  description: calquePdfFormDesc.trim() || null,
                  is_downloadable: calquePdfFormDl,
                });
                setCalqueFichiers(prev => prev.map(f => f.id === calquePdfEditId ? { ...f, ...res.data } : f));
                setCalquePdfEditId(null);
              } catch (e) {
                setCalquePdfError(extractErrorMessage(e));
              } finally { setCalquePdfUploading(false); }
            }

            async function handleUpload() {
              if (!calquePdfFile || !activeCalqueId) return;
              setCalquePdfUploading(true); setCalquePdfError(null);
              try {
                const res = await db.uploadCalquePdf(calquePdfFile, activeCalqueId, {
                  nom: calquePdfFormNom.trim() || calquePdfFile.name,
                  description: calquePdfFormDesc.trim() || undefined,
                  is_downloadable: calquePdfFormDl,
                });
                setCalqueFichiers(prev => [...prev, res.data.record]);
                setCalquePdfShowUpload(false);
                setCalquePdfFile(null);
                setCalquePdfFormNom(''); setCalquePdfFormDesc(''); setCalquePdfFormDl(false);
              } catch (e) {
                setCalquePdfError(extractErrorMessage(e));
              } finally { setCalquePdfUploading(false); }
            }

            function openEdit(f: FichierCalque) {
              setCalquePdfEditId(f.id);
              setCalquePdfFormNom(f.nom);
              setCalquePdfFormDesc(f.description ?? '');
              setCalquePdfFormDl(f.is_downloadable);
              setCalquePdfShowUpload(false);
            }

            const inlineFormStyle: React.CSSProperties = {
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8,
            };
            const labelStyle: React.CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 3, display: 'block' };
            const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, boxSizing: 'border-box' };

            return (
              <Modal
                title={`PDF — ${activeCalque?.nom ?? ''}`}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/>
                  </svg>
                }
                onClose={() => { setShowCalquePdfModal(false); setCalquePdfDeleteId(null); setCalquePdfEditId(null); setCalquePdfShowUpload(false); setCalquePdfError(null); }}
                maxWidth={700}
                draggable
                error={calquePdfError ?? undefined}
                footer={
                  <div className="modal-footer">
                    {canEdit && !calquePdfShowUpload && !calquePdfEditId && (
                      <button
                        className="modal-btn modal-btn-save"
                        onClick={() => { setCalquePdfShowUpload(true); setCalquePdfEditId(null); setCalquePdfFormNom(''); setCalquePdfFormDesc(''); setCalquePdfFormDl(false); setCalquePdfFile(null); }}
                      >
                        + Ajouter un PDF
                      </button>
                    )}
                    <button className="modal-btn modal-btn-cancel" onClick={() => { setShowCalquePdfModal(false); setCalquePdfDeleteId(null); setCalquePdfEditId(null); setCalquePdfShowUpload(false); setCalquePdfError(null); }}>Fermer</button>
                  </div>
                }
              >
                {calqueFichiersLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
                ) : calqueFichiers.length === 0 && !calquePdfShowUpload ? (
                  <div style={{ padding: '12px 0', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>Aucun fichier PDF associé à ce calque.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {calqueFichiers.map((f, idx) => (
                      <div key={f.id}>
                        {calquePdfDeleteId === f.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: C.errorBg, border: `1px solid ${C.danger44}`, borderRadius: 8, marginBottom: 4 }}>
                            <span style={{ flex: 1, fontSize: 12, color: C.danger }}>Supprimer <strong>{f.nom}</strong> ? Action irréversible.</span>
                            <button className="modal-btn" style={{ padding: '4px 12px', fontSize: 12, background: '#C0392B', color: '#fff', border: '1px solid #C0392B' }} onClick={() => handleDeleteFichier(f.id)}>Supprimer</button>
                            <button className="modal-btn modal-btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setCalquePdfDeleteId(null)}>Annuler</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', borderBottom: idx < calqueFichiers.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nom}</div>
                              {f.description && <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</div>}
                            </div>
                            {f.is_downloadable && (
                              <span style={{ fontSize: 10, color: C.accent, flexShrink: 0, padding: '2px 6px', background: C.accent18, borderRadius: 4 }}>DL</span>
                            )}
                            <button
                              title="Voir le PDF"
                              onClick={() => f.storage_public_url && setPdfViewer({ url: f.storage_public_url, nom: f.nom, isUploadable: f.can_download })}
                              disabled={!f.storage_public_url}
                              style={{ ...s.planZoomBtn, flexShrink: 0 }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            {f.can_download && f.storage_public_url && (
                              <a
                                href={f.storage_public_url}
                                download={f.nom}
                                target="_blank"
                                rel="noreferrer"
                                title="Télécharger"
                                style={{ ...s.planZoomBtn, flexShrink: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </a>
                            )}
                            {canEdit && (
                              <button title="Modifier" onClick={() => openEdit(f)} style={{ ...s.planZoomBtn, flexShrink: 0, color: calquePdfEditId === f.id ? C.accent : C.muted, borderColor: calquePdfEditId === f.id ? C.accent : C.border }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            )}
                            {canEdit && (
                              <button title="Supprimer" onClick={() => { setCalquePdfDeleteId(f.id); setCalquePdfEditId(null); setCalquePdfShowUpload(false); }} style={{ ...s.planZoomBtn, flexShrink: 0, color: C.danger }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            )}
                          </div>
                        )}
                        {/* Formulaire d'édition inline */}
                        {calquePdfEditId === f.id && (
                          <div style={inlineFormStyle}>
                            <div><label style={labelStyle}>Nom</label><input style={inputStyle} value={calquePdfFormNom} onChange={e => setCalquePdfFormNom(e.target.value)} /></div>
                            <div><label style={labelStyle}>Description</label><input style={inputStyle} value={calquePdfFormDesc} onChange={e => setCalquePdfFormDesc(e.target.value)} /></div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                              <div
                                style={{ width: 42, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, background: calquePdfFormDl ? C.primary : '#2D3A52' }}
                                onClick={() => setCalquePdfFormDl(v => !v)}
                              >
                                <div style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'transform 0.2s', transform: calquePdfFormDl ? 'translateX(18px)' : 'translateX(2px)' }} />
                              </div>
                              <span style={{ fontSize: 13, color: C.text }}>{calquePdfFormDl ? 'Téléchargeable par les utilisateurs' : 'Non téléchargeable'}</span>
                            </label>
                            <div className="modal-footer" style={{ marginTop: 4 }}>
                              <button className="modal-btn modal-btn-cancel" onClick={() => setCalquePdfEditId(null)} disabled={calquePdfUploading}>Annuler</button>
                              <button className="modal-btn modal-btn-save" onClick={handleSaveEdit} disabled={calquePdfUploading}>
                                {calquePdfUploading ? <><Spinner size={13} /> Enregistrement…</> : 'Enregistrer'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulaire d'ajout */}
                {calquePdfShowUpload && (
                  <div style={{ ...inlineFormStyle, marginTop: calqueFichiers.length > 0 ? 12 : 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Ajouter un fichier PDF</div>
                    <input
                      ref={calquePdfFileInputRef}
                      type="file" accept=".pdf,application/pdf"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0] ?? null; setCalquePdfFile(f); if (f && !calquePdfFormNom) setCalquePdfFormNom(f.name.replace(/\.pdf$/i, '')); }}
                    />
                    <div
                      onDragOver={e => { e.preventDefault(); setCalquePdfDragOver(true); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCalquePdfDragOver(false); }}
                      onDrop={e => { e.preventDefault(); setCalquePdfDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setCalquePdfFile(f); if (!calquePdfFormNom) setCalquePdfFormNom(f.name.replace(/\.pdf$/i, '')); } }}
                      onClick={() => !calquePdfUploading && calquePdfFileInputRef.current?.click()}
                      style={{ border: `2px dashed ${calquePdfDragOver ? C.accent : C.border}`, borderRadius: 8, padding: '18px 12px', textAlign: 'center' as const, cursor: calquePdfUploading ? 'default' : 'pointer', background: calquePdfDragOver ? '#378ADD0D' : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}
                    >
                      {calquePdfFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{calquePdfFile.name}</span>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, lineHeight: 1, padding: 2 }}
                            onClick={e => { e.stopPropagation(); setCalquePdfFile(null); }}
                            title="Retirer"
                          >×</button>
                        </div>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={calquePdfDragOver ? C.accent : C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                          </svg>
                          <div style={{ fontSize: 12, color: calquePdfDragOver ? C.accent : C.muted }}>Glissez un PDF ici</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ou cliquez pour sélectionner</div>
                        </>
                      )}
                    </div>
                    <div><label style={labelStyle}>Nom</label><input style={inputStyle} value={calquePdfFormNom} onChange={e => setCalquePdfFormNom(e.target.value)} placeholder="Nom du document…" /></div>
                    <div><label style={labelStyle}>Description</label><input style={inputStyle} value={calquePdfFormDesc} onChange={e => setCalquePdfFormDesc(e.target.value)} placeholder="Description (optionnel)" /></div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                      <div
                        style={{ width: 42, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, background: calquePdfFormDl ? C.primary : '#2D3A52' }}
                        onClick={() => setCalquePdfFormDl(v => !v)}
                      >
                        <div style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'transform 0.2s', transform: calquePdfFormDl ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </div>
                      <span style={{ fontSize: 13, color: C.text }}>{calquePdfFormDl ? 'Téléchargeable par les utilisateurs' : 'Non téléchargeable'}</span>
                    </label>
                    <div className="modal-footer" style={{ marginTop: 4 }}>
                      <button className="modal-btn modal-btn-cancel" onClick={() => { setCalquePdfShowUpload(false); setCalquePdfFile(null); setCalquePdfFormNom(''); setCalquePdfFormDesc(''); setCalquePdfFormDl(false); }} disabled={calquePdfUploading}>Annuler</button>
                      <button className="modal-btn modal-btn-save" onClick={handleUpload} disabled={!calquePdfFile || calquePdfUploading}>
                        {calquePdfUploading ? <><Spinner size={13} /> Enregistrement…</> : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}
              </Modal>
            );
          })()}

          {/* ── Panel latéral point sélectionné (plan ET géo) ── */}
          {planSelectedPoint && (() => {
            const source = resolveChampSource(planSelectedPoint.champs);
            const entries = Object.entries(source).filter(([k]) => !EXCLUDED_PROPS.has(k));
            const calqueNom = [...planCalques, ...calquesList].find(c => c.id === planSelectedPoint.calque_id)?.nom;
            return (
              <div style={{ position: 'absolute', right: 0, top: planViewer ? planToolbarH : 0, bottom: 0, display: 'flex', zIndex: planViewer ? 600 : 10 }}>
                    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
                      <PointPanelToggle collapsed={planPanelCollapsed} onClick={() => setPlanPanelCollapsed(c => !c)} />
                      <div style={{ width: planPanelCollapsed ? 0 : 300, background: C.surface2, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.22s ease', flexShrink: 0 }}>

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
                              {canEditSelectedPoint && <button onClick={enterEditMode} title="Modifier" style={s.panelIconBtn}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>}
                              {/* Supprimer */}
                              {canEditSelectedPoint && (
                                <button onClick={() => { setDeletePointError(null); setPlanDeleteConfirm(true); }} title="Supprimer" style={s.panelIconBtn}>
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
                                <div key={key} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border20}` }}>
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
                                        <td style={{ padding: '9px 14px', color: C.muted, borderBottom: `1px solid ${C.border20}`, width: '44%', fontWeight: 500, verticalAlign: 'top', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{key}</td>
                                        <td style={{ padding: '9px 14px', color: C.text, borderBottom: `1px solid ${C.border20}`, wordBreak: 'break-word' }}>
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
                                <div style={{ borderTop: `2px solid ${C.muted}`, marginTop: 10, padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fichiers PDF</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: C.accent, background: 'var(--accent-18)', borderRadius: 10, padding: '1px 6px', lineHeight: '14px' }}>{pointPdfs.length}</span>
                                  </div>
                                  <div className={pointPdfs.length > 4 ? 'scrollbar-styled' : ''} style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', ...(pointPdfs.length > 4 ? { maxHeight: 140, overflowY: 'auto' } : {}) }}>
                                    {pointPdfs.map((pdf, i) => {
                                      const isPdfSel = selectedPdfId === pdf.id;
                                      return (
                                        <div
                                          key={pdf.id}
                                          onClick={() => setSelectedPdfId(pdf.id)}
                                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < pointPdfs.length - 1 ? `1px solid ${C.border20}` : 'none', background: isPdfSel ? '#378ADD22' : 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isPdfSel ? C.accent : C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                          </svg>
                                          <span style={{ flex: 1, fontSize: 12, color: isPdfSel ? C.text : C.muted, fontWeight: isPdfSel ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.nom}</span>
                                          {pdf.public_url && (
                                            <button
                                              onClick={e => { e.stopPropagation(); setSelectedPdfId(pdf.id); setPdfViewer({ url: pdf.public_url!, nom: pdf.nom, isUploadable: false }); }}
                                              title="Ouvrir"
                                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: isPdfSel ? C.accent : C.muted, flexShrink: 0, padding: 0 }}
                                            >
                                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* ── Carousel photos ── */}
                              {(photosLoading || pointPhotos.length > 0) && (
                                <div style={{ borderTop: `2px solid ${C.muted}`, marginTop: 10, paddingTop: 10 }}>
                                  {photosLoading ? (
                                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ fontSize: 11, color: C.muted }}>Chargement…</span>
                                    </div>
                                  ) : (() => {
                                    const photo = pointPhotos[carouselIndex];
                                    return (
                                      <div style={{ padding: '6px 6px 0' }}><div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
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
                                        </div>
                                        {pointPhotos.length > 1 && (
                                          <div style={{ position: 'absolute', top: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                                            {pointPhotos.map((_, i) => (
                                              <div key={i} onClick={() => setCarouselIndex(i)} style={{ width: i === carouselIndex ? 14 : 6, height: 6, borderRadius: 3, background: i === carouselIndex ? C.accent : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'width 0.2s, background 0.2s' }} />
                                            ))}
                                          </div>
                                        )}
                                      </div></div>
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
                              <div className="scrollbar-styled" style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', maxHeight: 130, overflowY: 'auto' }}>
                                {pointPdfs.map((pdf, i) => {
                                  const isPdfSel = selectedPdfId === pdf.id;
                                  return (
                                  <div key={pdf.id} onClick={() => setSelectedPdfId(pdf.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: i < pointPdfs.length - 1 ? `1px solid ${C.border20}` : 'none', background: isPdfSel ? '#378ADD22' : 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isPdfSel ? C.accent : C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
                                        onClick={e => { e.stopPropagation(); setRenamingId(pdf.id); setRenameValue(pdf.nom); }}
                                        title="Cliquer pour renommer"
                                        style={{ flex: 1, fontSize: 11, color: isPdfSel ? C.text : C.muted, fontWeight: isPdfSel ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}>
                                        {pdf.nom}
                                      </span>
                                    )}
                                    {pdf.public_url && renamingId !== pdf.id && (
                                      <button onClick={e => { e.stopPropagation(); setSelectedPdfId(pdf.id); setPdfViewer({ url: pdf.public_url!, nom: pdf.nom, isUploadable: false }); }} title="Ouvrir"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, color: isPdfSel ? C.accent : C.muted, flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                        </svg>
                                      </button>
                                    )}
                                    <button onClick={e => { e.stopPropagation(); handleDeletePhoto(pdf); }} title="Supprimer"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, flexShrink: 0, padding: 0, fontSize: 14, lineHeight: 1 }}>
                                      ×
                                    </button>
                                  </div>
                                  );
                                })}
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
          </div>
        );
      })()}

          {/* Spinner — chargement favori */}
          {favoriApplying && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ animation: 'spin 0.75s linear infinite' }}>
                  <circle cx="13" cy="13" r="10" stroke={C.border} strokeWidth="2.5"/>
                  <path d="M13 3 A10 10 0 0 1 23 13" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>Chargement du favori…</span>
              </div>
            </div>
          )}

          </div>{/* end zone carte */}

        </div>

        {/* TOOLBAR DROITE */}
        <aside style={{ width: 48, background: C.surface, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0', flexShrink: 0 }}>

          {/* Fond de carte */}
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
          <div style={{ width: 28, height: 1, background: C.muted, margin: '6px 0', opacity: 0.4 }} />

          {/* Zoom */}
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

        </aside>
      </div>

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

      {/* ── Modale suppression point ── */}
      {planDeleteConfirm && planSelectedPoint && (
        <Modal
          title="Confirmation"
          onClose={() => { setPlanDeleteConfirm(false); setDeletePointError(null); }}
          maxWidth={400}
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setPlanDeleteConfirm(false); setDeletePointError(null); }}
                style={{ padding: '6px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeletePoint}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#C0392B', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Supprimer
              </button>
            </div>
          }
        >
          {deletePointError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>
              {deletePointError}
            </div>
          )}
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
            Supprimer le point <strong style={{ color: C.text }}>{planSelectedPoint.nom}</strong> ? Cette action est irréversible.
          </p>
        </Modal>
      )}

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
  toolBtn:     { width: 40, height: 40, background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.muted, transition: 'background 0.15s, color 0.15s' },
  treeCtrlBtn: { width: 22, height: 22, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0, padding: 0 },
  planZoomBtn:  { width: 26, height: 26, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0, padding: 0, fontSize: 14 },
  panelIconBtn: { width: 26, height: 26, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0, padding: 0 },
};
