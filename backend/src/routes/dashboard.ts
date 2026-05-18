import { Router, Response } from 'express';
import { supabase } from '../supabase/client';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { ROLES } from '../middlewares/roles';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: userId, role } = req.user!;
  try {
    const [sitesRes, installationsRes, plansRes, dossiersRes] = await Promise.all([
      supabase.from('sites').select('id', { count: 'exact', head: true }).eq('actif', true),
      supabase.from('installations').select('id', { count: 'exact', head: true }).eq('actif', true),
      supabase.from('plans').select('id', { count: 'exact', head: true }).eq('actif', true).eq('statut', 'Validé'),
      supabase.from('dossiers').select('id', { count: 'exact', head: true }).eq('statut', 'Validé'),
    ]);

    let pending = { plans: 0, calques: 0, dossiers: 0, photos: 0 };

    if (role === ROLES.ADMIN_APP || role === ROLES.VIEWER) {
      const [p, c, d, ph] = await Promise.all([
        supabase.from('plans').select('id', { count: 'exact', head: true }).eq('statut', 'En attente'),
        supabase.from('calques').select('id', { count: 'exact', head: true }).eq('statut', 'En attente'),
        supabase.from('dossiers').select('id', { count: 'exact', head: true }).eq('statut', 'En attente'),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
      ]);
      pending = { plans: p.count ?? 0, calques: c.count ?? 0, dossiers: d.count ?? 0, photos: ph.count ?? 0 };
    } else if (role === ROLES.ADMIN_DATA) {
      const [p, c, d, ph] = await Promise.all([
        supabase.from('plans').select('id', { count: 'exact', head: true }).eq('statut', 'En attente').eq('validateur_id', userId),
        supabase.from('calques').select('id', { count: 'exact', head: true }).eq('statut', 'En attente').eq('validateur_id', userId),
        supabase.from('dossiers').select('id', { count: 'exact', head: true }).eq('statut', 'En attente').eq('validateur_id', userId),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente').eq('validateur_id', userId),
      ]);
      pending = { plans: p.count ?? 0, calques: c.count ?? 0, dossiers: d.count ?? 0, photos: ph.count ?? 0 };
    } else if (role === ROLES.USER) {
      const [p, c, d, ph] = await Promise.all([
        supabase.from('plans').select('id', { count: 'exact', head: true }).in('statut', ['En attente', 'A compléter']).eq('validateur_id', userId),
        supabase.from('calques').select('id', { count: 'exact', head: true }).in('statut', ['En attente', 'A compléter']).eq('validateur_id', userId),
        supabase.from('dossiers').select('id', { count: 'exact', head: true }).in('statut', ['En attente', 'A compléter']).eq('validateur_id', userId),
        supabase.from('photos').select('id', { count: 'exact', head: true }).in('statut', ['en_attente', 'a_completer']).eq('validateur_id', userId),
      ]);
      pending = { plans: p.count ?? 0, calques: c.count ?? 0, dossiers: d.count ?? 0, photos: ph.count ?? 0 };
    }

    res.json({
      overview: {
        sites:         sitesRes.count        ?? 0,
        installations: installationsRes.count ?? 0,
        plans:         plansRes.count         ?? 0,
        dossiers:      dossiersRes.count      ?? 0,
      },
      pending,
    });
  } catch (err) {
    console.error('[dashboard/stats]', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur statistiques.', details: null } });
  }
});

router.get('/quick-access', authMiddleware, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [sitesRes, plansRes, dossiersRes] = await Promise.all([
      supabase.from('sites').select('id, nom').eq('actif', true).order('order', { ascending: true }).order('nom', { ascending: true }),
      supabase.from('plans').select('id, nom').eq('actif', true).eq('statut', 'Validé').order('order', { ascending: true }).limit(50),
      supabase.from('dossiers').select('id, nom').eq('statut', 'Validé').order('order', { ascending: true }).limit(50),
    ]);
    res.json({ sites: sitesRes.data ?? [], plans: plansRes.data ?? [], dossiers: dossiersRes.data ?? [] });
  } catch (err) {
    console.error('[dashboard/quick-access]', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur accès rapide.', details: null } });
  }
});

export default router;