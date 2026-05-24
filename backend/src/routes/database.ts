import { Router, Response } from 'express';
import multer from 'multer';
import { supabase } from '../supabase/client';
import { supabaseAdmin } from '../supabase/adminClient';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { requireRole, ROLES } from '../middlewares/roles';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
const adminAll = [ROLES.ADMIN_APP, ROLES.ADMIN_DATA];
const adminApp = [ROLES.ADMIN_APP];
const allRoles  = [ROLES.ADMIN_APP, ROLES.ADMIN_DATA, ROLES.USER, ROLES.VIEWER];

function isPrivilegedRole(role: string) {
  return role === ROLES.ADMIN_APP || role === ROLES.ADMIN_DATA || role === ROLES.VIEWER;
}

function crud(
  table: string,
  readRoles: typeof adminAll,
  writeRoles: typeof adminAll,
  selectFields = '*',
) {
  router.get(`/${table}`, authMiddleware, requireRole(readRoles),
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from(table).select(selectFields).order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data ?? []);
      } catch (err) {
        console.error(`[db/${table} GET]`, err);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: `Erreur lecture ${table}.`, details: null } });
      }
    },
  );

  router.post(`/${table}`, authMiddleware, requireRole(writeRoles),
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        const { data, error } = await supabase.from(table).insert(req.body).select(selectFields).single();
        if (error) throw error;
        res.status(201).json(data);
      } catch (err) {
        console.error(`[db/${table} POST]`, err);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création.', details: null } });
      }
    },
  );

  router.patch(`/${table}/:id`, authMiddleware, requireRole(writeRoles),
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from(table).update(req.body).eq('id', req.params.id).select(selectFields).single();
        if (error) throw error;
        res.json(data);
      } catch (err) {
        console.error(`[db/${table} PATCH]`, err);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour.', details: null } });
      }
    },
  );

  router.delete(`/${table}/:id`, authMiddleware, requireRole(writeRoles),
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      try {
        const { error } = await supabase.from(table).delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(204).send();
      } catch (err) {
        console.error(`[db/${table} DELETE]`, err);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression.', details: null } });
      }
    },
  );
}

// ── Sites — routes dédiées (geo_point PostGIS) ──────────────────────────────

const SITE_SELECT = `id, nom, actif, "order", zoom_defaut, geo_point, created_at`;

function parseGeoPoint(gp: unknown): { lat: number | null; lng: number | null } {
  if (!gp) return { lat: null, lng: null };

  // GeoJSON object (certaines versions de PostgREST)
  if (typeof gp === 'object') {
    const coords = (gp as { coordinates?: [number, number] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) return { lng: coords[0], lat: coords[1] };
    return { lat: null, lng: null };
  }

  // EWKB hex (format par défaut de PostgREST pour geography)
  // Structure : [1 byte ordre] [4 bytes type+flags] [4 bytes SRID si flag 0x20000000] [8 bytes X] [8 bytes Y]
  if (typeof gp === 'string' && gp.length >= 50) {
    try {
      const buf = Buffer.from(gp, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = Boolean(wkbType & 0x20000000);
      const base = 1 + 4 + (hasSRID ? 4 : 0);
      const lng = le ? buf.readDoubleLE(base) : buf.readDoubleBE(base);
      const lat = le ? buf.readDoubleLE(base + 8) : buf.readDoubleBE(base + 8);
      return { lng, lat };
    } catch {
      return { lat: null, lng: null };
    }
  }

  return { lat: null, lng: null };
}

function flattenSite(row: Record<string, unknown>): Record<string, unknown> {
  const { geo_point, ...rest } = row;
  return { ...rest, ...parseGeoPoint(geo_point) };
}

function geoBody(raw: Record<string, unknown>): Record<string, unknown> {
  const { lat, lng, ...rest } = raw;
  const body: Record<string, unknown> = { ...rest };
  if ('lat' in raw || 'lng' in raw) {
    const latN = lat !== '' && lat != null ? parseFloat(String(lat)) : NaN;
    const lngN = lng !== '' && lng != null ? parseFloat(String(lng)) : NaN;
    body.geo_point = !isNaN(latN) && !isNaN(lngN) ? `POINT(${lngN} ${latN})` : null;
  }
  return body;
}

router.get('/sites', authMiddleware, requireRole(allRoles),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('sites').select(SITE_SELECT).order('order', { ascending: true });
      if (error) throw error;
res.json((data ?? []).map(flattenSite));
    } catch (err) {
      console.error('[db/sites GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture sites.', details: null } });
    }
  },
);

router.post('/sites', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('sites').insert(geoBody(req.body)).select(SITE_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenSite(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/sites POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création site.', details: null } });
    }
  },
);

router.patch('/sites/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('sites').update(geoBody(req.body)).eq('id', req.params.id).select(SITE_SELECT).single();
      if (error) throw error;
      res.json(flattenSite(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/sites PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour site.', details: null } });
    }
  },
);

router.delete('/sites/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase.from('sites').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/sites DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression site.', details: null } });
    }
  },
);
// ── Installations — routes dédiées (geo_point + FK site) ────────────────────

const INSTALL_SELECT = `id, site_id, nom, actif, "order", zoom_defaut, geo_point, created_at, sites!installations_site_id_fkey(nom)`;

function flattenInstallation(row: Record<string, unknown>): Record<string, unknown> {
  const { geo_point, sites, ...rest } = row;
  return { ...rest, site_nom: (sites as { nom?: string } | null)?.nom ?? '', ...parseGeoPoint(geo_point) };
}

function installBody(raw: Record<string, unknown>): Record<string, unknown> {
  const { site_nom, ...rest } = raw;
  void site_nom;
  return geoBody(rest);
}

router.get('/installations', authMiddleware, requireRole(allRoles),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('installations').select(INSTALL_SELECT).order('order', { ascending: true });
      if (error) throw error;
      res.json((data ?? []).map(flattenInstallation));
    } catch (err) {
      console.error('[db/installations GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture installations.', details: null } });
    }
  },
);

