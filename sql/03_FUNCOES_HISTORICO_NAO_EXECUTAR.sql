-- Complemento ao esquema e RPC das propostas anteriores. NAO EXECUTAR.
-- Atualizar uma estrutura significa INSERIR novo snapshot, jamais editar histórico.
CREATE OR REPLACE FUNCTION public.add_sbon17b_localized_work_update(
  p_work_id uuid, p_update jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_contract uuid;
BEGIN
 IF auth.uid() IS NULL OR (SELECT private.current_app_role()) NOT IN ('ADMIN','EDITOR') THEN
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
  nullif(p_update->>'hydraulic_project_status',''),
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
