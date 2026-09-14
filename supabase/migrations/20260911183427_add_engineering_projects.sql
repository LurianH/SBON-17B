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