router.post('/installations', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('installations').insert(installBody(req.body)).select(INSTALL_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenInstallation(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/installations POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création installation.', details: null } });
    }
  },
);

router.patch('/installations/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('installations').update(installBody(req.body)).eq('id', req.params.id).select(INSTALL_SELECT).single();
      if (error) throw error;
      res.json(flattenInstallation(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/installations PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour installation.', details: null } });
    }
  },
);

router.delete('/installations/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase.from('installations').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/installations DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression installation.', details: null } });
    }
  },
);
// ── Plans — routes dédiées (jointures site + installation) ──────────────────

const PLAN_SELECT = `id, site_id, installation_id, nom, description, editeur, date_propose, date_validation, largeur_px, hauteur_px, svg_path, "order", actif, proposedby_id, validateur_id, created_at, updated_at, sites!plans_site_id_fkey(nom, "order"), installations!plans_installation_id_fkey(nom, "order"), proposedby:user_profiles!plans_proposedby_id_fkey(nom), validateur:user_profiles!plans_validateur_id_fkey(nom)`;

function flattenPlan(row: Record<string, unknown>): Record<string, unknown> {
  const { sites, installations, proposedby, validateur, ...rest } = row;
  const s = sites         as { nom?: string; order?: number } | null;
  const i = installations as { nom?: string; order?: number } | null;
  const svgPath = rest.svg_path as string | null | undefined;
  return {
    ...rest,
    site_nom:           s?.nom   ?? '',
    site_order:         s?.order ?? 0,
    installation_nom:   i?.nom   ?? '',
    installation_order: i?.order ?? 0,
    proposedby_nom:     (proposedby as { nom?: string } | null)?.nom ?? '',
    validateur_nom:     (validateur as { nom?: string } | null)?.nom ?? '',
    svg_public_url:     svgPath
      ? supabaseAdmin.storage.from('Documents').getPublicUrl(svgPath).data.publicUrl
      : null,
  };
}

function planBody(raw: Record<string, unknown>): Record<string, unknown> {
  const { site_nom, installation_nom, site_order, installation_order, proposedby_nom, validateur_nom, ...rest } = raw;
  void site_nom; void installation_nom; void site_order; void installation_order; void proposedby_nom; void validateur_nom;
  if ('installation_id' in rest && !rest.installation_id) rest.installation_id = null;
  if ('site_id'         in rest && !rest.site_id)         rest.site_id         = null;
  if ('proposedby_id'   in rest && !rest.proposedby_id)   rest.proposedby_id   = null;
  if ('validateur_id'   in rest && !rest.validateur_id)   rest.validateur_id   = null;
  if ('date_validation' in rest && !rest.date_validation) rest.date_validation = null;
  if ('date_propose'    in rest && !rest.date_propose)    rest.date_propose    = null;
  return rest;
}

router.get('/plans', authMiddleware, requireRole(allRoles),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('plans').select(PLAN_SELECT).order('order', { ascending: true });
      if (error) throw error;
      res.json((data ?? []).map(flattenPlan));
    } catch (err) {
      console.error('[db/plans GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture plans.', details: null } });
    }
  },
);

router.post('/plans', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { nom, site_id, installation_id } = req.body;
      if (!nom || !site_id || !installation_id) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'nom, site_id et installation_id sont requis.', details: null } });
        return;
      }
      const { data, error } = await supabase.from('plans').insert(planBody(req.body)).select(PLAN_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenPlan(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/plans POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création plan.', details: (err as { message?: string })?.message ?? String(err) } });
    }
  },
);

router.get('/plans/:id', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('plans').select(PLAN_SELECT).eq('id', req.params.id).single();
      if (error) throw error;
      res.json(flattenPlan(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/plans GET/:id]', err);
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plan introuvable.', details: null } });
    }
  },
);

router.patch('/plans/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('plans').update(planBody(req.body)).eq('id', req.params.id).select(PLAN_SELECT).single();
      if (error) throw error;
      res.json(flattenPlan(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/plans PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour plan.', details: null } });
    }
  },
);

router.delete('/plans/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase.from('plans').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/plans DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression plan.', details: null } });
    }
  },
);

// ── Calques — routes dédiées (jointures plan + user_profiles) ───────────────

const CALQUE_SELECT = `id, site_id, installation_id, plan_id, nom, description, type, niveau_accreditation, icone_path, couleur, template_champs, zoom_min, zoom_max, is_downloadable, "order", owner_id, validateur_id, date_validation, created_at, updated_at, sites!calques_site_id_fkey(nom), installations!calques_installation_id_fkey(nom), plans!calques_plan_id_fkey(nom, sites!plans_site_id_fkey(nom), installations!plans_installation_id_fkey(nom)), owner:user_profiles!calques_owner_id_fkey(nom), validateur:user_profiles!calques_validateur_id_fkey(nom)`;
const TYPES_CALQUE  = ['geographique', 'non_geographique'];

function flattenCalque(row: Record<string, unknown>): Record<string, unknown> {
  const { sites, installations, plans, owner, validateur, ...rest } = row;
  const iPath = rest.icone_path as string | null | undefined;

  type PlanJoin = { nom?: string; sites?: { nom?: string } | null; installations?: { nom?: string } | null } | null;
  const plan = plans as PlanJoin;

  // Si le calque est lié à un plan (site_id/installation_id nuls), remonte via le plan
  const siteNom         = (sites         as { nom?: string } | null)?.nom ?? plan?.sites?.nom         ?? '';
  const installationNom = (installations as { nom?: string } | null)?.nom ?? plan?.installations?.nom ?? '';

  return {
    ...rest,
    site_nom:         siteNom,
    installation_nom: installationNom,
    plan_nom:         plan?.nom ?? '',
    owner_nom:        (owner      as { nom?: string } | null)?.nom ?? '',
    validateur_nom:   (validateur as { nom?: string } | null)?.nom ?? '',
    icone_public_url: iPath ? supabaseAdmin.storage.from('Documents').getPublicUrl(iPath).data.publicUrl : '/defmarker.svg',
  };
}

