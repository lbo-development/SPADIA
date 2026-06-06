import { useState, useEffect, useRef } from 'react';
import { db } from '@/api/database';
import type { Plan, FichierPdf } from '@/api/database';

type SiteRaw    = { id: string; nom: string; lat: number | null; lng: number | null; zoom_defaut: number };
type InstRaw    = { id: string; nom: string; site_id: string; lat: number | null; lng: number | null; zoom_defaut: number };
type DossierRaw = { id: string; nom: string; site_id: string | null; installation_id: string | null };

export interface TreeNode {
  id:            string;
  label:         string;
  type:          'site' | 'installation' | 'plan' | 'dossier' | 'calque' | 'fichier' | 'group';
  children?:     TreeNode[];
  fichierUrl?:   string | null;
  isUploadable?: boolean;
  lat?:          number | null;
  lng?:          number | null;
  zoom?:         number;
  svgUrl?:       string | null;
  svgWidth?:     number | null;
  svgHeight?:    number | null;
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) { const f = findNode(node.children, id); if (f) return f; }
  }
  return null;
}

export function findPath(nodes: TreeNode[], targetId: string, path: TreeNode[] = []): TreeNode[] | null {
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

export function collectExpandableIds(nodes: TreeNode[], acc: Set<string> = new Set()): Set<string> {
  for (const n of nodes) {
    if (n.children && n.children.length > 0) {
      acc.add(n.id);
      collectExpandableIds(n.children, acc);
    }
  }
  return acc;
}

export function findNodeLabel(nodes: TreeNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.label;
    if (n.children) { const r = findNodeLabel(n.children, id); if (r) return r; }
  }
  return null;
}

export function findNodeType(nodes: TreeNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.type;
    if (n.children) { const r = findNodeType(n.children, id); if (r) return r; }
  }
  return null;
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

export function useTreeData(locationState: unknown) {
  const pendingNavRef = useRef<{ nodeId: string; expanded: string[] } | null>(
    (locationState as { nodeId?: string; expanded?: string[] } | null)?.nodeId
      ? {
          nodeId:   (locationState as { nodeId: string; expanded: string[] }).nodeId,
          expanded: (locationState as { nodeId: string; expanded: string[] }).expanded ?? [],
        }
      : null
  );

  const [tree,     setTree]     = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [counts,   setCounts]   = useState({ sites: 0, installations: 0, plans: 0, calques: 0 });

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

  useEffect(() => {
    if (tree.length === 0 || !pendingNavRef.current) return;
    const { nodeId, expanded: ids } = pendingNavRef.current;
    pendingNavRef.current = null;
    setExpanded(new Set(ids));
    setSelected(nodeId);
  }, [tree]);

  function toggleNode(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return { tree, expanded, setExpanded, selected, setSelected, loading, counts, toggleNode };
}
