export type Role = 'Admin_app' | 'Admin_data' | 'User' | 'Viewer';
export type Statut = 'En attente' | 'A compléter' | 'Validé' | 'Rejeté';

export interface UserProfile {
  id: string;
  nom: string;
  email: string;
  role: Role;
  niveau_accreditation: number;
  avatar_url?: string;
  last_context: LastContext | null;
}

export interface LastContext {
  site_id: string | null;
  zoom: number | null;
  calques_actifs: string[];
  plan_id: string | null;
}