function clampCalqueAccred(v: unknown): number {
  const n = parseInt(String(v ?? 0), 10);
  return isNaN(n) ? 0 : Math.min(3, Math.max(0, n));
}

router.get('/calques', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { plan_id, site_id } = req.query;
      let q = supabase.from('calques').select(CALQUE_SELECT).order('order', { ascending: true });
      if (plan_id)  q = q.eq('plan_id',  String(plan_id));
      if (site_id)  q = q.eq('site_id',  String(site_id)).is('plan_id', null);
      if (!isPrivilegedRole(req.user!.role)) q = q.lte('niveau_accreditation', req.user!.niveau_accreditation);
      const { data, error } = await q;
      if (error) throw error;

      res.json((data ?? []).map(flattenCalque));
    } catch (err) {
      console.error('[db/calques GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture calques.', details: null } });
    }
  },
);

router.post('/calques', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { plan_id, site_id, installation_id, nom, description, type, niveau_accreditation, icone_path, couleur, zoom_min, zoom_max, is_downloadable, template_champs, owner_id, validateur_id, date_validation } = req.body;
      if (!nom || !type || (!plan_id && !site_id)) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'nom, type et (plan_id ou site_id) sont requis.', details: null } });
        return;
      }
      const insertData = {
        plan_id:              plan_id         || null,
        site_id:              site_id         || null,
        installation_id:      installation_id || null,
        owner_id:             owner_id        || null,
        validateur_id:        validateur_id   || null,
        date_validation:      date_validation || null,
        nom,
        description:          description || null,
        type:                 TYPES_CALQUE.includes(type) ? type : 'geographique',
        niveau_accreditation: clampCalqueAccred(niveau_accreditation),
        icone_path:           icone_path      || null,
        couleur:              couleur         || null,
        template_champs:      template_champs ?? null,
        zoom_min:             zoom_min        ?? null,
        zoom_max:             zoom_max        ?? null,
        is_downloadable:      is_downloadable ?? false,
      };
      const { data, error } = await supabase.from('calques').insert(insertData).select(CALQUE_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenCalque(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/calques POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création calque.', details: (err as { message?: string })?.message ?? String(err) } });
    }
  },
);

router.get('/calques/:id', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      let q = supabase.from('calques').select(CALQUE_SELECT).eq('id', req.params.id);
      if (!isPrivilegedRole(req.user!.role)) q = q.lte('niveau_accreditation', req.user!.niveau_accreditation);
      const { data, error } = await q.single();
      if (error) throw error;
      res.json(flattenCalque(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/calques GET/:id]', err);
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Calque introuvable.', details: null } });
    }
  },
);

router.patch('/calques/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const raw = { ...req.body };
      if ('niveau_accreditation' in raw) raw.niveau_accreditation = clampCalqueAccred(raw.niveau_accreditation);
      if ('type'          in raw && !TYPES_CALQUE.includes(raw.type)) delete raw.type;
      if ('zoom_min'      in raw && (raw.zoom_min === '' || raw.zoom_min == null)) raw.zoom_min = null;
      if ('zoom_max'      in raw && (raw.zoom_max === '' || raw.zoom_max == null)) raw.zoom_max = null;
      if ('validateur_id'   in raw && !raw.validateur_id)   raw.validateur_id   = null;
      if ('date_validation' in raw && !raw.date_validation) raw.date_validation = null;
      const { plan_nom, site_nom, installation_nom, owner_nom, validateur_nom, icone_public_url, ...clean } = raw;
      void plan_nom; void site_nom; void installation_nom; void owner_nom; void validateur_nom; void icone_public_url;
      const { data, error } = await supabase
        .from('calques').update(clean).eq('id', req.params.id).select(CALQUE_SELECT).single();
      if (error) throw error;
      res.json(flattenCalque(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/calques PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour calque.', details: (err as { message?: string })?.message ?? String(err) } });
    }
  },
);

router.delete('/calques/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase.from('calques').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/calques DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression calque.', details: null } });
    }
  },
);

function isValidSvgContent(buffer: Buffer): boolean {
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 2000));
  return /<svg[\s>]/i.test(text);
}

function sanitizeSvgBuffer(buffer: Buffer): Buffer {
  let text = buffer.toString('utf8');
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s/>][^\s/>]*/gi, '')
    .replace(/(href|xlink:href|src|action)\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
    .replace(/(href|xlink:href|src|action)\s*=\s*'javascript:[^']*'/gi, "href='#'");
  return Buffer.from(text, 'utf8');
}

function parseSvgDimensions(buffer: Buffer): { width: number | null; height: number | null } {
  const text = buffer.toString('utf8');
  const tagMatch = text.match(/<svg([\s\S]*?)>/i);
  const tag = tagMatch?.[1] ?? '';

  const parse = (val: string) => { const n = parseFloat(val); return isNaN(n) ? null : Math.round(n); };

  // viewBox en priorité : valeurs 3 et 4 = largeur et hauteur en unités utilisateur
  const parts = tag.match(/\bviewBox=["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/);
  if (parts && parts.length >= 4) {
    const w = parse(parts[2]);
    const h = parse(parts[3]);
    if (w !== null && h !== null) return { width: w, height: h };
  }

  // Fallback : attributs width / height (peuvent être en mm, % — on prend la valeur numérique brute)
  const width  = parse(tag.match(/\bwidth=["']([^"']+)["']/i)?.[1]  ?? '');
  const height = parse(tag.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? '');
  return { width, height };
}

router.post('/upload/svg', authMiddleware, requireRole(adminAll),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    if (req.file.mimetype !== 'image/svg+xml') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format SVG est accepté.' } });
      return;
    }
    if (!isValidSvgContent(req.file.buffer)) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Fichier SVG invalide.' } });
      return;
    }
    const { plan_id } = req.body;
    if (!plan_id) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'plan_id requis.' } });
      return;
    }
    const cleanBuffer = sanitizeSvgBuffer(req.file.buffer);
    // Chemin fixe par plan — upsert écrase le fichier précédent (annule et remplace)
    const storagePath = `Plans/${plan_id}/current.svg`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(storagePath, cleanBuffer, { contentType: 'image/svg+xml', upsert: true });
    if (uploadError) {
      console.error('[upload/svg]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: "Erreur lors de l'upload SVG." } });
      return;
    }
    const { data: { publicUrl } } = supabaseAdmin.storage.from('Documents').getPublicUrl(storagePath);
    const { width, height } = parseSvgDimensions(cleanBuffer);
    res.json({ url: publicUrl, path: storagePath, width, height });
  },
);

