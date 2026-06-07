import { apiClient } from './client';
import type { Statut } from '@/types';

export interface DashboardStats {
  sites_total:          number;
  dossiers_total:       number;
  dossiers_accessibles: number;
  fichiers_accessibles: number;
  calques_accessibles:  number;
  points_accessibles:   number;
  calques_owned:        number;
}

export interface DashboardFavori {
  id:         string;
  user_id:    string;
  label:      string;
  node_id:    string;
  node_type:  string;
  expanded:   string[];
  created_at: string;
}

export interface DashboardPV {
  id:               string;
  entity_type:      'fichier_pdf' | 'plan' | 'calque';
  proposedby_id:    string;
  proposedby_nom:   string;
  date_propose:     string;
  payload:          Record<string, unknown>;
  site_id:          string | null;
  site_nom:         string;
  installation_id:  string | null;
  installation_nom: string;
  dossier_id:       string | null;
  dossier_nom:      string;
  plan_id:          string | null;
  plan_nom:         string;
  avec_rattachement: boolean;
  validateur_id:    string | null;
  validateur_nom:   string;
  statut:           Statut;
  date_validation:  string | null;
  commentaire_admin: string | null;
  id_valide:        string | null;
  created_at:       string;
}

export interface DashboardCalque {
  id:                   string;
  nom:                  string;
  type:                 'geographique' | 'non_geographique';
  niveau_accreditation: number;
  site_id:              string | null;
  site_nom:             string;
  installation_id:      string | null;
  installation_nom:     string;
  plan_id:              string | null;
  plan_nom:             string;
  plan_site_id:         string | null;
  plan_installation_id: string | null;
  validateur_id:        string | null;
  validateur_nom:       string;
  date_validation:      string | null;
  created_at:           string;
}

export interface DashboardData {
  favoris:     DashboardFavori[];
  soumis:      DashboardPV[];
  aValider:    DashboardPV[];
  mesDemandes: DashboardPV[];
  mesCalques:  DashboardCalque[];
}

export const dashboardApi = {
  getStats: () => apiClient.get<DashboardStats>('/dashboard/stats'),
  getData:  () => apiClient.get<DashboardData>('/dashboard/data'),
};
