import { Router, Response } from 'express';
import { supabase } from '../supabase/client';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { ROLES } from '../middlewares/roles';

// ── Sélecteurs et helpers pour /data ────────────────────────────────────────

const PV_DASH_SELECT = [
  'id', 'entity_type', 'proposedby_id', 'date_propose', 'payload',
  'site_id', 'installation_id', 'dossier_id', 'plan_id', 'avec_rattachement',
  'statut', 'validateur_id', 'date_validation', 'commentaire_admin',
  'entity_id_created', 'created_at',
  'proposedby:user_profiles!pour_validation_proposedby_id_fkey(nom)',
  'validateur:user_profiles!pour_validation_validateur_id_fkey(nom)',
  'sites(nom)', 'installations(nom)', 'dossiers(nom)', 'plans(nom)',
].join(', ');

function flattenPVDash(row: Record<string, unknown>): Record<string, unknown> {
  const { proposedby, validateur, sites, installations, dossiers, plans, entity_id_created, ...rest } = row;
  return {
    ...rest,
    id_valide:        entity_id_created ?? null,
    proposedby_nom:   (proposedby    as { nom?: string } | null)?.nom ?? '',
    validateur_nom:   (validateur    as { nom?: string } | null)?.nom ?? '',
    site_nom:         (sites         as { nom?: string } | null)?.nom ?? '',
    installation_nom: (installations as { nom?: string } | null)?.nom ?? '',
    dossier_nom:      (dossiers      as { nom?: string } | null)?.nom ?? '',
    plan_nom:         (plans         as { nom?: string } | null)?.nom ?? '',
  };
}

const CALQUE_DASH_SELECT = [
  'id', 'site_id', 'installation_id', 'plan_id', 'nom', 'description',
  'type', 'niveau_accreditation', '"order"', 'owner_id', 'validateur_id',
  'date_validation', 'created_at',
  'sites!calques_site_id_fkey(nom)',
  'installations!calques_installation_id_fkey(nom)',
  // Récupère aussi site_id et installation_id du plan pour la navigation dans l'arborescence
  'plans!calques_plan_id_fkey(nom, site_id, installation_id)',
  'validateur:user_profiles!calques_validateur_id_fkey(nom)',
].join(', ');

type PlanJoinDash = { nom?: string; site_id?: string | null; installation_id?: string | null } | null;