// ── Dossiers — routes dédiées (accréditation + createur_id + jointures) ──────

const DOSSIER_SELECT = `id, site_id, installation_id, nom, "order", description, actif, created_at, updated_at, sites!dossiers_site_id_fkey(nom, "order"), installations!dossiers_installation_id_fkey(nom, "order")`;

function flattenDossier(row: Record<string, unknown>): Record<string, unknown> {
  const { sites, installations, ...rest } = row;
  const s = sites as { nom?: string; order?: number } | null;
  const i = installations as { nom?: string; order?: number } | null;
  return {
    ...rest,
    site_nom:           s?.nom   ?? '',
    site_order:         s?.order ?? 0,
    installation_nom:   i?.nom   ?? '',
    installation_order: i?.order ?? 0,
  };
}

router.get('/dossiers', authMiddleware, requireRole(allRoles),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select(DOSSIER_SELECT)
        .order('order', { ascending: true });
      if (error) throw error;
      res.json((data ?? []).map(flattenDossier));
    } catch (err) {
      console.error('[db/dossiers GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture dossiers.', details: null } });
    }
  },
);

router.post('/dossiers', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { nom, description, site_id, installation_id } = req.body;
      if (!nom || !site_id) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'nom et site_id sont requis.', details: null } });
        return;
      }
      const { actif } = req.body;
      const insertData = {
        nom,
        description:     description || null,
        site_id,
        installation_id: installation_id || null,
        actif:           actif !== undefined ? Boolean(actif) : true,
      };
      const { data, error } = await supabase.from('dossiers').insert(insertData).select(DOSSIER_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenDossier(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/dossiers POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création dossier.', details: null } });
    }
  },
);

router.patch('/dossiers/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { site_nom, installation_nom, site_order, installation_order, ...raw } = req.body;
      void site_nom; void installation_nom; void site_order; void installation_order;
      if ('installation_id' in raw && !raw.installation_id) raw.installation_id = null;
      const { data, error } = await supabase
        .from('dossiers').update(raw).eq('id', req.params.id).select(DOSSIER_SELECT).single();
      if (error) throw error;
      res.json(flattenDossier(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/dossiers PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour dossier.', details: null } });
    }
  },
);

router.delete('/dossiers/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase.from('dossiers').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/dossiers DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression dossier.', details: null } });
    }
  },
);
// ── Fichiers PDF — routes dédiées ───────────────────────────────────────────

const FICHIER_SELECT = `id, dossier_id, nom, "order", description, niveau_accreditation, storage_path, version, is_current, is_uploadable, date_propose, date_validation, proposedby_id, validateur_id, created_at, updated_at, dossiers!fichiers_pdf_dossier_id_fkey(nom), proposedby:user_profiles!fichiers_pdf_proposedby_id_fkey(nom), validateur:user_profiles!fichiers_pdf_validateur_id_fkey(nom)`;

function flattenFichier(row: Record<string, unknown>): Record<string, unknown> {
  const { dossiers, proposedby, validateur, ...rest } = row;
  const storagePath = rest.storage_path as string | null | undefined;
  return {
    ...rest,
    dossier_nom:        (dossiers   as { nom?: string } | null)?.nom ?? '',
    proposedby_nom:     (proposedby as { nom?: string } | null)?.nom ?? '',
    validateur_nom:     (validateur as { nom?: string } | null)?.nom ?? '',
    storage_public_url: storagePath
      ? supabaseAdmin.storage.from('Documents').getPublicUrl(storagePath).data.publicUrl
      : null,
  };
}

router.get('/fichiers_pdf', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { dossier_id } = req.query;
      let q = supabase.from('fichiers_pdf').select(FICHIER_SELECT).order('order', { ascending: true });
      if (dossier_id) q = q.eq('dossier_id', String(dossier_id));
      if (!isPrivilegedRole(req.user!.role)) q = q.lte('niveau_accreditation', req.user!.niveau_accreditation);
      const { data, error } = await q;
      if (error) throw error;
      res.json((data ?? []).map(flattenFichier));
    } catch (err) {
      console.error('[db/fichiers_pdf GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture fichiers.', details: null } });
    }
  },
);

router.post('/fichiers_pdf', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { dossier_id, nom, storage_path, description, niveau_accreditation, is_uploadable, proposedby_id, validateur_id, date_validation, date_propose } = req.body;
      if (!dossier_id || !nom || !storage_path) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'dossier_id, nom et storage_path sont requis.', details: null } });
        return;
      }
      const insertData = {
        dossier_id,
        nom,
        storage_path,
        description:          description    || null,
        niveau_accreditation: clampAccred(niveau_accreditation),
        is_uploadable:        is_uploadable  ?? false,
        date_propose:         date_propose   || null,
        proposedby_id:        proposedby_id  || null,
        validateur_id:        validateur_id  || null,
        date_validation:      date_validation || null,
      };
      const { data, error } = await supabase.from('fichiers_pdf').insert(insertData).select(FICHIER_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenFichier(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/fichiers_pdf POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création fichier.', details: null } });
    }
  },
);

