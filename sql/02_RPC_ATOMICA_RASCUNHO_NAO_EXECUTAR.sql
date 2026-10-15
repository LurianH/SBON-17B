-- Depende de SQL_PROPOSTA_NAO_EXECUTAR.sql (revisao) ter sido aplicado depois de auditoria e autorização.
-- NÃO EXECUTAR EM PRODUÇÃO SEM REVISÃO. Grava cadastro + primeiro snapshot atomicamente.
CREATE OR REPLACE FUNCTION public.create_sbon17b_localized_work(p_work jsonb, p_update jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_contract_id uuid;
  v_plan record;
BEGIN
  IF auth.uid() IS NULL OR (SELECT private.current_app_role()) NOT IN ('ADMIN', 'EDITOR') THEN
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
  INSERT INTO public.engineering_localized_work_updates
   (localized_work_id, reference_date, project_status, physical_status, budget_status,
    pump_power_cv, flow_lps, head_mca, capacity_m3, material,
    hydraulic_project_status, electrical_project_status, structural_project_status,
    contractual_item_code, approved_budget_brl, notes)
  VALUES
   (v_id, (p_update->>'reference_date')::date,
    coalesce(p_update->>'project_status','NOT_STARTED'),
    coalesce(p_update->>'physical_status','NOT_STARTED'),
    coalesce(p_update->>'budget_status','NOT_BUDGETED'),
    nullif(p_update->>'pump_power_cv','')::numeric,
    nullif(p_update->>'flow_lps','')::numeric,
    nullif(p_update->>'head_mca','')::numeric,
    nullif(p_update->>'capacity_m3','')::numeric,
    p_update->>'material',
    p_update->>'hydraulic_project_status',p_update->>'electrical_project_status',
    p_update->>'structural_project_status',p_update->>'contractual_item_code',
    nullif(p_update->>'approved_budget_brl','')::numeric,p_update->>'notes');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_sbon17b_localized_work(jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sbon17b_localized_work(jsonb,jsonb) TO authenticated;
