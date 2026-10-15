-- LOCAL ONLY. Synthetic fixtures and all mutations below are rolled back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=expected_code THEN RETURN; END IF;
  RAISE EXCEPTION 'Expected %, received %: %',expected_code,SQLSTATE,SQLERRM;
 END;
 RAISE EXCEPTION 'Expected error %, statement succeeded: %',expected_code,statement;
END $$;
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004'),
 ('00000000-0000-4000-8000-000000000005'),('00000000-0000-4000-8000-000000000006');
INSERT INTO public.profiles(id,email,role,active) VALUES
 ('00000000-0000-4000-8000-000000000001','admin@example.test','ADMIN',true),
 ('00000000-0000-4000-8000-000000000002','editor@example.test','EDITOR',true),
 ('00000000-0000-4000-8000-000000000003','gestor@example.test','GESTOR',true),
 ('00000000-0000-4000-8000-000000000004','diretoria@example.test','DIRETORIA',true),
 ('00000000-0000-4000-8000-000000000005','inactive@example.test','ADMIN',false);
INSERT INTO public.contracts(code,name) VALUES ('TEST-OTHER','Other contract');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
INSERT INTO public.engineering_projects(id,contract_id,municipality,segment_type,project_category,project_name)
 SELECT '20000000-0000-4000-8000-000000000001',id,'Porangaba','WATER','GENERAL','Alto da Serra test' FROM public.contracts WHERE code='SBON 17B';
INSERT INTO public.engineering_projects(id,contract_id,municipality,segment_type,project_category,project_name)
 SELECT '20000000-0000-4000-8000-000000000002',id,'Porangaba','WATER','GENERAL','Other contract project' FROM public.contracts WHERE code='TEST-OTHER';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=16 FROM public.engineering_attack_plan_2026),'16 canonical fronts');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.engineering_attack_plan_2026 WHERE stain_id='271_AR_0001N'),'duplicate stain codes retained as separate fronts');
SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-09","engineering_project_id":"20000000-0000-4000-8000-000000000001","kind":"BOOSTER","designation":"Test booster","quantity":1}',
 '{"reference_date":"2026-10-14","flow_lps":0.4,"head_mca":28,"hydraulic_project_status":"IN_PROGRESS"}');
SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-10","kind":"RESERVOIR","designation":"Test reservoir","quantity":1}',
 '{"reference_date":"2026-10-14","capacity_m3":50,"material":"PRFV","hydraulic_project_status":"NOT_STARTED"}');
SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-03","kind":"EEE","designation":"Test EEE","quantity":2}',
 '{"reference_date":"2026-10-14","pump_power_cv":3,"hydraulic_project_status":"COMPLETED","electrical_project_status":"IN_PROGRESS","structural_project_status":"NOT_STARTED"}');
SET CONSTRAINTS sbon17b_localized_first_snapshot IMMEDIATE;
SET CONSTRAINTS sbon17b_localized_first_snapshot DEFERRED;
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.engineering_localized_works),'ADMIN creates all three kinds');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.engineering_localized_work_updates),'initial snapshots committed with parents');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-09","kind":"RESERVOIR","designation":"Invalid reservoir","quantity":1}',
 '{"reference_date":"2026-10-14"}')$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-03","kind":"EEE","designation":"Incomplete EEE","quantity":1}',
 '{"reference_date":"2026-10-14","hydraulic_project_status":"NOT_STARTED"}')$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-03","kind":"BOOSTER","designation":"Wrong system","quantity":1}',
 '{"reference_date":"2026-10-14"}')$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-02","engineering_project_id":"20000000-0000-4000-8000-000000000001","kind":"BOOSTER","designation":"Wrong city","quantity":1}',
 '{"reference_date":"2026-10-14"}')$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-09","engineering_project_id":"20000000-0000-4000-8000-000000000002","kind":"BOOSTER","designation":"Wrong contract","quantity":1}',
 '{"reference_date":"2026-10-14"}')$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-99","kind":"BOOSTER","designation":"Missing front","quantity":1}',
 '{"reference_date":"2026-10-14"}')$q$,'23514');
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.engineering_localized_works),'invalid initial snapshots roll back parent and audit');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-09","kind":"BOOSTER","designation":" test BOOSTER ","quantity":1}',
 '{"reference_date":"2026-10-14"}')$q$,'23505');
SELECT pg_temp.expect_error('UPDATE public.engineering_localized_works SET designation=''changed''','42501');
SELECT pg_temp.expect_error('DELETE FROM public.engineering_localized_works','42501');
SELECT pg_temp.expect_error('UPDATE public.engineering_localized_work_updates SET flow_lps=99','42501');
SELECT pg_temp.expect_error('DELETE FROM public.engineering_localized_work_updates','42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.create_sbon17b_localized_work(
 '{"plan_row_key":"attack-2026-04","kind":"BOOSTER","designation":"Editor booster","quantity":1}',
 '{"reference_date":"2026-10-14","hydraulic_project_status":"NOT_STARTED"}');
SET CONSTRAINTS sbon17b_localized_first_snapshot IMMEDIATE;
SET CONSTRAINTS sbon17b_localized_first_snapshot DEFERRED;
SELECT public.add_sbon17b_localized_work_update(id,
 '{"reference_date":"2026-10-15","flow_lps":0.8,"project_status":"COMPLETED","physical_status":"IN_PROGRESS"}')
 FROM public.engineering_localized_works WHERE designation='Test booster';