router.get('/fichiers_pdf/:id', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      let q = supabase.from('fichiers_pdf').select(FICHIER_SELECT).eq('id', req.params.id);
      if (!isPrivilegedRole(req.user!.role)) q = q.lte('niveau_accreditation', req.user!.niveau_accreditation);
      const { data, error } = await q.single();
      if (error) throw error;
      res.json(flattenFichier(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/fichiers_pdf GET/:id]', err);
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fichier introuvable.', details: null } });
    }
  },
);

router.patch('/fichiers_pdf/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const raw = { ...req.body };
      if ('niveau_accreditation' in raw) raw.niveau_accreditation = clampAccred(raw.niveau_accreditation);
      if ('date_propose'    in raw && !raw.date_propose)    raw.date_propose    = null;
      if ('date_validation' in raw && !raw.date_validation) raw.date_validation = null;
      if ('proposedby_id'   in raw && !raw.proposedby_id)   raw.proposedby_id   = null;
      if ('validateur_id'   in raw && !raw.validateur_id)   raw.validateur_id   = null;
      const { dossier_nom, proposedby_nom, validateur_nom, ...clean } = raw;
      void dossier_nom; void proposedby_nom; void validateur_nom;
      const { data, error } = await supabase
        .from('fichiers_pdf').update(clean).eq('id', req.params.id).select(FICHIER_SELECT).single();
      if (error) throw error;
      res.json(flattenFichier(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/fichiers_pdf PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour fichier.', details: null } });
    }
  },
);

router.delete('/fichiers_pdf/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase.from('fichiers_pdf').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/fichiers_pdf DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression fichier.', details: null } });
    }
  },
);

