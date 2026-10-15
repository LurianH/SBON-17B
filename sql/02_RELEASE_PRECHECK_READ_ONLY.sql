-- Read-only preflight. No DDL/DML, schema migrations or fixture imports.
BEGIN READ ONLY;
SELECT current_setting('server_version') AS postgres_version,
 current_setting('server_version_num')::int >= 150000 AS supports_security_invoker;
SELECT c.id,c.code,c.active FROM public.contracts c WHERE c.code='SBON 17B';
SELECT to_regprocedure('private.current_app_role()') IS NOT NULL AS role_function_exists,
 to_regprocedure('private.capture_audit()') IS NOT NULL AS audit_function_exists;
SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('engineering_projects','engineering_project_updates')
 ORDER BY table_name,ordinal_position;
SELECT count(*)=0 AS new_tables_absent FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN
 ('engineering_attack_plan_2026','engineering_localized_works','engineering_localized_work_updates');
SELECT schemaname,tablename,policyname,cmd,roles,qual,with_check FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('contracts','profiles','engineering_projects','engineering_project_updates')
 ORDER BY tablename,policyname;
SELECT role,active,count(*) AS profiles FROM public.profiles GROUP BY role,active ORDER BY role,active;
-- Store these fingerprints privately before/after migration; no row values are displayed.
SELECT 'engineering_projects' AS entity,count(*) AS rows,
 md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id)::text,'[]')) AS fingerprint
 FROM public.engineering_projects p JOIN public.contracts c ON c.id=p.contract_id WHERE c.code='SBON 17B'
UNION ALL
SELECT 'engineering_project_updates',count(*),md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,'[]'))
 FROM public.engineering_project_updates u JOIN public.engineering_projects p ON p.id=u.engineering_project_id
 JOIN public.contracts c ON c.id=p.contract_id WHERE c.code='SBON 17B'
UNION ALL
SELECT 'weekly_progress',count(*),md5(coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.id)::text,'[]'))
 FROM public.weekly_progress w JOIN public.contracts c ON c.id=w.contract_id WHERE c.code='SBON 17B'
UNION ALL
SELECT 'monthly_financials',count(*),md5(coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.id)::text,'[]'))
 FROM public.monthly_financials f JOIN public.contracts c ON c.id=f.contract_id WHERE c.code='SBON 17B'
UNION ALL
SELECT 'annual_targets',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'[]'))
 FROM public.annual_targets t JOIN public.contracts c ON c.id=t.contract_id WHERE c.code='SBON 17B';
ROLLBACK;
