BEGIN;
-- Execução manual integral, somente após preflight revisado.
-- Não executar a seleção isolada da migration e não trocar ROLLBACK por COMMIT.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
-- INICIO MIGRATION INTEGRAL: supabase/migrations/20260911183427_add_engineering_projects.sql
-- SHA256 781df1dbc07c7388f2c1875b2d3f7de421477c3299bf0280a199dac2f668a24b; 36 statements de topo.
-- Engenharia: cadastro independente de metas e medições de execução.
create table public.engineering_project_categories (
  code text primary key check (code ~ '^[A-Z][A-Z0-9_]{0,39}$'),
  label text not null check (length(btrim(label)) between 1 and 80)
);
-- Domínio de categorias, sem projetos ou valores operacionais fictícios.
insert into public.engineering_project_categories(code, label) values ('GENERAL', 'Geral'), ('STATIC', 'Estática');

create table public.engineering_projects (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  municipality text not null check (municipality in ('Porangaba','Quadra','Pereiras','Tatuí','Conchas')),
  segment_type public.target_segment_type not null,
  project_category text not null references public.engineering_project_categories(code),
  project_name text not null check (length(btrim(project_name)) between 1 and 200),
  active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id)
);
create unique index engineering_projects_identity_idx on public.engineering_projects
  (contract_id, municipality, segment_type, project_category, lower(btrim(project_name)));
create index engineering_projects_category_idx on public.engineering_projects(project_category);
create index engineering_projects_created_by_idx on public.engineering_projects(created_by);
create index engineering_projects_updated_by_idx on public.engineering_projects(updated_by);