router.post('/upload/pdf', authMiddleware, requireRole(adminAll),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    if (req.file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format PDF est accepté.' } });
      return;
    }
    const { dossier_id } = req.body;
    if (!dossier_id) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'dossier_id requis.' } });
      return;
    }
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `Fichiers/${dossier_id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(storagePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error('[upload/pdf]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: 'Erreur lors de l\'upload PDF.' } });
      return;
    }
    const { data: { publicUrl } } = supabaseAdmin.storage.from('Documents').getPublicUrl(storagePath);
    res.json({ url: publicUrl, path: storagePath });
  },
);

// ── Utilisateurs — routes dédiées (auth.users + user_profiles) ─────────────

const USER_SELECT = 'id, nom, email, role, niveau_accreditation, actif, avatar_url, last_activity_at, created_at';

router.get('/user_profiles', authMiddleware, requireRole(adminApp),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles').select(USER_SELECT).order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      console.error('[db/user_profiles GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture utilisateurs.', details: null } });
    }
  },
);

router.post('/user_profiles', authMiddleware, requireRole(adminApp),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { nom, email, password, role, niveau_accreditation, actif } = req.body;
    if (!email || !password || !nom) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'nom, email et password requis.', details: null } });
      return;
    }
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authError) {
      res.status(400).json({ error: { code: 'AUTH_ERROR', message: authError.message, details: null } });
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({ id: authData.user.id, nom, email, role: role || 'User', niveau_accreditation: clampAccred(niveau_accreditation), actif: actif ?? true })
      .select(USER_SELECT).single();
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error('[db/user_profiles POST]', profileError);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création profil.', details: null } });
      return;
    }
    res.status(201).json(profile);
  },
);

router.patch('/user_profiles/:id', authMiddleware, requireRole(adminApp),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { email, password, ...profileFields } = req.body;
    try {
      if ('niveau_accreditation' in profileFields) {
        profileFields.niveau_accreditation = clampAccred(profileFields.niveau_accreditation);
      }
      const updateData = { ...profileFields, ...(email ? { email } : {}) };
      const { data, error } = await supabase
        .from('user_profiles').update(updateData).eq('id', req.params.id).select(USER_SELECT).single();
      if (error) throw error;
      if (email || password) {
        const authUpdate: { email?: string; password?: string } = {};
        if (email)    authUpdate.email    = email;
        if (password) authUpdate.password = password;
        await supabaseAdmin.auth.admin.updateUserById(req.params.id as string, authUpdate);
      }
      res.json(data);
    } catch (err) {
      console.error('[db/user_profiles PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour utilisateur.', details: null } });
    }
  },
);

router.delete('/user_profiles/:id', authMiddleware, requireRole(adminApp),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id as string);
    if (error) {
      console.error('[db/user_profiles DELETE]', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression utilisateur.', details: null } });
      return;
    }
    res.status(204).send();
  },
);

// ── Users — liste complète pour sélection owner ─────────────────────────────

router.get('/users', authMiddleware, requireRole(adminAll),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, nom')
        .eq('actif', true)
        .order('nom', { ascending: true });
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      console.error('[db/users GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture utilisateurs.', details: null } });
    }
  },
);

// ── Admins — liste pour sélection validateur ────────────────────────────────

router.get('/admins', authMiddleware, requireRole(allRoles),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, nom')
        .in('role', ['Admin_app', 'Admin_data'])
        .eq('actif', true)
        .order('nom', { ascending: true });
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      console.error('[db/admins GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture administrateurs.', details: null } });
    }
  },
);

// ── Markers — bibliothèque d'icônes SVG ─────────────────────────────────────

const MARKER_SELECT = `id, nom, storage_path, mots_cles, couleur, created_at, updated_at`;

router.get('/markers', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('markers').select(MARKER_SELECT).order('nom', { ascending: true });
      if (error) throw error;
      const withUrls = (data ?? []).map(m => ({
        ...m,
        public_url: supabaseAdmin.storage.from('Documents').getPublicUrl((m as { storage_path: string }).storage_path).data.publicUrl,
      }));
      res.json(withUrls);
    } catch (err) {
      console.error('[db/markers GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture markers.', details: null } });
    }
  },
);

router.post('/markers', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { nom, storage_path, mots_cles, couleur } = req.body;
      if (!nom || !storage_path) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'nom et storage_path sont requis.', details: null } });
        return;
      }
      const insertData = { nom, storage_path, mots_cles: Array.isArray(mots_cles) ? mots_cles : [], couleur: couleur || null };
      const { data, error } = await supabase.from('markers').insert(insertData).select(MARKER_SELECT).single();
      if (error) throw error;
      const row = data as Record<string, unknown>;
      res.status(201).json({ ...row, public_url: supabaseAdmin.storage.from('Documents').getPublicUrl(row.storage_path as string).data.publicUrl });
    } catch (err) {
      console.error('[db/markers POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création marker.', details: null } });
    }
  },
);

router.patch('/markers/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { nom, mots_cles, couleur, storage_path } = req.body;

      // Récupérer l'ancien chemin avant la mise à jour
      const { data: current } = await supabase
        .from('markers').select('storage_path').eq('id', req.params.id).single();
      const oldPath = (current as { storage_path?: string } | null)?.storage_path;

      const patch: Record<string, unknown> = {};
      if (nom          !== undefined) patch.nom          = nom;
      if (storage_path !== undefined) patch.storage_path = storage_path;
      if (mots_cles    !== undefined) patch.mots_cles    = Array.isArray(mots_cles) ? mots_cles : [];
      if (couleur      !== undefined) patch.couleur      = couleur || null;

      const { data, error } = await supabase.from('markers').update(patch).eq('id', req.params.id).select(MARKER_SELECT).single();
      if (error) throw error;

      // Supprimer l'ancien fichier si le chemin a changé
      if (storage_path && oldPath && storage_path !== oldPath) {
        await supabaseAdmin.storage.from('Documents').remove([oldPath]);
      }

      const row = data as Record<string, unknown>;
      res.json({ ...row, public_url: supabaseAdmin.storage.from('Documents').getPublicUrl(row.storage_path as string).data.publicUrl });
    } catch (err) {
      console.error('[db/markers PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour marker.', details: null } });
    }
  },
);

router.delete('/markers/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Récupérer le chemin avant suppression
      const { data: current } = await supabase
        .from('markers').select('storage_path').eq('id', req.params.id).single();
      const storagePath = (current as { storage_path?: string } | null)?.storage_path;

      const { error } = await supabase.from('markers').delete().eq('id', req.params.id);
      if (error) throw error;

      // Supprimer le fichier SVG du bucket
      if (storagePath) {
        await supabaseAdmin.storage.from('Documents').remove([storagePath]);
      }

      res.status(204).send();
    } catch (err) {
      console.error('[db/markers DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression marker.', details: null } });
    }
  },
);

function parseSvgColor(buffer: Buffer): string | null {
  const text = buffer.toString('utf8');
  const skip = new Set(['none', 'transparent', 'inherit', 'currentcolor', '']);

  const toHex6 = (h: string) => h.length === 4
    ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
    : h.toLowerCase();

  // fill et stroke dans les attributs
  const attrRe = /\b(?:fill|stroke)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(text)) !== null) {
    const v = m[1].trim().toLowerCase();
    if (!skip.has(v) && !v.startsWith('url(') && /^#[0-9a-f]{3,6}$/.test(v))
      return toHex6(v);
  }

  // fill dans les attributs style inline
  const styleRe = /fill\s*:\s*(#[0-9a-fA-F]{3,6})/gi;
  while ((m = styleRe.exec(text)) !== null) {
    return toHex6(m[1].trim().toLowerCase());
  }

  return null;
}

router.post('/upload/marker', authMiddleware, requireRole(adminAll),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } }); return; }
    if (req.file.mimetype !== 'image/svg+xml') { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format SVG est accepté.' } }); return; }
    if (!isValidSvgContent(req.file.buffer)) { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Fichier SVG invalide.' } }); return; }
    const cleanBuffer = sanitizeSvgBuffer(req.file.buffer);
    const safeName    = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `Markers/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents').upload(storagePath, cleanBuffer, { contentType: 'image/svg+xml', upsert: false });
    if (uploadError) {
      console.error('[upload/marker]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: "Erreur lors de l'upload du marker." } });
      return;
    }
    const { data: { publicUrl } } = supabaseAdmin.storage.from('Documents').getPublicUrl(storagePath);
    const color = parseSvgColor(cleanBuffer);
    res.json({ url: publicUrl, path: storagePath, color });
  },
);

// ── Pour validation — table intermédiaire de soumission ─────────────────────

const PV_STATUTS = ['En attente', 'A compléter', 'Validé', 'Rejeté'];
const PV_TYPES   = ['fichier_pdf', 'plan', 'calque'];
const PV_SELECT  = `id, entity_type, proposedby_id, date_propose, payload, site_id, installation_id, dossier_id, plan_id, avec_rattachement, storage_path_temp, statut, validateur_id, date_validation, commentaire_admin, entity_id_created, created_at, updated_at, proposedby:user_profiles!pour_validation_proposedby_id_fkey(nom), validateur:user_profiles!pour_validation_validateur_id_fkey(nom), sites(nom), installations(nom), dossiers(nom), plans(nom)`;

function flattenPV(row: Record<string, unknown>): Record<string, unknown> {
  const { proposedby, validateur, sites, installations, dossiers, plans, entity_id_created, ...rest } = row;
  const tempPath = rest.storage_path_temp as string | null | undefined;
  return {
    ...rest,
    id_valide:             (entity_id_created as string | null) ?? null,
    proposedby_nom:        (proposedby    as { nom?: string } | null)?.nom ?? '',
    validateur_nom:        (validateur    as { nom?: string } | null)?.nom ?? '',
    site_nom:              (sites         as { nom?: string } | null)?.nom ?? '',
    installation_nom:      (installations as { nom?: string } | null)?.nom ?? '',
    dossier_nom:           (dossiers      as { nom?: string } | null)?.nom ?? '',
    plan_nom:              (plans         as { nom?: string } | null)?.nom ?? '',
    storage_temp_public_url: tempPath
      ? supabaseAdmin.storage.from('Documents').getPublicUrl(tempPath).data.publicUrl
      : null,
  };
}

