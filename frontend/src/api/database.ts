import { apiClient } from './client';

export type Calque = {
  id: string;
  site_id: string | null;
  site_nom: string;
  installation_id: string | null;
  installation_nom: string;
  plan_id: string | null;
  plan_nom: string;
  nom: string;
  description: string | null;
  type: 'geographique' | 'non_geographique';
  niveau_accreditation: number;
  icone_path: string | null;
  icone_public_url: string | null;
  couleur: string | null;
  template_champs: Record<string, unknown> | null;
  zoom_min: number | null;
  zoom_max: number | null;
  order: number;
  owner_id: string | null;
  owner_nom: string;
  validateur_id: string | null;
  validateur_nom: string;
  date_validation: string | null;
  created_at: string;
  updated_at: string;
};

export type FichierPdf = {
  id: string;
  dossier_id: string;
  dossier_nom: string;
  nom: string;
  order: number;
  description: string | null;
  niveau_accreditation: number;
  statut: string;
  storage_path: string;
  storage_public_url: string | null;
  version: number;
  is_current: boolean;
  is_uploadable: boolean;
  date_propose: string | null;
  date_validation: string | null;
  proposedby_id: string | null;
  proposedby_nom: string;
  validateur_id: string | null;
  validateur_nom: string;
  created_at: string;
  updated_at: string;
};

export type Plan = {
  id: string;
  site_id: string | null;
  site_nom: string;
  installation_id: string | null;
  installation_nom: string;
  nom: string;
  description: string | null;
  svg_path: string | null;
  svg_public_url: string | null;
  actif: boolean;
  largeur_px: number | null;
  hauteur_px: number | null;
  order: number;
  date_propose: string | null;
  date_validation: string | null;
  proposedby_id: string | null;
  proposedby_nom: string;
  validateur_id: string | null;
  validateur_nom: string;
  created_at: string;
  updated_at: string;
};

export type Marker = {
  id: string;
  nom: string;
  storage_path: string;
  public_url: string;
  mots_cles: string[];
  couleur: string | null;
  created_at: string;
  updated_at: string;
};

export type PourValidation = {
  id: string;
  entity_type: 'fichier_pdf' | 'plan' | 'calque';
  proposedby_id: string;
  proposedby_nom: string;
  date_propose: string;
  payload: Record<string, unknown>;
  site_id: string | null;
  site_nom: string;
  installation_id: string | null;
  installation_nom: string;
  dossier_id: string | null;
  dossier_nom: string;
  plan_id: string | null;
  plan_nom: string;
  avec_rattachement: boolean;
  validateur_id: string;
  validateur_nom: string;
  storage_path_temp: string | null;
  storage_temp_public_url: string | null;
  statut: 'En attente' | 'A compléter' | 'Validé' | 'Rejeté';
  date_validation: string | null;
  commentaire_admin: string | null;
  id_valide: string | null;
  created_at: string;
  updated_at: string;
};

export const db = {
  list:   (entity: string) =>
    apiClient.get<Record<string, unknown>[]>(`/database/${entity}`),
  create: (entity: string, data: Record<string, unknown>) =>
    apiClient.post<Record<string, unknown>>(`/database/${entity}`, data),
  update: (entity: string, id: string, data: Record<string, unknown>) =>
    apiClient.patch<Record<string, unknown>>(`/database/${entity}/${id}`, data),
  remove: (entity: string, id: string) =>
    apiClient.delete(`/database/${entity}/${id}`),
  fetchConfig: () =>
    apiClient.get<{ accreditation: { min: number; max: number } }>('/database/config'),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ url: string }>('/database/upload/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listFichiersPdf: (dossierId: string) =>
    apiClient.get<FichierPdf[]>(`/database/fichiers_pdf?dossier_id=${encodeURIComponent(dossierId)}`),
  createFichier: (data: Record<string, unknown>) =>
    apiClient.post<FichierPdf>('/database/fichiers_pdf', data),
  updateFichier: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<FichierPdf>(`/database/fichiers_pdf/${id}`, data),
  removeFichier: (id: string) =>
    apiClient.delete(`/database/fichiers_pdf/${id}`),
  uploadPdf: (file: File, dossierId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('dossier_id', dossierId);
    return apiClient.post<{ url: string; path: string }>('/database/upload/pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  listCalques:    (planId: string) =>
    apiClient.get<Calque[]>(`/database/calques?plan_id=${encodeURIComponent(planId)}`),
  listCalquesGeo: (siteId: string) =>
    apiClient.get<Calque[]>(`/database/calques?site_id=${encodeURIComponent(siteId)}`),
  createCalque:  (data: Record<string, unknown>) =>
    apiClient.post<Calque>('/database/calques', data),
  updateCalque:  (id: string, data: Record<string, unknown>) =>
    apiClient.patch<Calque>(`/database/calques/${id}`, data),
  removeCalque:  (id: string) =>
    apiClient.delete(`/database/calques/${id}`),

  listMarkers: () =>
    apiClient.get<Marker[]>('/database/markers'),
  createMarker: (data: Record<string, unknown>) =>
    apiClient.post<Marker>('/database/markers', data),
  updateMarker: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<Marker>(`/database/markers/${id}`, data),
  removeMarker: (id: string) =>
    apiClient.delete(`/database/markers/${id}`),
  uploadMarker: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ url: string; path: string; color: string | null }>('/database/upload/marker', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadSvg: (file: File, planId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('plan_id', planId);
    return apiClient.post<{ url: string; path: string; width: number | null; height: number | null }>('/database/upload/svg', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getFichierById: (id: string) =>
    apiClient.get<FichierPdf>(`/database/fichiers_pdf/${id}`),
  getPlanById: (id: string) =>
    apiClient.get<Plan>(`/database/plans/${id}`),
  getCalqueById: (id: string) =>
    apiClient.get<Calque>(`/database/calques/${id}`),

  listUsers: () =>
    apiClient.get<{ id: string; nom: string }[]>('/database/users'),
  listAdmins: () =>
    apiClient.get<{ id: string; nom: string }[]>('/database/admins'),
  listPourValidation: () =>
    apiClient.get<PourValidation[]>('/database/pour_validation'),
  submitPourValidation: (data: Record<string, unknown>) =>
    apiClient.post<PourValidation>('/database/pour_validation', data),
  updatePourValidation: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<PourValidation>(`/database/pour_validation/${id}`, data),
  uploadPdfTemp: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ path: string }>('/database/upload/pdf_temp', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadSvgTemp: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ path: string }>('/database/upload/svg_temp', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