create table public.engineering_project_updates (
  id uuid primary key default gen_random_uuid(),
  engineering_project_id uuid not null references public.engineering_projects(id),
  reference_date date not null,
  concept_status text not null check (concept_status in ('PENDING','IN_PROGRESS','APPROVED')),
  concept_approved_at date,
  executive_status text not null check (executive_status in ('PENDING','IN_PROGRESS','COMPLETED')),
  executive_completed_at date,
  approved_economies integer check (approved_economies >= 0),
  approved_length_m numeric(14,3) check (approved_length_m >= 0 and approved_length_m < 'Infinity'::numeric),
  notes text check (length(notes) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  check ((concept_status = 'APPROVED') = (concept_approved_at is not null)),
  check ((executive_status = 'COMPLETED') = (executive_completed_at is not null)),
  check (concept_approved_at <= reference_date),
  check (executive_completed_at <= reference_date)
);
create index engineering_updates_current_idx on public.engineering_project_updates
  (engineering_project_id, reference_date desc, created_at desc, id desc);
create index engineering_updates_created_by_idx on public.engineering_project_updates(created_by);

alter table public.engineering_project_categories enable row level security;
alter table public.engineering_projects enable row level security;
alter table public.engineering_project_updates enable row level security;
revoke all on public.engineering_project_categories, public.engineering_projects, public.engineering_project_updates from public, anon, authenticated;
grant select on public.engineering_project_categories, public.engineering_projects, public.engineering_project_updates to authenticated;
grant insert on public.engineering_projects, public.engineering_project_updates to authenticated;
-- Identificação imutável: uma mudança de cidade/categoria não reescreve a história.
grant update(active) on public.engineering_projects to authenticated;

create policy engineering_categories_read on public.engineering_project_categories for select to authenticated
  using ((select private.current_app_role()) in ('ADMIN','EDITOR','GESTOR','DIRETORIA'));
create policy engineering_projects_read on public.engineering_projects for select to authenticated
  using ((select private.current_app_role()) in ('ADMIN','EDITOR','GESTOR','DIRETORIA'));
create policy engineering_updates_read on public.engineering_project_updates for select to authenticated
  using ((select private.current_app_role()) in ('ADMIN','EDITOR','GESTOR','DIRETORIA'));
create policy engineering_projects_insert on public.engineering_projects for insert to authenticated
  with check ((select private.current_app_role()) in ('ADMIN','EDITOR') and created_by = (select auth.uid())
    and updated_by = (select auth.uid()) and exists (select 1 from public.contracts c where c.id = contract_id and c.active));
create policy engineering_projects_update on public.engineering_projects for update to authenticated
  using ((select private.current_app_role()) in ('ADMIN','EDITOR'))
  with check ((select private.current_app_role()) in ('ADMIN','EDITOR') and updated_by = (select auth.uid()));
create policy engineering_updates_insert on public.engineering_project_updates for insert to authenticated
  with check ((select private.current_app_role()) in ('ADMIN','EDITOR') and created_by = (select auth.uid())
    and exists (select 1 from public.engineering_projects p join public.contracts c on c.id = p.contract_id
      where p.id = engineering_project_id and p.active and c.active));
-- Sem grants ou policies UPDATE/DELETE nos snapshots, inclusive para ADMIN.

create function private.stamp_engineering()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.created_at = clock_timestamp();
    new.created_by = (select auth.uid());
  end if;
  if TG_TABLE_NAME = 'engineering_projects' then
    new.updated_at = clock_timestamp();
    new.updated_by = (select auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_engineering() from public, anon, authenticated;
create trigger stamp_engineering_projects before insert or update on public.engineering_projects
  for each row execute function private.stamp_engineering();
create trigger stamp_engineering_updates before insert on public.engineering_project_updates
  for each row execute function private.stamp_engineering();
create trigger touch_engineering_projects before update on public.engineering_projects
  for each row execute function private.touch_updated_at();
create trigger audit_engineering_projects after insert or update or delete on public.engineering_projects
  for each row execute function private.capture_audit();
create trigger audit_engineering_updates after insert or update or delete on public.engineering_project_updates
  for each row execute function private.capture_audit();

-- Mais recente por referência; registros retroativos não substituem o estado vigente.
-- Desempate: instante de registro no servidor, seguido pelo UUID.
create view public.engineering_current_updates with (security_invoker = true) as
select u.*, p.contract_id, p.active
from public.engineering_projects p
cross join lateral (
  select s.* from public.engineering_project_updates s
  where s.engineering_project_id = p.id
  order by s.reference_date desc, s.created_at desc, s.id desc limit 1
) u;
revoke all on public.engineering_current_updates from public, anon, authenticated;
grant select on public.engineering_current_updates to authenticated;

-- Cadastro e primeiro snapshot atômicos. Invoker mantém RLS nas duas inserções.
create function public.create_engineering_project(p_contract_id uuid, p_project jsonb, p_update jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare project_id uuid;
begin
  if (select auth.uid()) is null or (select private.current_app_role()) is null
    or (select private.current_app_role()) not in ('ADMIN','EDITOR') then
    raise exception 'Perfil sem permissão de escrita' using errcode = '42501';
  end if;
  insert into public.engineering_projects(contract_id, municipality, segment_type, project_category, project_name)
  values (p_contract_id, p_project->>'municipality', (p_project->>'segment_type')::public.target_segment_type,
    p_project->>'project_category', btrim(p_project->>'project_name')) returning id into project_id;
  insert into public.engineering_project_updates(engineering_project_id, reference_date, concept_status,
    concept_approved_at, executive_status, executive_completed_at, approved_economies, approved_length_m, notes)
  values (project_id, (p_update->>'reference_date')::date, p_update->>'concept_status',
    (p_update->>'concept_approved_at')::date, p_update->>'executive_status', (p_update->>'executive_completed_at')::date,
    (p_update->>'approved_economies')::integer, (p_update->>'approved_length_m')::numeric, p_update->>'notes');
  return project_id;
end;
$$;
revoke all on function public.create_engineering_project(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_engineering_project(uuid,jsonb,jsonb) to authenticated;

-- FIM MIGRATION INTEGRAL
-- VALIDAÇÃO SOMENTE LEITURA DOS OBJETOS CRIADOS, AINDA NA TRANSAÇÃO.
-- Não executa RPC, helpers, triggers ou DML de teste. Perfis são valores do app,
-- não papéis SQL. Catálogos não substituem sessões reais de ADMIN/EDITOR/etc.

-- 1. Tabelas/view e RLS: tabelas devem ter relrowsecurity=true.
select e.name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,
 pg_get_userbyid(c.relowner) as owner,c.oid is not null as exists_ok
from (values ('public.engineering_project_categories'),
 ('public.engineering_projects'),
 ('public.engineering_project_updates'),
 ('public.engineering_current_updates')) e(name) left join pg_class c on c.oid=to_regclass(e.name);

-- 2. Colunas, tipos, nulabilidade, identidade e defaults.
select a.attrelid::regclass as table_name,a.attnum,a.attname,
 format_type(a.atttypid,a.atttypmod) as data_type,a.attnotnull,a.attidentity,
 pg_get_expr(d.adbin,d.adrelid) as default_expression
from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid in ('public.engineering_project_categories'::regclass,'public.engineering_projects'::regclass,'public.engineering_project_updates'::regclass) and a.attnum>0 and not a.attisdropped order by a.attrelid,a.attnum;

-- 3. Categorias: exclusivamente as duas linhas de domínio da migration.
select code,label from public.engineering_project_categories order by code;

-- 4. Todas as constraints, incluindo CHECKs, PKs e FKs.
select conrelid::regclass as table_name,conname,contype,convalidated,
 pg_get_constraintdef(oid,true) as definition
from pg_constraint where conrelid in ('public.engineering_project_categories'::regclass,'public.engineering_projects'::regclass,'public.engineering_project_updates'::regclass) order by conrelid,conname;

-- 5. Foreign keys destacadas: origem, destino e ações de exclusão/atualização.
select conrelid::regclass as source_table,conname,confrelid::regclass as referenced_table,
 confdeltype,confupdtype,convalidated,pg_get_constraintdef(oid,true) as definition
from pg_constraint where conrelid in ('public.engineering_project_categories'::regclass,'public.engineering_projects'::regclass,'public.engineering_project_updates'::regclass) and contype='f' order by conrelid,conname;

-- 6. Índices explícitos e implícitos das PKs, sem omitir definições.
select indrelid::regclass as table_name,indexrelid::regclass as index_name,
 indisunique,indisprimary,indisvalid,indisready,pg_get_indexdef(indexrelid) as definition
from pg_index where indrelid in ('public.engineering_project_categories'::regclass,'public.engineering_projects'::regclass,'public.engineering_project_updates'::regclass) order by indrelid,indexrelid;

-- 7. Triggers explícitos e internos; vínculos da auditoria.
select tgrelid::regclass as table_name,tgname,tgenabled,tgisinternal,
 tgfoid::regprocedure as function_name,pg_get_triggerdef(oid,true) as definition
from pg_trigger where tgrelid in ('public.engineering_project_categories'::regclass,'public.engineering_projects'::regclass,'public.engineering_project_updates'::regclass) order by tgrelid,tgname;
select e.*,t.tgfoid=to_regprocedure(e.expected_function) as binding_ok,t.tgenabled
from (values ('public.engineering_projects','stamp_engineering_projects','private.stamp_engineering()'),
 ('public.engineering_project_updates','stamp_engineering_updates','private.stamp_engineering()'),
 ('public.engineering_projects','touch_engineering_projects','private.touch_updated_at()'),
 ('public.engineering_projects','audit_engineering_projects','private.capture_audit()'),
 ('public.engineering_project_updates','audit_engineering_updates','private.capture_audit()')) e(table_name,trigger_name,expected_function)
left join pg_trigger t on t.tgrelid=to_regclass(e.table_name) and t.tgname=e.trigger_name;

-- 8. Policies: expressões completas para conferir perfis e autoria.
select e.table_name,e.policy_name,e.expected_command,p.cmd,p.roles,p.permissive,p.qual,p.with_check,
 p.cmd=e.expected_command as command_ok,p.roles=array['authenticated'::name] as target_ok
from (values ('public.engineering_project_categories','engineering_categories_read','SELECT'),
 ('public.engineering_projects','engineering_projects_read','SELECT'),
 ('public.engineering_project_updates','engineering_updates_read','SELECT'),
 ('public.engineering_projects','engineering_projects_insert','INSERT'),
 ('public.engineering_projects','engineering_projects_update','UPDATE'),
 ('public.engineering_project_updates','engineering_updates_insert','INSERT')) e(table_name,policy_name,expected_command)
left join pg_policies p on p.schemaname=split_part(e.table_name,'.',1)
 and p.tablename=split_part(e.table_name,'.',2) and p.policyname=e.policy_name;

-- 9. Grants efetivos de tabela e de coluna: verificar UPDATE apenas em active.
select r.rolname,e.name as object_name,
 has_table_privilege(r.oid,to_regclass(e.name),'SELECT') as can_select,
 has_table_privilege(r.oid,to_regclass(e.name),'INSERT') as can_insert,
 has_table_privilege(r.oid,to_regclass(e.name),'UPDATE') as table_update,
 has_table_privilege(r.oid,to_regclass(e.name),'DELETE') as can_delete,
 has_table_privilege(r.oid,to_regclass(e.name),'TRUNCATE') as can_truncate
from pg_roles r cross join (values ('public.engineering_project_categories'),
 ('public.engineering_projects'),
 ('public.engineering_project_updates'),
 ('public.engineering_current_updates')) e(name)
where r.rolname in ('anon','authenticated') order by r.rolname,e.name;
select a.attrelid::regclass as table_name,a.attname,
 has_column_privilege('authenticated',a.attrelid,a.attnum,'INSERT') as can_insert,
 has_column_privilege('authenticated',a.attrelid,a.attnum,'UPDATE') as can_update
from pg_attribute a where a.attrelid in ('public.engineering_project_categories'::regclass,'public.engineering_projects'::regclass,'public.engineering_project_updates'::regclass) and a.attnum>0 and not a.attisdropped
order by a.attrelid,a.attnum;

-- 10. Funções novas e ACLs: RPC/stamp invoker; não executar funções.
select e.signature,p.oid is not null as exists_ok,p.prosecdef,p.proconfig,p.proacl,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,pg_get_functiondef(p.oid) as definition
from (values ('private.stamp_engineering()'),
 ('public.create_engineering_project(uuid,jsonb,jsonb)')) e(signature) left join pg_proc p on p.oid=to_regprocedure(e.signature);

-- 11. Conferência de ausência de projetos/snapshots. Esperado: true/true.
select not exists(select 1 from public.engineering_projects) as projects_empty,
 not exists(select 1 from public.engineering_project_updates) as updates_empty;

ROLLBACK;

-- PÓS-ROLLBACK: APENAS SELECT. Estas consultas não criam uma nova transação de DDL.
-- Esperado: absent_ok=true em todas as linhas, com os objetos ausentes antes do teste.
select e.name,to_regclass(e.name) as remaining_oid,to_regclass(e.name) is null as absent_ok
from (values ('public.engineering_project_categories'),
 ('public.engineering_projects'),
 ('public.engineering_project_updates'),
 ('public.engineering_current_updates'),
 ('public.engineering_projects_identity_idx'),
 ('public.engineering_projects_category_idx'),
 ('public.engineering_projects_created_by_idx'),
 ('public.engineering_projects_updated_by_idx'),
 ('public.engineering_updates_current_idx'),
 ('public.engineering_updates_created_by_idx')) e(name);
select e.signature,to_regprocedure(e.signature) as remaining_oid,
 to_regprocedure(e.signature) is null as absent_ok
from (values ('private.stamp_engineering()'),
 ('public.create_engineering_project(uuid,jsonb,jsonb)')) e(signature);
select e.name,to_regtype(e.name) as remaining_type,to_regtype(e.name) is null as absent_ok
from (values ('public.engineering_project_categories'),
 ('public.engineering_projects'),
 ('public.engineering_project_updates'),
 ('public.engineering_current_updates')) e(name);
select e.table_name,e.trigger_name,not exists(select 1 from pg_trigger t
 where t.tgrelid=to_regclass(e.table_name) and t.tgname=e.trigger_name) as absent_ok
from (values ('public.engineering_projects','stamp_engineering_projects','private.stamp_engineering()'),
 ('public.engineering_project_updates','stamp_engineering_updates','private.stamp_engineering()'),
 ('public.engineering_projects','touch_engineering_projects','private.touch_updated_at()'),
 ('public.engineering_projects','audit_engineering_projects','private.capture_audit()'),
 ('public.engineering_project_updates','audit_engineering_updates','private.capture_audit()')) e(table_name,trigger_name,expected_function);
select e.table_name,e.policy_name,not exists(select 1 from pg_policy p
 where p.polrelid=to_regclass(e.table_name) and p.polname=e.policy_name) as absent_ok
from (values ('public.engineering_project_categories','engineering_categories_read','SELECT'),
 ('public.engineering_projects','engineering_projects_read','SELECT'),
 ('public.engineering_project_updates','engineering_updates_read','SELECT'),
 ('public.engineering_projects','engineering_projects_insert','INSERT'),
 ('public.engineering_projects','engineering_projects_update','UPDATE'),
 ('public.engineering_project_updates','engineering_updates_insert','INSERT')) e(table_name,policy_name,expected_command);
-- Esperado: nenhuma constraint nem índice implícito de PK restante nas tabelas novas.
select c.conname,c.conrelid::regclass from pg_constraint c
where c.conrelid in (select to_regclass(e.name) from (values ('public.engineering_project_categories'),
 ('public.engineering_projects'),
 ('public.engineering_project_updates'),
 ('public.engineering_current_updates')) e(name));
-- O bloco de alterações terminou obrigatoriamente em ROLLBACK; acima, apenas SELECTs posteriores.
