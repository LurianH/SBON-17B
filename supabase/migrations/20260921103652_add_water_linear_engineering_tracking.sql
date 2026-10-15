-- Add PE water line tracking to the existing project and immutable snapshot model.
-- Operational workbook rows are loaded separately by the guarded import script.

insert into public.engineering_project_categories(code, label)
values ('WATER_LINEAR', 'Água — Obras Lineares')
on conflict (code) do nothing;

alter table public.engineering_projects
  add column project_type text check (project_type is null or length(btrim(project_type)) between 1 and 40),
  add constraint engineering_projects_water_linear_type_check check (
    (project_category = 'WATER_LINEAR' and segment_type = 'WATER' and project_type = 'PE')
    or (project_category <> 'WATER_LINEAR' and project_type is distinct from 'PE')
  );

-- The existing identity index includes category. This additional partial index
-- protects PE water-area imports against duplicates across categories as well.
create unique index engineering_projects_water_linear_identity_idx
  on public.engineering_projects (contract_id, municipality, lower(btrim(project_name)))
  where project_type = 'PE';

alter table public.engineering_project_updates
  alter column concept_status drop not null,
  alter column executive_status drop not null,
  add column delivery_status text check (delivery_status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  add column pead_de63_length_m numeric(14,3)
    check (pead_de63_length_m >= 0 and pead_de63_length_m < 'Infinity'::numeric),
  add column pead_de110_length_m numeric(14,3)
    check (pead_de110_length_m >= 0 and pead_de110_length_m < 'Infinity'::numeric),
  add constraint engineering_updates_null_status_dates_check check (
    (concept_status is not null or concept_approved_at is null)
    and (executive_status is not null or executive_completed_at is null)
  );

create function private.validate_engineering_water_linear_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  project_type text;
  project_category text;
  project_segment public.target_segment_type;
begin
  select p.project_type, p.project_category, p.segment_type
    into project_type, project_category, project_segment
  from public.engineering_projects p
  where p.id = new.engineering_project_id;

  if project_type = 'PE' and project_category = 'WATER_LINEAR' and project_segment = 'WATER' then
    if new.delivery_status is null then
      raise exception 'Status de entrega é obrigatório para projetos de Água / Obras Lineares' using errcode = '23514';
    end if;
    if new.pead_de63_length_m is null or new.pead_de110_length_m is null then
      raise exception 'Informe PEAD DE63 e DE110; use zero quando a planilha indicar ausência do diâmetro' using errcode = '23514';
    end if;
    if new.approved_length_m is distinct from new.pead_de63_length_m + new.pead_de110_length_m then
      raise exception 'A extensão total deve ser igual à soma de PEAD DE63 e DE110' using errcode = '23514';
    end if;
  else
    if new.concept_status is null or new.executive_status is null then
      raise exception 'Status de concepção e execução são obrigatórios fora de Água / Obras Lineares' using errcode = '23514';
    end if;
    if new.delivery_status is not null
      or new.pead_de63_length_m is not null
      or new.pead_de110_length_m is not null then
      raise exception 'Campos de entrega linear só podem ser usados em projetos PE de Água' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.validate_engineering_water_linear_update() from public, anon, authenticated;
create trigger validate_engineering_water_linear_update
  before insert on public.engineering_project_updates
  for each row execute function private.validate_engineering_water_linear_update();

-- Preserve existing view column order, then append the new snapshot columns.
create or replace view public.engineering_current_updates with (security_invoker = true) as
select
  u.id, u.engineering_project_id, u.reference_date, u.concept_status, u.concept_approved_at,
  u.executive_status, u.executive_completed_at, u.approved_economies, u.approved_length_m,
  u.notes, u.created_by, u.created_at, p.contract_id, p.active,
  u.delivery_status, u.pead_de63_length_m, u.pead_de110_length_m
from public.engineering_projects p
cross join lateral (
  select s.* from public.engineering_project_updates s
  where s.engineering_project_id = p.id
  order by s.reference_date desc, s.created_at desc, s.id desc limit 1
) u;

-- Keep the existing invoker RPC and role checks while accepting the new fields.
create or replace function public.create_engineering_project(p_contract_id uuid, p_project jsonb, p_update jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare project_id uuid;
begin
  if (select auth.uid()) is null or (select private.current_app_role()) is null
    or (select private.current_app_role()) not in ('ADMIN','EDITOR') then
    raise exception 'Perfil sem permissão de escrita' using errcode = '42501';
  end if;
  insert into public.engineering_projects(contract_id, municipality, segment_type, project_category, project_name, project_type)
  values (p_contract_id, p_project->>'municipality', (p_project->>'segment_type')::public.target_segment_type,
    p_project->>'project_category', btrim(p_project->>'project_name'), p_project->>'project_type') returning id into project_id;
  insert into public.engineering_project_updates(
    engineering_project_id, reference_date, concept_status, concept_approved_at,
    executive_status, executive_completed_at, approved_economies, approved_length_m,
    notes, delivery_status, pead_de63_length_m, pead_de110_length_m
  )
  values (
    project_id, (p_update->>'reference_date')::date, p_update->>'concept_status',
    (p_update->>'concept_approved_at')::date, p_update->>'executive_status',
    (p_update->>'executive_completed_at')::date, (p_update->>'approved_economies')::integer,
    (p_update->>'approved_length_m')::numeric, p_update->>'notes', p_update->>'delivery_status',
    (p_update->>'pead_de63_length_m')::numeric, (p_update->>'pead_de110_length_m')::numeric
  );
  return project_id;
end;
$$;
revoke all on function public.create_engineering_project(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_engineering_project(uuid,jsonb,jsonb) to authenticated;
