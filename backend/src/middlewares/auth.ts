import { Request, Response, NextFunction } from 'express';
import { supabase } from '../supabase/client';

const INACTIVITY_MINUTES = parseInt(process.env.SESSION_INACTIVITY_MINUTES || '30', 10);

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; niveau_accreditation: number };
}

export async function authMiddleware(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Token JWT manquant.', details: null } });
    return;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Token JWT invalide ou expiré.', details: null } });
    return;
  }

  const userId = authUser.id;
  const sessionToken = req.headers['x-session-token'] as string | undefined;
  if (!sessionToken) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session token manquant.', details: null } });
    return;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, role, niveau_accreditation, session_token, session_expires_at, last_activity_at, actif')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Profil introuvable.', details: null } });
    return;
  }

  if (!profile.actif) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Compte désactivé.', details: null } });
    return;
  }

  if (profile.session_token !== sessionToken) {
    res.status(401).json({ error: { code: 'SESSION_INVALIDATED', message: 'Session fermée car connexion ouverte sur un autre poste.', details: null } });
    return;
  }

  if (profile.session_expires_at && new Date(profile.session_expires_at) < new Date()) {
    res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expirée. Veuillez vous reconnecter.', details: null } });
    return;
  }

  if (profile.last_activity_at) {
    const diff = (Date.now() - new Date(profile.last_activity_at).getTime()) / 1000 / 60;
    if (diff > INACTIVITY_MINUTES) {
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: `Session expirée par inactivité (${INACTIVITY_MINUTES} min).`, details: null } });
      return;
    }
  }

  await supabase.from('user_profiles').update({ last_activity_at: new Date().toISOString() }).eq('id', userId);

  req.user = { id: userId, role: profile.role, niveau_accreditation: profile.niveau_accreditation };
  next();
}