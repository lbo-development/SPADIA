export type Role = 'Admin_app' | 'Admin_data' | 'User' | 'Viewer';
export type Statut = 'en_attente' | 'a_completer' | 'valide' | 'rejete';

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  };
}

export interface UserProfile {
  id: string;
  nom: string;
  email: string;
  role: Role;
  niveau_accreditation: number;
  last_context: LastContext | null;
  actif: boolean;
  session_token?: string | null;
  session_expires_at?: string | null;
  last_activity_at?: string | null;
}

export interface LastContext {
  site_id: string | null;
  zoom: number | null;
  calques_actifs: string[];
  plan_id: string | null;
}