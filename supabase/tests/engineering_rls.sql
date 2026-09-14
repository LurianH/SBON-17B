-- LOCAL ONLY. Synthetic test fixtures are rolled back; never run against production.
begin;
create function pg_temp.assert_true(value boolean, message text) returns void
language plpgsql as $$ begin if value is distinct from true then raise exception 'Assertion: %', message; end if; end $$;
create function pg_temp.expect_error(statement text, expected_code text) returns void
language plpgsql security invoker as $$
begin
  begin execute statement;
  exception when others then
    if SQLSTATE = expected_code then return; end if;
    raise exception 'Expected %, received %: %', expected_code, SQLSTATE, SQLERRM;
  end;
  raise exception 'Expected error %, statement succeeded: %', expected_code, statement;
end;
$$;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005');
insert into public.profiles(id,email,role,active) values
 ('00000000-0000-0000-0000-000000000001','admin@example.test','ADMIN',true),
 ('00000000-0000-0000-0000-000000000002','editor@example.test','EDITOR',true),
 ('00000000-0000-0000-0000-000000000003','gestor@example.test','GESTOR',true),
 ('00000000-0000-0000-0000-000000000004','diretoria@example.test','DIRETORIA',true),
 ('00000000-0000-0000-0000-000000000005','inactive@example.test','ADMIN',false);
insert into public.contracts(id,code,name) values ('10000000-0000-0000-0000-000000000001','TEST-ENGINEERING','Local test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.create_engineering_project('10000000-0000-0000-0000-000000000001',
 '{"municipality":"Tatuí","segment_type":"WATER","project_category":"GENERAL","project_name":"Test A"}',
 '{"reference_date":"2026-09-11","concept_status":"APPROVED","concept_approved_at":"2026-09-10","executive_status":"PENDING","approved_economies":10,"approved_length_m":"0.100"}');
select pg_temp.assert_true((select count(*) = 1 from public.engineering_projects),'ADMIN creates project');
select pg_temp.assert_true((select count(*) = 1 from public.engineering_current_updates),'one current snapshot');
select pg_temp.expect_error($q$select public.create_engineering_project('10000000-0000-0000-0000-000000000001',
 '{"municipality":"Tatuí","segment_type":"WATER","project_category":"GENERAL","project_name":"Rollback"}',
 '{"reference_date":"2026-09-11","concept_status":"PENDING","executive_status":"PENDING","approved_economies":-1}')$q$, '23514');
select pg_temp.assert_true((select count(*) = 1 from public.engineering_projects),'failed snapshot rolls back project');
select pg_temp.expect_error($q$update public.engineering_project_updates set approved_economies=99$q$, '42501');
select pg_temp.expect_error($q$delete from public.engineering_project_updates$q$, '42501');
select pg_temp.expect_error($q$update public.engineering_projects set municipality='Quadra'$q$, '42501');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
-- Completed status requires its date.
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status)
 select id,'2026-09-12','PENDING','COMPLETED' from public.engineering_projects$q$, '23514');
insert into public.engineering_project_updates(engineering_project_id, reference_date, concept_status, executive_status, executive_completed_at, approved_economies, approved_length_m, created_by, created_at)
select id,'2026-09-12','PENDING','COMPLETED','2026-09-12',20,'0.200','00000000-0000-0000-0000-000000000001','2000-01-01' from public.engineering_projects;
select pg_temp.assert_true((select approved_economies=20 and created_by=auth.uid() and created_at>'2000-01-02' from public.engineering_current_updates),'EDITOR writes; author and timestamp server enforced');
insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status,approved_economies)
select id,'2026-09-10','PENDING','PENDING',999 from public.engineering_projects;
select pg_temp.assert_true((select approved_economies=20 from public.engineering_current_updates),'backdated snapshot does not replace current');
select pg_temp.assert_true((select count(*)=3 from public.engineering_project_updates),'all history preserved');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status,approved_length_m)
 select id,'2026-09-13','PENDING','PENDING','NaN' from public.engineering_projects$q$, '23514');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status,approved_length_m)
 select id,'2026-09-13','PENDING','PENDING',-1 from public.engineering_projects$q$, '23514');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 from public.engineering_current_updates),'GESTOR reads');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status)
 select id,'2026-09-13','PENDING','PENDING' from public.engineering_projects$q$, '42501');
update public.engineering_projects set active=false;
select pg_temp.assert_true((select bool_and(active) from public.engineering_projects),'GESTOR cannot deactivate');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_true((select count(*)=1 from public.engineering_current_updates),'DIRETORIA reads');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status)
 select id,'2026-09-13','PENDING','PENDING' from public.engineering_projects$q$, '42501');
select pg_temp.expect_error($q$select public.create_engineering_project('10000000-0000-0000-0000-000000000001','{}','{}')$q$, '42501');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select pg_temp.assert_true((select count(*)=0 from public.engineering_projects),'inactive profile sees no projects');
select pg_temp.assert_true((select count(*)=0 from public.engineering_current_updates),'view respects RLS');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true((select count(*)=4 from public.audit_logs where entity in ('engineering_projects','engineering_project_updates')),'audit covers successful operations');
set local role anon;
select pg_temp.expect_error('select * from public.engineering_projects', '42501');
select pg_temp.expect_error('select * from public.engineering_current_updates', '42501');
select pg_temp.expect_error($q$select public.create_engineering_project('10000000-0000-0000-0000-000000000001','{}','{}')$q$, '42501');
rollback;
