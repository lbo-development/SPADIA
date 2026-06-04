import { Router, Response } from 'express';
import { supabase } from '../supabase/client';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { requireRole, ROLES } from '../middlewares/roles';

const router = Router();
const allRoles = [ROLES.ADMIN_APP, ROLES.ADMIN_DATA, ROLES.USER, ROLES.VIEWER];

/* ── GET /api/v1/favoris ─────────────────────────────────────────────────── */
router.get('/', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('favoris')
        .select('*')
        .eq('user_id', req.user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      console.error('[favoris GET]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture favoris.', details: null } });
    }
  },
);

/* ── POST /api/v1/favoris ────────────────────────────────────────────────── */
router.post('/', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { label, node_id, node_type, expanded, map_state } = req.body ?? {};
    if (!node_id || !node_type) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'node_id et node_type sont requis.', details: null } });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('favoris')
        .insert({ user_id: req.user!.id, label: label || 'Favori', node_id, node_type, expanded: expanded ?? [], map_state: map_state ?? null })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (err) {
      console.error('[favoris POST]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur création favori.', details: null } });
    }
  },
);

/* ── PATCH /api/v1/favoris/:id ───────────────────────────────────────────── */
router.patch('/:id', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { label } = req.body ?? {};
    if (!label?.trim()) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'label requis.', details: null } });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('favoris')
        .update({ label: label.trim() })
        .eq('id', req.params.id)
        .eq('user_id', req.user!.id)
        .select()
        .single();
      if (error) throw error;
      if (!data) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Favori introuvable.', details: null } }); return; }
      res.json(data);
    } catch (err) {
      console.error('[favoris PATCH]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur mise à jour favori.', details: null } });
    }
  },
);

/* ── DELETE /api/v1/favoris/:id ──────────────────────────────────────────── */
router.delete('/:id', authMiddleware, requireRole(allRoles),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase
        .from('favoris')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user!.id);
      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('[favoris DELETE]', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur suppression favori.', details: null } });
    }
  },
);

export default router;
