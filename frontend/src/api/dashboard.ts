import { apiClient } from './client';

export interface DashboardStats {
  overview: {
    sites: number;
    installations: number;
    plans: number;
    dossiers: number;
  };
  pending: {
    plans: number;
    calques: number;
    dossiers: number;
    photos: number;
  };
}

export interface QuickAccessData {
  sites:    { id: string; nom: string }[];
  plans:    { id: string; nom: string }[];
  dossiers: { id: string; nom: string }[];
}

export const dashboardApi = {
  getStats:       () => apiClient.get<DashboardStats>('/dashboard/stats'),
  getQuickAccess: () => apiClient.get<QuickAccessData>('/dashboard/quick-access'),
};