router.get('/pour_validation', authMiddleware, requireRole(adminAll),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('pour_validation').select(PV_SELECT).order('date_propose', { ascending: false });
      if (error) throw error;
      res.json((data ?? []).map(flattenPV));
    } catch (err) {
      console.error('[db/pour_validation GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture demandes.', details: null } });
    }
  },
);

router.post('/pour_validation', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { entity_type, payload, site_id, installation_id, dossier_id, plan_id, avec_rattachement, validateur_id, storage_path_temp } = req.body;
      if (!entity_type || !PV_TYPES.includes(entity_type) || !payload) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'entity_type et payload sont requis.', details: null } });
        return;
      }
      if (!validateur_id) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Un validateur est requis.', details: null } });
        return;
      }
      const insertData = {
        entity_type,
        proposedby_id:    req.user!.id,
        payload,
        site_id:          site_id          || null,
        installation_id:  installation_id  || null,
        dossier_id:       dossier_id       || null,
        plan_id:          plan_id          || null,
        avec_rattachement: avec_rattachement ?? true,
        validateur_id,
        storage_path_temp: storage_path_temp || null,
        statut:           'En attente',
      };
      const { data, error } = await supabase.from('pour_validation').insert(insertData).select(PV_SELECT).single();
      if (error) throw error;
      res.status(201).json(flattenPV(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/pour_validation POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur soumission demande.', details: null } });
    }
  },
);

router.patch('/pour_validation/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // admin_data : ne peut traiter que les demandes qui lui sont assignées
      if (req.user!.role === ROLES.ADMIN_DATA) {
        const { data: existing, error: fetchErr } = await supabase
          .from('pour_validation').select('validateur_id').eq('id', req.params.id).single();
        if (fetchErr || !existing || (existing as { validateur_id?: string }).validateur_id !== req.user!.id) {
          res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Vous n\'êtes pas le validateur de cette demande.', details: null } });
          return;
        }
      }

      const { statut, commentaire_admin, id_valide, storage_path_temp, validateur_id } = req.body;
      const patch: Record<string, unknown> = {};
      if (statut && PV_STATUTS.includes(statut)) {
        patch.statut = statut;
        if (statut === 'Validé' || statut === 'Rejeté') {
          patch.date_validation = new Date().toISOString();
        }
      }
      if (commentaire_admin  !== undefined) patch.commentaire_admin   = commentaire_admin  || null;
      if (id_valide          !== undefined) patch.entity_id_created   = id_valide          || null;
      if (storage_path_temp  !== undefined) patch.storage_path_temp   = storage_path_temp  || null;
      if (validateur_id      !== undefined) patch.validateur_id       = validateur_id      || null;

      const { data, error } = await supabase
        .from('pour_validation').update(patch).eq('id', req.params.id).select(PV_SELECT).single();
      if (error) throw error;
      res.json(flattenPV(data as Record<string, unknown>));
    } catch (err) {
      console.error('[db/pour_validation PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour demande.', details: null } });
    }
  },
);

router.post('/upload/pdf_temp', authMiddleware, requireRole(allRoles),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    if (req.file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format PDF est accepté.' } });
      return;
    }
    const safeName    = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const slug        = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `En_attente/${slug}/${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(storagePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error('[upload/pdf_temp]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: "Erreur lors de l'upload du fichier." } });
      return;
    }
    res.json({ path: storagePath });
  },
);

router.post('/upload/svg_temp', authMiddleware, requireRole(allRoles),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    if (req.file.mimetype !== 'image/svg+xml') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format SVG est accepté.' } });
      return;
    }
    if (!isValidSvgContent(req.file.buffer)) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Fichier SVG invalide.' } });
      return;
    }
    const cleanBuffer = sanitizeSvgBuffer(req.file.buffer);
    const safeName    = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const slug        = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `En_attente/${slug}/${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(storagePath, cleanBuffer, { contentType: 'image/svg+xml', upsert: false });
    if (uploadError) {
      console.error('[upload/svg_temp]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: "Erreur lors de l'upload du fichier." } });
      return;
    }
    res.json({ path: storagePath });
  },
);

// ── Config (bornes métier exposées au frontend) ──────────────────────────────

export const ACCREDITATION_BOUNDS = { min: 0, max: 4 } as const;

function clampAccred(value: unknown): number {
  const n = parseInt(String(value ?? 0), 10);
  if (isNaN(n)) return ACCREDITATION_BOUNDS.min;
  return Math.min(ACCREDITATION_BOUNDS.max, Math.max(ACCREDITATION_BOUNDS.min, n));
}

router.get('/config', authMiddleware,
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ accreditation: ACCREDITATION_BOUNDS });
  },
);

// ── Avatar upload ────────────────────────────────────────────────────────────

router.post('/upload/avatar', authMiddleware, requireRole(adminApp),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    if (req.file.mimetype !== 'image/png') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format PNG est accepté.' } });
      return;
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(`avatar/${filename}`, req.file.buffer, { contentType: 'image/png', upsert: false });
    if (uploadError) {
      console.error('[upload/avatar]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: 'Erreur lors de l\'upload de l\'avatar.' } });
      return;
    }
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('Documents')
      .getPublicUrl(`avatar/${filename}`);
    res.json({ url: publicUrl });
  },
);

// ── Points ─────────────────────────────────────────────────────────────────

