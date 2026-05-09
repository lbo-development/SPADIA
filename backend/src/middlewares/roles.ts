import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export const ROLES = {
  ADMIN_APP:  'Admin_app',
  ADMIN_DATA: 'Admin_data',
  USER:       'User',
  VIEWER:     'Viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Non authentifié.', details: null } });
      return;
    }
    if (!allowedRoles.includes(req.user.role as Role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Rôle insuffisant.', details: null } });
      return;
    }
    next();
  };
}

export function requireAccreditation(minLevel: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Non authentifié.', details: null } });
      return;
    }
    const exempt: Role[] = [ROLES.ADMIN_APP, ROLES.ADMIN_DATA, ROLES.VIEWER];
    if (exempt.includes(req.user.role as Role)) { next(); return; }
    if (req.user.niveau_accreditation < minLevel) {
      res.status(403).json({ error: { code: 'ACCREDITATION_REQUIRED', message: `Niveau ${minLevel} requis.`, details: null } });
      return;
    }
    next();
  };
}