import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase/client';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();
const SESSION_DURATION_HOURS = parseInt(process.env.SESSION_DURATION_HOURS || '8', 10);

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email et mot de passe requis.', details: null } });
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

  if (authError || !authData?.user || !authData?.session) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Email ou mot de passe incorrect.', details: null } });
    return;
  }

  const userId = authData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, role, niveau_accreditation, nom, email, last_context, actif')
    .eq('id', userId)
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
    .eq('id', userId);

  if (updateError) {
    console.error('[login] Update error:', updateError);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Impossible de créer la session.', details: null } });
    return;
  }

  res.status(200).json({
    jwt: authData.session.access_token,
    session_token: sessionToken,
    user: {
      id: profile.id,
      nom: profile.nom,
      email: profile.email,
      role: profile.role,
      niveau_accreditation: profile.niveau_accreditation,
      last_context: profile.last_context,
    },
  });
});

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await supabase.from('user_profiles').update({ session_token: null, session_expires_at: null, last_activity_at: null }).eq('id', req.user!.id);
  await supabase.auth.signOut();
  res.status(204).send();
});

export default router;