import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { supabase } from '../supabase/client';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Trop de tentatives. Réessayez dans 15 minutes.', details: null } },
});

const router = Router();
const SESSION_DURATION_HOURS  = parseInt(process.env.SESSION_DURATION_HOURS      || '8',  10);
const INACTIVITY_MINUTES      = parseInt(process.env.SESSION_INACTIVITY_MINUTES  || '30', 10);

router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, nom')
      .order('nom', { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur lecture utilisateurs.', details: null } });
  }
});

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Identifiant et mot de passe requis.', details: null } });
    return;
  }

  const { data: found } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (!found?.email) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Identifiants incorrects.', details: null } });
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: found.email as string, password });

  if (authError || !authData?.user || !authData?.session) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Email ou mot de passe incorrect.', details: null } });
    return;
  }

  const authUserId = authData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, role, niveau_accreditation, nom, email, avatar_url, last_context, actif')
    .eq('id', authUserId)
    .single();

  if (profileError || !profile) {
    console.error('[login] Profile error:', profileError);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Profil introuvable.', details: null } });
    return;
  }

  if (!profile.actif) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Compte désactivé.', details: null } });
    return;
  }

  const sessionToken = uuidv4();
  const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600000).toISOString();

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ session_token: sessionToken, session_expires_at: sessionExpiresAt, last_activity_at: new Date().toISOString() })
    .eq('id', authUserId);

  if (updateError) {
    console.error('[login] Update error:', updateError);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Impossible de créer la session.', details: null } });
    return;
  }

  res.status(200).json({
    jwt: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    session_token: sessionToken,
    user: {
      id: profile.id,
      nom: profile.nom,
      email: profile.email,
      role: profile.role,
      niveau_accreditation: profile.niveau_accreditation,
      avatar_url: profile.avatar_url ?? null,
      last_context: profile.last_context,
    },
  });
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refresh_token } = req.body;
  const sessionToken = req.headers['x-session-token'] as string | undefined;

  if (!refresh_token || !sessionToken) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Tokens manquants.', details: null } });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, session_token, session_expires_at, last_activity_at, actif')
    .eq('session_token', sessionToken)
    .single();

  if (profileError || !profile) {
    res.status(401).json({ error: { code: 'SESSION_INVALIDATED', message: 'Session invalide.', details: null } });
    return;
  }
  if (!profile.actif) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Compte désactivé.', details: null } });
    return;
  }
  if (profile.session_expires_at && new Date(profile.session_expires_at) < new Date()) {
    res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expirée.', details: null } });
    return;
  }
  if (profile.last_activity_at) {
    const diff = (Date.now() - new Date(profile.last_activity_at).getTime()) / 1000 / 60;
    if (diff > INACTIVITY_MINUTES) {
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expirée par inactivité.', details: null } });
      return;
    }
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({ refresh_token });
  if (refreshError || !refreshData.session) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Impossible de renouveler le token.', details: null } });
    return;
  }

  await supabase.from('user_profiles').update({ last_activity_at: new Date().toISOString() }).eq('id', profile.id);

  res.json({ jwt: refreshData.session.access_token, refresh_token: refreshData.session.refresh_token });
});

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await supabase.from('user_profiles').update({ session_token: null, session_expires_at: null, last_activity_at: null }).eq('id', req.user!.id);
  await supabase.auth.signOut();
  res.status(204).send();
});

export default router;