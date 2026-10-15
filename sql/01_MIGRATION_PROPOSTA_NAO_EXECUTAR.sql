-- SBON 17B | PROPOSTA DE MIGRATION | NAO EXECUTAR EM PRODUCAO
-- Requer revisao de schema real, politicas vigentes, autorizacao e backup.
-- Esta migration NAO modifica engenharia_projects nem engenharia_project_updates.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.engineering_localized_works') IS NOT NULL
    OR to_regclass('public.engineering_localized_work_updates') IS NOT NULL THEN
  RAISE EXCEPTION 'Tabelas de obras localizadas ja existem: verificar antes de migrar';
 END IF;
 IF to_regclass('public.contracts') IS NULL OR to_regclass('public.engineering_projects') IS NULL THEN
  RAISE EXCEPTION 'Dependencias de engenharia ausentes';
 END IF;
 IF to_regprocedure('private.current_app_role()') IS NULL THEN
  RAISE EXCEPTION 'Funcao de permissao ausente';
 END IF;
END $$;
CREATE TABLE public.engineering_localized_works (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 engineering_project_id uuid NOT NULL REFERENCES public.engineering_projects(id),
 -- mancha_id e referencia informativa ate existir tabela canonica de manchas.
 mancha_id text NOT NULL CHECK (length(btrim(mancha_id)) BETWEEN 3 AND 80),
 municipality text NOT NULL CHECK (municipality IN ('Porangaba','Quadra','Tatuí','Conchas','Pereiras')),
 segment_type text NOT NULL CHECK (segment_type IN ('WATER','SEWER')),
 kind text NOT NULL CHECK (kind IN ('RESERVOIR','BOOSTER','EEE','EEAB','EEAT','OTHER')),
 designation text NOT NULL CHECK (length(btrim(designation)) BETWEEN 1 AND 150),
 quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 CHECK (kind <> 'EEE' OR segment_type = 'SEWER'),
 CHECK (kind NOT IN ('RESERVOIR','BOOSTER') OR segment_type = 'WATER')
);
CREATE INDEX engineering_localized_works_contract_idx ON public.engineering_localized_works(contract_id, municipality, kind);
CREATE TABLE public.engineering_localized_work_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 localized_work_id uuid NOT NULL REFERENCES public.engineering_localized_works(id),
 reference_date date NOT NULL,
 project_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 physical_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (physical_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
 budget_status text NOT NULL DEFAULT 'NOT_BUDGETED' CHECK (budget_status IN ('NOT_BUDGETED','IN_PREPARATION','BUDGETED','UNDER_REVIEW','APPROVED')),
 pump_power_cv numeric(12,3) CHECK (pump_power_cv >= 0),
 flow_lps numeric(12,4) CHECK (flow_lps >= 0),
 head_mca numeric(12,3) CHECK (head_mca >= 0),
 capacity_m3 numeric(14,3) CHECK (capacity_m3 >= 0),
 material text CHECK (material IS NULL OR length(material) <= 80),
 hydraulic_project_status text CHECK (hydraulic_project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 electrical_project_status text CHECK (electrical_project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 structural_project_status text CHECK (structural_project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 contractual_item_code text CHECK (contractual_item_code IS NULL OR length(contractual_item_code) <= 80),
 approved_budget_brl numeric(18,2) CHECK (approved_budget_brl >= 0),
 notes text CHECK (notes IS NULL OR length(notes) <= 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 CHECK (approved_budget_brl IS NULL OR budget_status = 'APPROVED')
);
CREATE INDEX localized_work_updates_latest_idx ON public.engineering_localized_work_updates(localized_work_id, reference_date DESC, created_at DESC, id DESC);
-- Check ownership of project, contract, municipality, system and authorized SBON 17B contract.
CREATE FUNCTION private.validate_sbon17b_localized_work() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.contracts c
  JOIN public.engineering_projects p ON p.contract_id=c.id
  WHERE c.id=NEW.contract_id AND c.code='SBON 17B' AND c.active=true
   AND p.id=NEW.engineering_project_id AND p.active=true
   AND p.municipality=NEW.municipality AND p.segment_type::text=NEW.segment_type
 ) THEN
  RAISE EXCEPTION 'Projeto nao pertence ao contrato SBON 17B ou cidade/sistema divergente' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sbon17b_localized_work_validate BEFORE INSERT OR UPDATE ON public.engineering_localized_works
 FOR EACH ROW EXECUTE FUNCTION private.validate_sbon17b_localized_work();
-- Immutable history, even if future UPDATE/DELETE grants are introduced.
CREATE FUNCTION private.sbon17b_localized_history_append_only() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 RAISE EXCEPTION 'Historico imutavel: apenas INSERT' USING ERRCODE='23514';
END $$;
CREATE TRIGGER sbon17b_localized_history_guard BEFORE UPDATE OR DELETE ON public.engineering_localized_work_updates
 FOR EACH ROW EXECUTE FUNCTION private.sbon17b_localized_history_append_only();
ALTER TABLE public.engineering_localized_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engineering_localized_work_updates ENABLE ROW LEVEL SECURITY;
-- Policies limited to active SBON 17B contract, active user role, and project ownership.
CREATE POLICY sbon17b_works_read ON public.engineering_localized_works FOR SELECT TO authenticated
 USING ((SELECT private.current_app_role()) IN ('ADMIN','EDITOR','GESTOR','DIRETORIA')
  AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id AND c.code='SBON 17B' AND c.active));
CREATE POLICY sbon17b_works_insert ON public.engineering_localized_works FOR INSERT TO authenticated
 WITH CHECK ((SELECT private.current_app_role()) IN ('ADMIN','EDITOR') AND created_by=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id AND c.code='SBON 17B' AND c.active));
-- No UPDATE/DELETE on parent until controlled correction mechanism is implemented.
CREATE POLICY sbon17b_updates_read ON public.engineering_localized_work_updates FOR SELECT TO authenticated
 USING ((SELECT private.current_app_role()) IN ('ADMIN','EDITOR','GESTOR','DIRETORIA')
  AND EXISTS (SELECT 1 FROM public.engineering_localized_works w WHERE w.id=localized_work_id));
CREATE POLICY sbon17b_updates_insert ON public.engineering_localized_work_updates FOR INSERT TO authenticated
 WITH CHECK ((SELECT private.current_app_role()) IN ('ADMIN','EDITOR') AND created_by=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.engineering_localized_works w WHERE w.id=localized_work_id));
REVOKE ALL ON public.engineering_localized_works, public.engineering_localized_work_updates FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.engineering_localized_works TO authenticated;
GRANT SELECT, INSERT ON public.engineering_localized_work_updates TO authenticated;
COMMIT;