router.get('/points', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { calque_id } = req.query;
    if (!calque_id || typeof calque_id !== 'string') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'calque_id requis.' } });
      return;
    }
    try {
      const { data, error } = await supabase.from('points').select('*').eq('calque_id', calque_id).order('created_at', { ascending: true });
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      console.error('[db/points GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture points.', details: null } });
    }
  },
);

router.post('/points', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('points').insert(req.body).select('*').single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (err) {
      console.error('[db/points POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création point.', details: null } });
    }
  },
);

router.patch('/points/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase.from('points').update(req.body).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error('[db/points PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour point.', details: null } });
    }
  },
);

router.delete('/points/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Supprime les fichiers storage des photos
      const { data: photos } = await supabase
        .from('photosFichiersPoints').select('storage_path').eq('point_id', req.params.id);
      if (photos && photos.length > 0) {
        const paths = (photos as { storage_path: string }[]).map(p => p.storage_path).filter(Boolean);
        if (paths.length > 0) await supabaseAdmin.storage.from('Documents').remove(paths);
      }

      // Supprime les enregistrements photos puis le point
      await supabase.from('photosFichiersPoints').delete().eq('point_id', req.params.id);
      const { error } = await supabase.from('points').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[db/points DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression point.', details: null } });
    }
  },
);

// ── Photos / Fichiers liés aux points ────────────────────────────────────────

const PHOTO_SELECT = `id, point_id, nom, "order", description, niveau_accreditation, storage_path, file_type, statut, created_at, updated_at`;

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadFichierPoint = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/upload/photo', authMiddleware, requireRole(adminAll),
  uploadPhoto.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    const { point_id, nom } = req.body as { point_id?: string; nom?: string };
    if (!point_id) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'point_id requis.' } });
      return;
    }
    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seules les images sont acceptées.' } });
      return;
    }
    const rawExt = req.file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const ext = ['jpg','jpeg','png','gif','webp','avif','svg'].includes(rawExt) ? rawExt : 'jpg';
    const storagePath = `Photos/${point_id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) {
      console.error('[upload/photo]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: "Erreur upload image." } });
      return;
    }
    const { data: { publicUrl } } = supabaseAdmin.storage.from('Documents').getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from('photosFichiersPoints')
      .insert({
        point_id,
        nom:                  nom || req.file.originalname,
        storage_path:         storagePath,
        file_type:            'image',
        statut:               'Validé',
        niveau_accreditation: 4,
        validateur_id:        req.user!.id,
      })
      .select(PHOTO_SELECT)
      .single();
    if (error) {
      console.error('[upload/photo DB]', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création photo.' } });
      return;
    }
    res.status(201).json({ ...(data as Record<string, unknown>), public_url: publicUrl });
  },
);

router.get('/photos', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { point_id } = req.query;
    if (!point_id || typeof point_id !== 'string') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'point_id requis.' } });
      return;
    }
    try {
      let pq = supabase.from('photosFichiersPoints').select(PHOTO_SELECT).eq('point_id', point_id).order('order', { ascending: true });
      if (!isPrivilegedRole(req.user!.role)) pq = pq.lte('niveau_accreditation', req.user!.niveau_accreditation);
      const { data, error } = await pq;
      if (error) throw error;
      const rows = (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        public_url: row.storage_path
          ? supabaseAdmin.storage.from('Documents').getPublicUrl(row.storage_path as string).data.publicUrl
          : null,
      }));
      res.json(rows);
    } catch (err) {
      console.error('[db/photos GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture photos.', details: null } });
    }
  },
);

router.post('/upload/fichier_point', authMiddleware, requireRole(adminAll),
  uploadFichierPoint.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Aucun fichier fourni.' } });
      return;
    }
    const { point_id, nom } = req.body as { point_id?: string; nom?: string };
    if (!point_id) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'point_id requis.' } });
      return;
    }
    if (req.file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Seul le format PDF est accepté.' } });
      return;
    }
    const storagePath = `FichiersPoints/${point_id}/${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('Documents')
      .upload(storagePath, req.file.buffer, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error('[upload/fichier_point]', uploadError);
      res.status(500).json({ error: { code: 'STORAGE_ERROR', message: 'Erreur upload PDF.' } });
      return;
    }
    const { data: { publicUrl } } = supabaseAdmin.storage.from('Documents').getPublicUrl(storagePath);
    const { data, error } = await supabase
      .from('photosFichiersPoints')
      .insert({
        point_id,
        nom:                  nom || req.file.originalname,
        storage_path:         storagePath,
        file_type:            'pdf',
        statut:               'Validé',
        niveau_accreditation: 4,
        validateur_id:        req.user!.id,
      })
      .select(PHOTO_SELECT)
      .single();
    if (error) {
      console.error('[upload/fichier_point DB]', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création fichier.' } });
      return;
    }
    res.status(201).json({ ...(data as Record<string, unknown>), public_url: publicUrl });
  },
);

router.patch('/photos/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('photosFichiersPoints')
        .update(req.body)
        .eq('id', req.params.id)
        .select(PHOTO_SELECT)
        .single();
      if (error) throw error;
      const row = data as Record<string, unknown>;
      res.json({
        ...row,
        public_url: row.storage_path
          ? supabaseAdmin.storage.from('Documents').getPublicUrl(row.storage_path as string).data.publicUrl
          : null,
      });
    } catch (err) {
      console.error('[db/photos PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour photo.', details: null } });
    }
  },
);

router.delete('/photos/:id', authMiddleware, requireRole(adminAll),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data: photo } = await supabase
        .from('photosFichiersPoints').select('storage_path').eq('id', req.params.id).single();
      const storagePath = (photo as { storage_path?: string } | null)?.storage_path;
      const { error } = await supabase.from('photosFichiersPoints').delete().eq('id', req.params.id);
      if (error) throw error;
      if (storagePath) await supabaseAdmin.storage.from('Documents').remove([storagePath]);
      res.status(204).send();
    } catch (err) {
      console.error('[db/photos DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression photo.', details: null } });
    }
  },
);

export default router;