SELECT public.add_sbon17b_localized_work_update(id,
 '{"reference_date":"2026-10-13","flow_lps":999}') FROM public.engineering_localized_works WHERE designation='Test booster';
SELECT pg_temp.assert_true((SELECT (current_update->>'flow_lps')::numeric=0.8 FROM public.engineering_localized_work_current WHERE designation='Test booster'),'backdated snapshot does not replace current');
INSERT INTO public.engineering_localized_work_updates(localized_work_id,reference_date,flow_lps,hydraulic_project_status,created_at,created_by)
 SELECT id,'2026-10-15',1.2,'APPROVED','2000-01-01','00000000-0000-4000-8000-000000000001' FROM public.engineering_localized_works WHERE designation='Test booster';
SELECT pg_temp.assert_true((SELECT (current_update->>'flow_lps')::numeric=1.2 AND current_update->>'created_by'=auth.uid()::text
 AND (current_update->>'created_at')::timestamptz>'2000-01-02' FROM public.engineering_localized_work_current WHERE designation='Test booster'),'author/timestamp cannot be spoofed; same-date snapshot uses server time');
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.engineering_localized_work_updates u JOIN public.engineering_localized_works w ON w.id=u.localized_work_id WHERE w.designation='Test booster'),'every prior snapshot retained');
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{"reference_date":"2026-02-30"}') FROM public.engineering_localized_works WHERE designation='Test booster'$q$,'22008');
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{"reference_date":"2026-10-16","flow_lps":-1}') FROM public.engineering_localized_works WHERE designation='Test booster'$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{"reference_date":"2026-10-16","flow_lps":"NaN"}') FROM public.engineering_localized_works WHERE designation='Test booster'$q$,'23514');
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{"reference_date":"2026-10-16","approved_budget_brl":10,"budget_status":"BUDGETED"}') FROM public.engineering_localized_works WHERE designation='Test booster'$q$,'23514');
SELECT pg_temp.expect_error($q$INSERT INTO public.engineering_localized_works(contract_id,plan_row_key,mancha_id,municipality,segment_type,kind,designation,quantity)
 SELECT id,'attack-2026-09','incorrect','Porangaba','WATER','BOOSTER','Bad stain',1 FROM public.contracts WHERE code='SBON 17B'$q$,'23514');
SELECT pg_temp.expect_error($q$DO $d$ BEGIN
 INSERT INTO public.engineering_localized_works(contract_id,plan_row_key,mancha_id,municipality,segment_type,kind,designation)
 SELECT id,'attack-2026-09','553_AR_0002N','Porangaba','WATER','BOOSTER','Orphan' FROM public.contracts WHERE code='SBON 17B';
 SET CONSTRAINTS sbon17b_localized_first_snapshot IMMEDIATE;
 END $d$$q$,'23514');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.engineering_localized_work_current),'GESTOR reads current');
SELECT pg_temp.assert_true((SELECT count(*)=7 FROM public.engineering_localized_work_updates),'GESTOR reads complete permanent history');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work('{}','{}')$q$,'42501');
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{}') FROM public.engineering_localized_works LIMIT 1$q$,'42501');
SELECT pg_temp.expect_error($q$INSERT INTO public.engineering_localized_work_updates(localized_work_id,reference_date,hydraulic_project_status)
 SELECT id,'2026-10-16','NOT_STARTED' FROM public.engineering_localized_works LIMIT 1$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.engineering_localized_work_current),'DIRETORIA reads');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work('{}','{}')$q$,'42501');
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{}') FROM public.engineering_localized_works LIMIT 1$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.engineering_localized_work_current),'inactive profile cannot read through view');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.engineering_localized_work_updates),'inactive profile cannot read history');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work('{}','{}')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.engineering_localized_works),'missing profile cannot read');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work('{}','{}')$q$,'42501');
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM public.engineering_localized_work_current','42501');
SELECT pg_temp.expect_error('SELECT * FROM public.engineering_localized_work_updates','42501');
SELECT pg_temp.expect_error($q$SELECT public.create_sbon17b_localized_work('{}','{}')$q$,'42501');
RESET ROLE;
SELECT pg_temp.expect_error('UPDATE public.engineering_localized_work_updates SET notes=''overwrite''','23514');
SELECT pg_temp.expect_error('DELETE FROM public.engineering_localized_work_updates','23514');
SELECT pg_temp.expect_error('DELETE FROM public.engineering_localized_works','23514');
UPDATE public.engineering_projects SET active=false WHERE id='20000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT pg_temp.expect_error($q$SELECT public.add_sbon17b_localized_work_update(id,'{"reference_date":"2026-10-16"}') FROM public.engineering_localized_works WHERE designation='Test booster'$q$,'23514');
SELECT pg_temp.assert_true((SELECT count(*)=11 FROM public.audit_logs WHERE entity IN ('engineering_localized_works','engineering_localized_work_updates')),'audit contains successful inserts only');
RESET ROLE;
UPDATE public.contracts SET active=false WHERE code='SBON 17B';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.engineering_localized_work_current),'inactive contract hides works');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.engineering_localized_work_updates),'inactive contract hides history');
ROLLBACK;
