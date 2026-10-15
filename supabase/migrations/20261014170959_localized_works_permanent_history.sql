-- SBON 17B: consolidated additive migration; apply only after production approval.
-- Supersedes every SQL draft under sql/. Does not change any existing table or row.
-- The migration runner supplies the transaction; do not combine with the drafts.
DO $$
BEGIN
 IF to_regclass('public.engineering_attack_plan_2026') IS NOT NULL OR to_regclass('public.engineering_localized_works') IS NOT NULL
    OR to_regclass('public.engineering_localized_work_updates') IS NOT NULL THEN
  RAISE EXCEPTION 'Tabelas de obras localizadas ja existem: verificar antes de migrar';
 END IF;
 IF to_regclass('public.contracts') IS NULL OR to_regclass('public.engineering_projects') IS NULL THEN
  RAISE EXCEPTION 'Dependencias de engenharia ausentes';
 END IF;
 IF to_regprocedure('private.capture_audit()') IS NULL THEN
  RAISE EXCEPTION 'Funcao de auditoria ausente';
 END IF;
 IF to_regprocedure('private.current_app_role()') IS NULL THEN
  RAISE EXCEPTION 'Funcao de permissao ausente';
 END IF;
END $$;
-- Cadastro canônico das frentes. O mesmo código de mancha pode referir duas frentes
-- distintas; a chave técnica row_key resolve isso sem reescrever o código original.
CREATE TABLE public.engineering_attack_plan_2026 (
 row_key text PRIMARY KEY CHECK (row_key ~ '^attack-2026-[0-9]{2}$'),
 stain_id text NOT NULL CHECK (length(btrim(stain_id)) BETWEEN 3 AND 80),
 municipality text NOT NULL CHECK (municipality IN ('Porangaba','Quadra','Tatuí','Conchas','Pereiras')),
 front text NOT NULL,
 segment_type text NOT NULL CHECK (segment_type IN ('WATER','SEWER')),
 planned_economies integer NOT NULL CHECK (planned_economies>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.engineering_attack_plan_2026(row_key,stain_id,municipality,front,segment_type,planned_economies)
VALUES
('attack-2026-01','553_AF_0005N','Porangaba','KM 162','WATER',52),
('attack-2026-02','764_AF_113','Quadra','Estância','WATER',33),
('attack-2026-03','553_AF_1850','Porangaba','Cletos','SEWER',34),
('attack-2026-04','553_AF_292','Porangaba','São João','WATER',44),
('attack-2026-05','553_AF_2','Porangaba','Vicente','WATER',3),
('attack-2026-06','553_AF_303','Porangaba','Garças','WATER',32),
('attack-2026-07','553_AF_0004N','Porangaba','Dos Lopes','WATER',25),
('attack-2026-08','553_AF_164','Porangaba','Bairro Estrada Rachel Miranda (Partes)','SEWER',34),
('attack-2026-09','553_AR_0002N','Porangaba','Booster Alto da Serra','WATER',18),
('attack-2026-10','553_AF_88','Porangaba','Vidas Novas','WATER',121),
('attack-2026-11','553_AF_0001N','Porangaba','Núcleo Santino','WATER',10),
('attack-2026-12','764_AR_0002N','Quadra','Cruz de Cedro','WATER',11),
('attack-2026-13','271_AR_0001N','Conchas','Estrada CH 12,5','WATER',13),
('attack-2026-14','271_AR_0001N','Conchas','Aflitos','WATER',17),
('attack-2026-15','553_AF_92','Porangaba','Ypê I','SEWER',51),
('attack-2026-16','553_AF_91','Porangaba','Ypê II','SEWER',201);

CREATE TABLE public.engineering_localized_works (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 engineering_project_id uuid REFERENCES public.engineering_projects(id),
 plan_row_key text NOT NULL REFERENCES public.engineering_attack_plan_2026(row_key),
 -- mancha_id é conferida obrigatoriamente com plan_row_key pelo trigger.
 mancha_id text NOT NULL CHECK (length(btrim(mancha_id)) BETWEEN 3 AND 80),
 municipality text NOT NULL CHECK (municipality IN ('Porangaba','Quadra','Tatuí','Conchas','Pereiras')),
 segment_type text NOT NULL CHECK (segment_type IN ('WATER','SEWER')),
 kind text NOT NULL CHECK (kind IN ('RESERVOIR','BOOSTER','EEE','EEAB','EEAT','OTHER')),
 designation text NOT NULL CHECK (length(btrim(designation)) BETWEEN 1 AND 150),
 quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
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
 pump_power_cv numeric(12,3) CHECK (pump_power_cv >= 0 AND pump_power_cv < 'Infinity'::numeric),
 flow_lps numeric(12,4) CHECK (flow_lps >= 0 AND flow_lps < 'Infinity'::numeric),
 head_mca numeric(12,3) CHECK (head_mca >= 0 AND head_mca < 'Infinity'::numeric),
 capacity_m3 numeric(14,3) CHECK (capacity_m3 >= 0 AND capacity_m3 < 'Infinity'::numeric),
 material text CHECK (material IS NULL OR length(material) <= 80),
 hydraulic_project_status text CHECK (hydraulic_project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 electrical_project_status text CHECK (electrical_project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 structural_project_status text CHECK (structural_project_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED')),
 contractual_item_code text CHECK (contractual_item_code IS NULL OR length(contractual_item_code) <= 80),
 approved_budget_brl numeric(18,2) CHECK (approved_budget_brl >= 0 AND approved_budget_brl < 'Infinity'::numeric),
 notes text CHECK (notes IS NULL OR length(notes) <= 2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 CHECK (approved_budget_brl IS NULL OR budget_status = 'APPROVED')
);
CREATE INDEX localized_work_updates_latest_idx ON public.engineering_localized_work_updates(localized_work_id, reference_date DESC, created_at DESC, id DESC);
-- Check ownership of project, contract, municipality, system and authorized SBON 17B contract.
CREATE FUNCTION private.validate_sbon17b_localized_work() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 -- Toda obra pertence a uma frente canônica do Plano de Ataque e ao contrato ativo.
 IF NOT EXISTS (
  SELECT 1 FROM public.contracts c
  JOIN public.engineering_attack_plan_2026 plan ON plan.row_key=NEW.plan_row_key
  WHERE c.id=NEW.contract_id AND c.code='SBON 17B' AND c.active=true
   AND plan.stain_id=NEW.mancha_id AND plan.municipality=NEW.municipality
   AND plan.segment_type=NEW.segment_type
 ) THEN
  RAISE EXCEPTION 'Contrato ou mancha/municipio/sistema incompativel com o Plano de Ataque' USING ERRCODE='23514';
 END IF;
 -- Vínculo opcional: a frente permanece canônica e não cria projetos automaticamente.
 -- Quando informado, sua pertença ao contrato/cidade/sistema passa a ser obrigatória.
 IF NEW.engineering_project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.engineering_projects p
  WHERE p.id=NEW.engineering_project_id AND p.contract_id=NEW.contract_id
   AND p.active=true AND p.municipality=NEW.municipality
   AND p.segment_type::text=NEW.segment_type
 ) THEN
  RAISE EXCEPTION 'Projeto de Engenharia nao pertence ao contrato/cidade/sistema da obra' USING ERRCODE='23514';
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
ALTER TABLE public.engineering_attack_plan_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY sbon17b_plan_read ON public.engineering_attack_plan_2026 FOR SELECT TO authenticated
 USING ((SELECT private.current_app_role()) IN ('ADMIN','EDITOR','GESTOR','DIRETORIA'));
ALTER TABLE public.engineering_localized_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engineering_localized_work_updates ENABLE ROW LEVEL SECURITY;
-- Policies limited to active SBON 17B contract and authenticated user role.
-- NOTE: Os papeis atualmente utilizados no sistema sao globais; nao presumir ACL
-- por contrato ate confirmar a estrutura de atribuicao de usuarios.
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
REVOKE ALL ON public.engineering_attack_plan_2026, public.engineering_localized_works, public.engineering_localized_work_updates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.engineering_attack_plan_2026 TO authenticated;
GRANT SELECT, INSERT ON public.engineering_localized_works TO authenticated;
GRANT SELECT, INSERT ON public.engineering_localized_work_updates TO authenticated;


-- Identity is permanent; revisions append snapshots and never rewrite the parent.
CREATE TRIGGER sbon17b_localized_identity_guard BEFORE UPDATE OR DELETE ON public.engineering_localized_works
 FOR EACH ROW EXECUTE FUNCTION private.sbon17b_localized_history_append_only();

CREATE FUNCTION private.stamp_sbon17b_localized() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 NEW.created_by = (SELECT auth.uid());
 NEW.created_at = clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER sbon17b_works_stamp BEFORE INSERT ON public.engineering_localized_works
 FOR EACH ROW EXECUTE FUNCTION private.stamp_sbon17b_localized();
CREATE TRIGGER sbon17b_updates_stamp BEFORE INSERT ON public.engineering_localized_work_updates
 FOR EACH ROW EXECUTE FUNCTION private.stamp_sbon17b_localized();

CREATE FUNCTION private.validate_sbon17b_localized_update() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_work public.engineering_localized_works%ROWTYPE; v_statuses text[];
BEGIN
 SELECT w.* INTO v_work FROM public.engineering_localized_works w
 JOIN public.contracts c ON c.id=w.contract_id
 WHERE w.id=NEW.localized_work_id AND w.active AND c.active AND c.code='SBON 17B';
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Obra inexistente ou contrato inativo' USING ERRCODE='23514';
 END IF;
 IF v_work.engineering_project_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.engineering_projects p WHERE p.id=v_work.engineering_project_id AND p.active
   AND p.contract_id=v_work.contract_id AND p.municipality=v_work.municipality AND p.segment_type::text=v_work.segment_type
 ) THEN
  RAISE EXCEPTION 'Vínculo de Engenharia inativo ou divergente' USING ERRCODE='23514';
 END IF;
 IF NEW.hydraulic_project_status IS NULL THEN
  RAISE EXCEPTION 'Situação hidráulica obrigatória' USING ERRCODE='23514';
 END IF;
 IF v_work.kind='RESERVOIR' AND NEW.capacity_m3 IS NULL THEN
  RAISE EXCEPTION 'Capacidade do reservatório obrigatória' USING ERRCODE='23514';
 END IF;
 IF v_work.kind='EEE' AND (NEW.electrical_project_status IS NULL OR NEW.structural_project_status IS NULL) THEN
  RAISE EXCEPTION 'EEE exige situação elétrica e estrutural' USING ERRCODE='23514';
 END IF;
 v_statuses=CASE WHEN v_work.kind='EEE' THEN
  ARRAY[NEW.hydraulic_project_status,NEW.electrical_project_status,NEW.structural_project_status]
  ELSE ARRAY[NEW.hydraulic_project_status] END;
 NEW.project_status=CASE
  WHEN NOT EXISTS (SELECT 1 FROM unnest(v_statuses) s WHERE s <> 'APPROVED') THEN 'APPROVED'
  WHEN NOT EXISTS (SELECT 1 FROM unnest(v_statuses) s WHERE s NOT IN ('COMPLETED','APPROVED')) THEN 'COMPLETED'
  WHEN NOT EXISTS (SELECT 1 FROM unnest(v_statuses) s WHERE s <> 'NOT_STARTED') THEN 'NOT_STARTED'
  ELSE 'IN_PROGRESS' END;
 RETURN NEW;
END $$;
CREATE TRIGGER sbon17b_updates_validate BEFORE INSERT ON public.engineering_localized_work_updates
 FOR EACH ROW EXECUTE FUNCTION private.validate_sbon17b_localized_update();

-- A direct Data API INSERT cannot leave a work without its first snapshot.
CREATE FUNCTION private.sbon17b_localized_require_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.engineering_localized_work_updates u WHERE u.localized_work_id=NEW.id) THEN
  RAISE EXCEPTION 'Cadastro exige primeiro snapshot na mesma transação' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sbon17b_localized_first_snapshot AFTER INSERT ON public.engineering_localized_works
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.sbon17b_localized_require_snapshot();

CREATE UNIQUE INDEX sbon17b_localized_identity_idx ON public.engineering_localized_works
 (contract_id, plan_row_key, kind, lower(btrim(designation)));
CREATE INDEX sbon17b_localized_project_idx ON public.engineering_localized_works(engineering_project_id);
CREATE INDEX sbon17b_localized_plan_idx ON public.engineering_localized_works(plan_row_key);
CREATE INDEX sbon17b_localized_author_idx ON public.engineering_localized_works(created_by);
CREATE INDEX sbon17b_localized_updates_author_idx ON public.engineering_localized_work_updates(created_by);

REVOKE ALL ON FUNCTION private.validate_sbon17b_localized_work(), private.sbon17b_localized_history_append_only(),
 private.stamp_sbon17b_localized(), private.validate_sbon17b_localized_update(), private.sbon17b_localized_require_snapshot()
 FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_sbon17b_localized_works AFTER INSERT ON public.engineering_localized_works
 FOR EACH ROW EXECUTE FUNCTION private.capture_audit();
CREATE TRIGGER audit_sbon17b_localized_updates AFTER INSERT ON public.engineering_localized_work_updates
 FOR EACH ROW EXECUTE FUNCTION private.capture_audit();

CREATE VIEW public.engineering_localized_work_current WITH (security_invoker = true) AS
 SELECT w.*, to_jsonb(u) AS current_update FROM public.engineering_localized_works w
 LEFT JOIN LATERAL (
  SELECT s.* FROM public.engineering_localized_work_updates s WHERE s.localized_work_id=w.id
  ORDER BY s.reference_date DESC, s.created_at DESC, s.id DESC LIMIT 1
 ) u ON true;
REVOKE ALL ON public.engineering_localized_work_current FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.engineering_localized_work_current TO authenticated;

CREATE OR REPLACE FUNCTION public.add_sbon17b_localized_work_update(
  p_work_id uuid, p_update jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_contract uuid;
BEGIN
 IF auth.uid() IS NULL OR (SELECT private.current_app_role()) IS NULL OR (SELECT private.current_app_role()) NOT IN ('ADMIN','EDITOR') THEN
   RAISE EXCEPTION 'Perfil sem permissao' USING ERRCODE='42501';
 END IF;
 SELECT w.contract_id INTO v_contract FROM public.engineering_localized_works w
   JOIN public.contracts c ON c.id=w.contract_id
  WHERE w.id=p_work_id AND w.active AND c.active AND c.code='SBON 17B';
 IF v_contract IS NULL THEN RAISE EXCEPTION 'Obra localizada inexistente ou inativa' USING ERRCODE='23514'; END IF;
 IF nullif(p_update->>'reference_date','') IS NULL THEN
   RAISE EXCEPTION 'Data de referencia obrigatoria' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.engineering_localized_work_updates (
  localized_work_id,reference_date,project_status,physical_status,budget_status,
  pump_power_cv,flow_lps,head_mca,capacity_m3,material,
  hydraulic_project_status,electrical_project_status,structural_project_status,
  contractual_item_code,approved_budget_brl,notes
 ) VALUES (
  p_work_id,(p_update->>'reference_date')::date,
  coalesce(p_update->>'project_status','NOT_STARTED'),
  coalesce(p_update->>'physical_status','NOT_STARTED'),
  coalesce(p_update->>'budget_status','NOT_BUDGETED'),
  nullif(p_update->>'pump_power_cv','')::numeric,
  nullif(p_update->>'flow_lps','')::numeric,
  nullif(p_update->>'head_mca','')::numeric,
  nullif(p_update->>'capacity_m3','')::numeric,
  nullif(p_update->>'material',''),
  coalesce(nullif(p_update->>'hydraulic_project_status',''),p_update->>'project_status','NOT_STARTED'),
  nullif(p_update->>'electrical_project_status',''),
  nullif(p_update->>'structural_project_status',''),
  nullif(p_update->>'contractual_item_code',''),
  nullif(p_update->>'approved_budget_brl','')::numeric,
  nullif(p_update->>'notes','')
 ) RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.add_sbon17b_localized_work_update(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_sbon17b_localized_work_update(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_sbon17b_localized_work(p_work jsonb, p_update jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_contract_id uuid;
  v_plan record;
BEGIN
  IF auth.uid() IS NULL OR (SELECT private.current_app_role()) IS NULL OR (SELECT private.current_app_role()) NOT IN ('ADMIN', 'EDITOR') THEN
    RAISE EXCEPTION 'Perfil sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_contract_id FROM public.contracts WHERE code = 'SBON 17B' AND active = true;
  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contrato ativo não encontrado' USING ERRCODE = '23514';
  END IF;
  SELECT row_key, stain_id, municipality, segment_type INTO v_plan
  FROM public.engineering_attack_plan_2026 WHERE row_key = p_work->>'plan_row_key';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frente não encontrada no Plano de Ataque' USING ERRCODE = '23514';
  END IF;
  IF p_work->>'kind' NOT IN ('RESERVOIR','BOOSTER','EEE','EEAB','EEAT','OTHER') THEN
    RAISE EXCEPTION 'Tipo de obra inválido' USING ERRCODE = '23514';
  END IF;
  IF (p_work->>'kind') = 'EEE' AND v_plan.segment_type <> 'SEWER' THEN
    RAISE EXCEPTION 'EEE exige sistema Esgoto' USING ERRCODE = '23514';
  END IF;
  IF (p_work->>'kind') IN ('BOOSTER','RESERVOIR') AND v_plan.segment_type <> 'WATER' THEN
    RAISE EXCEPTION 'Reservatório/Booster exige Água' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.engineering_localized_works
   (contract_id, engineering_project_id, plan_row_key, mancha_id, municipality, segment_type, kind, designation, quantity)
  VALUES
   (v_contract_id, nullif(p_work->>'engineering_project_id','')::uuid,
    v_plan.row_key, v_plan.stain_id, v_plan.municipality, v_plan.segment_type,
    p_work->>'kind', btrim(p_work->>'designation'), (p_work->>'quantity')::integer)
  RETURNING id INTO v_id;
  PERFORM public.add_sbon17b_localized_work_update(v_id, p_update);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_sbon17b_localized_work(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sbon17b_localized_work(jsonb,jsonb) TO authenticated;
