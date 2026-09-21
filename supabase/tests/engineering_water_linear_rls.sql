-- LOCAL ONLY. Verifies PE water snapshots, natural-key protection, audit and profiles.
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
 ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012'),
 ('00000000-0000-0000-0000-000000000013'), ('00000000-0000-0000-0000-000000000014');
insert into public.profiles(id,email,role,active) values
 ('00000000-0000-0000-0000-000000000011','linear-admin@example.test','ADMIN',true),
 ('00000000-0000-0000-0000-000000000012','linear-editor@example.test','EDITOR',true),
 ('00000000-0000-0000-0000-000000000013','linear-gestor@example.test','GESTOR',true),
 ('00000000-0000-0000-0000-000000000014','linear-diretoria@example.test','DIRETORIA',true);
insert into public.contracts(id,code,name) values
 ('10000000-0000-0000-0000-000000000011','TEST-WATER-LINEAR','Local water linear test');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
select public.create_engineering_project('10000000-0000-0000-0000-000000000011',
 '{"municipality":"Porangaba","segment_type":"WATER","project_category":"WATER_LINEAR","project_name":"Booster Vidas Novas","project_type":"PE"}',
 '{"reference_date":"2026-09-18","concept_status":null,"executive_status":null,"delivery_status":"IN_PROGRESS","approved_economies":132,"approved_length_m":"6829.800","pead_de63_length_m":"4465.200","pead_de110_length_m":"2364.600"}');
select pg_temp.assert_true((select project_type='PE' and segment_type='WATER' from public.engineering_projects where project_name='Booster Vidas Novas'),'ADMIN creates a PE water linear project');
select pg_temp.assert_true((select delivery_status='IN_PROGRESS' and approved_economies=132 and approved_length_m=6829.800
  and pead_de63_length_m=4465.200 and pead_de110_length_m=2364.600
  and concept_status is null and executive_status is null and executive_completed_at is null
  from public.engineering_current_updates),'delivery status stays independent of concept/executive status and approved economies');
select public.create_engineering_project('10000000-0000-0000-0000-000000000011',
  '{"municipality":"Porangaba","segment_type":"WATER","project_category":"GENERAL","project_name":"Existing General"}',
  '{"reference_date":"2026-09-18","concept_status":"PENDING","executive_status":"PENDING"}');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status)
 select id,'2026-09-19',null,null from public.engineering_projects where project_category='GENERAL'$q$, '23514');
select pg_temp.expect_error($q$select public.create_engineering_project('10000000-0000-0000-0000-000000000011',
 '{"municipality":"Porangaba","segment_type":"WATER","project_category":"WATER_LINEAR","project_name":"Booster Vidas Novas","project_type":"PE"}',
 '{"reference_date":"2026-09-18","delivery_status":"IN_PROGRESS","approved_length_m":"0.000","pead_de63_length_m":"0.000","pead_de110_length_m":"0.000"}')$q$, '23505');
select pg_temp.assert_true((select count(*)=1 from public.engineering_projects where project_category='WATER_LINEAR'),'natural key prevents duplicate PE water project');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,delivery_status,approved_length_m,pead_de63_length_m,pead_de110_length_m)
 select id,'2026-09-19','IN_PROGRESS',-1,1,0 from public.engineering_projects where project_category='WATER_LINEAR'$q$, '23514');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,delivery_status,approved_length_m,pead_de63_length_m,pead_de110_length_m)
 select id,'2026-09-19','IN_PROGRESS',99,40,50 from public.engineering_projects where project_category='WATER_LINEAR'$q$, '23514');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,delivery_status,approved_length_m,pead_de63_length_m,pead_de110_length_m)
 select id,'2026-09-19','IN_PROGRESS',1,1,0 from public.engineering_projects where project_category='GENERAL'$q$, '23514');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status,
  delivery_status,approved_economies,approved_length_m,pead_de63_length_m,pead_de110_length_m,created_by,created_at)
select id,'2026-09-20',null,null,'COMPLETED',132,6829.800,4465.200,2364.600,
  '00000000-0000-0000-0000-000000000011','2000-01-01'
from public.engineering_projects where project_category='WATER_LINEAR';
select pg_temp.assert_true((select delivery_status='COMPLETED' and executive_status is null
  and u.created_by=auth.uid() and u.created_at>'2000-01-02' from public.engineering_current_updates u
  join public.engineering_projects p on p.id=u.engineering_project_id
  where p.project_category='WATER_LINEAR'),'EDITOR appends a delivery snapshot; trigger stamps its author/time');
select pg_temp.assert_true((select count(*)=2 from public.engineering_project_updates u
  join public.engineering_projects p on p.id=u.engineering_project_id where p.project_category='WATER_LINEAR'),
  'both water linear snapshots remain immutable history');
select pg_temp.expect_error($q$update public.engineering_project_updates set approved_economies=999$q$, '42501');
select pg_temp.expect_error($q$delete from public.engineering_project_updates$q$, '42501');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',true);
select pg_temp.assert_true((select count(*)=1 from public.engineering_current_updates u
  join public.engineering_projects p on p.id=u.engineering_project_id where p.project_category='WATER_LINEAR'),'GESTOR reads current water linear delivery');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,delivery_status,approved_length_m,pead_de63_length_m,pead_de110_length_m)
 select id,'2026-09-21','IN_PROGRESS',6829.8,4465.2,2364.6 from public.engineering_projects where project_category='WATER_LINEAR'$q$, '42501');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000014',true);
select pg_temp.assert_true((select count(*)=1 from public.engineering_current_updates u
  join public.engineering_projects p on p.id=u.engineering_project_id where p.project_category='WATER_LINEAR'),'DIRETORIA reads current water linear delivery');
select pg_temp.expect_error($q$insert into public.engineering_project_updates(engineering_project_id,reference_date,delivery_status,approved_length_m,pead_de63_length_m,pead_de110_length_m)
 select id,'2026-09-21','IN_PROGRESS',6829.8,4465.2,2364.6 from public.engineering_projects where project_category='WATER_LINEAR'$q$, '42501');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
select pg_temp.assert_true((select count(*)=5 from public.audit_logs where entity in ('engineering_projects','engineering_project_updates')),'water linear creates/updates use the existing audit log');
set local role anon;
select pg_temp.expect_error('select * from public.engineering_projects', '42501');
select pg_temp.expect_error('select * from public.engineering_current_updates', '42501');
rollback;