function flattenCalqueDash(row: Record<string, unknown>): Record<string, unknown> {
  const { sites, installations, plans, validateur, ...rest } = row;
  const plan = plans as PlanJoinDash;
  return {
    ...rest,
    site_nom:             (sites         as { nom?: string } | null)?.nom ?? '',
    installation_nom:     (installations as { nom?: string } | null)?.nom ?? '',
    plan_nom:             plan?.nom ?? '',
    validateur_nom:       (validateur    as { nom?: string } | null)?.nom ?? '',
    plan_site_id:         plan?.site_id         ?? null,
    plan_installation_id: plan?.installation_id ?? null,
  };
}

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: userId, role, niveau_accreditation } = req.user!;
  const isAdmin = role === ROLES.ADMIN_APP || role === ROLES.ADMIN_DATA;
  const nivel   = niveau_accreditation ?? 0;

  try {
    /* ── 1. Nombre de sites ─────────────────────────────────────────────────── */
    const { count: sitesTotal } = await supabase
      .from('sites').select('id', { count: 'exact', head: true }).eq('actif', true);

    /* ── 2. Dossiers liés aux sites (total) ────────────────────────────────── */
    const { count: dossiersTotal } = await supabase
      .from('dossiers').select('id', { count: 'exact', head: true })
      .not('site_id', 'is', null).eq('actif', true);

    /* ── 3. Dossiers accessibles + leurs IDs (pour step 4) ─────────────────── */
    let dossiersQuery = supabase
      .from('dossiers').select('id')
      .not('site_id', 'is', null).eq('actif', true);
    if (!isAdmin) dossiersQuery = dossiersQuery.lte('niveau_accreditation', nivel);
    const { data: dossiersAcc, count: dossiersAccessibles } = await dossiersQuery;
    const accDossierIds = (dossiersAcc ?? []).map((d: { id: string }) => d.id);

    /* ── 4. Fichiers dans les dossiers accessibles ──────────────────────────── */
    let fichiersAccessibles = 0;
    if (accDossierIds.length > 0) {
      const { count } = await supabase
        .from('fichiers_pdf').select('id', { count: 'exact', head: true })
        .in('dossier_id', accDossierIds).eq('is_current', true);
      fichiersAccessibles = count ?? 0;
    }

    /* ── 5. Calques liés aux sites, accessibles + leurs IDs ────────────────── */
    let calquesQuery = supabase
      .from('calques').select('id')
      .not('site_id', 'is', null);
    if (!isAdmin) calquesQuery = calquesQuery.lte('niveau_accreditation', nivel);
    const { data: calquesAcc } = await calquesQuery;
    const accCalqueIds = (calquesAcc ?? []).map((c: { id: string }) => c.id);

    /* ── 6. Points dans les calques accessibles ─────────────────────────────── */
    let pointsAccessibles = 0;
    if (accCalqueIds.length > 0) {
      const { count } = await supabase
        .from('points').select('id', { count: 'exact', head: true })
        .in('calque_id', accCalqueIds);
      pointsAccessibles = count ?? 0;
    }

    /* ── 7. Calques dont l'utilisateur est propriétaire ─────────────────────── */
    const { count: calquesOwned } = await supabase
      .from('calques').select('id', { count: 'exact', head: true })
      .not('site_id', 'is', null).eq('owner_id', userId);

    res.json({
      sites_total:           sitesTotal           ?? 0,
      dossiers_total:        dossiersTotal        ?? 0,
      dossiers_accessibles:  dossiersAccessibles  ?? accDossierIds.length,
      fichiers_accessibles:  fichiersAccessibles,
      calques_accessibles:   accCalqueIds.length,
      points_accessibles:    pointsAccessibles,
      calques_owned:         calquesOwned         ?? 0,
    });
  } catch (err) {
    console.error('[dashboard/stats]', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur statistiques.', details: null } });
  }
});

/* ── GET /api/v1/dashboard/data ─────────────────────────────────────────── */
router.get('/data', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: userId, role } = req.user!;

  try {
    // 1. Favoris de l'utilisateur
    const { data: favoris, error: favErr } = await supabase
      .from('favoris').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (favErr) throw favErr;

    // 2. Admin_app : toutes les soumissions (tous statuts)
    let soumis: Record<string, unknown>[] = [];
    if (role === ROLES.ADMIN_APP) {
      const { data, error } = await supabase
        .from('pour_validation').select(PV_DASH_SELECT)
        .order('date_propose', { ascending: false });
      if (error) throw error;
      soumis = (data ?? []).map(r => flattenPVDash(r as Record<string, unknown>));
    }

    // 3. Admin_data : soumissions assignées à sa validation (En attente / A compléter)
    let aValider: Record<string, unknown>[] = [];
    if (role === ROLES.ADMIN_DATA) {
      const { data, error } = await supabase
        .from('pour_validation').select(PV_DASH_SELECT)
        .eq('validateur_id', userId)
        .in('statut', ['En attente', 'A compléter'])
        .order('date_propose', { ascending: false });
      if (error) throw error;
      aValider = (data ?? []).map(r => flattenPVDash(r as Record<string, unknown>));
    }

    // 4. Mes demandes (proposedby = moi, tous statuts)
    const { data: demRaw, error: demErr } = await supabase
      .from('pour_validation').select(PV_DASH_SELECT)
      .eq('proposedby_id', userId)
      .order('date_propose', { ascending: false });
    if (demErr) throw demErr;
    const mesDemandes = (demRaw ?? []).map(r => flattenPVDash(r as Record<string, unknown>));

    // 5. Mes calques (owner = moi)
    const { data: calquesRaw, error: calErr } = await supabase
      .from('calques').select(CALQUE_DASH_SELECT)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (calErr) throw calErr;
    const mesCalques = (calquesRaw ?? []).map(r => flattenCalqueDash(r as Record<string, unknown>));

    res.json({ favoris: favoris ?? [], soumis, aValider, mesDemandes, mesCalques });
  } catch (err) {
    console.error('[dashboard/data]', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur tableau de bord.', details: null } });
  }
});

export default router;
