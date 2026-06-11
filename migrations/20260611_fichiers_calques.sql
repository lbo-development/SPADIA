-- Migration : table fichiers_calques
-- Date : 2026-06-11
-- Description : association de fichiers PDF aux calques (géo et non-géo)
--
-- Règles d'accès :
--   VISUALISATION  — user avec niveau_accreditation >= fichier.niveau_accreditation
--   TÉLÉCHARGEMENT — owner du calque + admins toujours ;
--                    autres users uniquement si is_downloadable = true
--   GESTION (CRUD) — owner du calque + admins uniquement
-- Storage : bucket Documents / FichiersCalques/{calque_id}/{timestamp}-{nom}.pdf

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.fichiers_calques (
  id                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  calque_id             uuid                     NOT NULL,
  nom                   character varying        NOT NULL,
  "order"               integer                  NOT NULL DEFAULT 0,
  description           text,
  niveau_accreditation  integer                  NOT NULL DEFAULT 0
                          CHECK (niveau_accreditation >= 0 AND niveau_accreditation <= 4),
  storage_path          character varying        NOT NULL,
  is_downloadable       boolean                  NOT NULL DEFAULT false,
  created_at            timestamp with time zone NOT NULL DEFAULT now(),
  updated_at            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fichiers_calques_pkey PRIMARY KEY (id),
  CONSTRAINT fichiers_calques_calque_id_fkey
    FOREIGN KEY (calque_id) REFERENCES public.calques (id) ON DELETE CASCADE
);

CREATE INDEX fichiers_calques_calque_id_idx ON public.fichiers_calques (calque_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.fichiers_calques ENABLE ROW LEVEL SECURITY;

-- Lecture : user actif dont le niveau d'accréditation est suffisant
-- (la visu du PDF est autorisée ; le téléchargement est géré côté API)
CREATE POLICY "fichiers_calques_select"
  ON public.fichiers_calques FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.actif = true
        AND up.niveau_accreditation >= fichiers_calques.niveau_accreditation
    )
  );

-- Insertion : admin ou owner du calque
CREATE POLICY "fichiers_calques_insert"
  ON public.fichiers_calques FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.actif = true
        AND (
          up.role IN ('Admin_app', 'Admin_data')
          OR EXISTS (
            SELECT 1 FROM public.calques c
            WHERE c.id = calque_id AND c.owner_id = auth.uid()
          )
        )
    )
  );

-- Mise à jour : admin ou owner du calque uniquement
CREATE POLICY "fichiers_calques_update"
  ON public.fichiers_calques FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.actif = true
        AND (
          up.role IN ('Admin_app', 'Admin_data')
          OR EXISTS (
            SELECT 1 FROM public.calques c
            WHERE c.id = calque_id AND c.owner_id = auth.uid()
          )
        )
    )
  );

-- Suppression : admin ou owner du calque uniquement
CREATE POLICY "fichiers_calques_delete"
  ON public.fichiers_calques FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.actif = true
        AND (
          up.role IN ('Admin_app', 'Admin_data')
          OR EXISTS (
            SELECT 1 FROM public.calques c
            WHERE c.id = calque_id AND c.owner_id = auth.uid()
          )
        )
    )
  );

-- ── Trigger updated_at ───────────────────────────────────────────────────────

-- (crée la fonction si elle n'existe pas déjà)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fichiers_calques_updated_at
  BEFORE UPDATE ON public.fichiers_calques
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
