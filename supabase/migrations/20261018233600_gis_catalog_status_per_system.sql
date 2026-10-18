-- Catálogo oficial GIS. Uma linha por mancha/código, status independente por sistema.
-- A categoria BOTH participa das metas de Água E de Esgoto, sem duplicar economias ICE/IEC.
create table public.gis_stains (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  gis_code text not null,
  municipality text not null,
  classification text not null check (classification in ('BOTH','SEWER')),
  settlement_type text check (settlement_type in ('Formal','Rural')),
  neighborhood text,
  source_sheet text not null check (source_sheet in ('Planilha1','Planilha2')),
  economies_ica integer check (economies_ica>=0),
  economies_ice integer check (economies_ice>=0),
  economies_iec integer check (economies_iec>=0),
  cancelled boolean not null default false,
  engineering_project_id uuid references public.engineering_projects(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id),
  unique (contract_id,gis_code)
);
create unique index gis_stains_project_link_uniq on public.gis_stains(engineering_project_id)
  where engineering_project_id is not null;
create index gis_stains_by_city on public.gis_stains(contract_id,municipality,classification);
alter table public.gis_stains enable row level security;
revoke all on public.gis_stains from public,anon,authenticated;
grant select,insert,update on public.gis_stains to authenticated;
create policy gis_stains_read on public.gis_stains for select to authenticated
 using (private.current_app_role() is not null);
create policy gis_stains_insert on public.gis_stains for insert to authenticated
 with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy gis_stains_update on public.gis_stains for update to authenticated
 using (private.current_app_role() in ('ADMIN','EDITOR'))
 with check (private.current_app_role() in ('ADMIN','EDITOR'));

create table public.gis_stain_system_status (
  gis_stain_id uuid not null references public.gis_stains(id) on delete restrict,
  segment_type public.target_segment_type not null,
  status text not null check (status in (
    'UNCLASSIFIED','NO_OBJECTION','NO_OBJECTION_RESERVATIONS',
    'IN_PREPARATION','IN_REVIEW','NOT_STARTED','CANCELLED'
  )),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (gis_stain_id,segment_type)
);
create table public.gis_stain_system_history (
  id uuid primary key default gen_random_uuid(),
  gis_stain_id uuid not null references public.gis_stains(id) on delete restrict,
  segment_type public.target_segment_type not null,
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid references auth.users(id)
);
create index gis_stain_history_sort on public.gis_stain_system_history(gis_stain_id,segment_type,changed_at desc);
alter table public.gis_stain_system_status enable row level security;
alter table public.gis_stain_system_history enable row level security;
revoke all on public.gis_stain_system_status,public.gis_stain_system_history from public,anon,authenticated;
grant select,insert,update on public.gis_stain_system_status to authenticated;
grant select on public.gis_stain_system_history to authenticated;
create policy gis_system_status_read on public.gis_stain_system_status for select to authenticated
 using (private.current_app_role() is not null);
create policy gis_system_status_insert on public.gis_stain_system_status for insert to authenticated
 with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy gis_system_status_update on public.gis_stain_system_status for update to authenticated
 using (private.current_app_role() in ('ADMIN','EDITOR'))
 with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy gis_system_history_read on public.gis_stain_system_history for select to authenticated
 using (private.current_app_role() is not null);

create function private.validate_gis_stain_system_status() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare g record;
begin
  select classification,cancelled,engineering_project_id into g from public.gis_stains where id=new.gis_stain_id;
  if not found or (new.segment_type='WATER' and g.classification<>'BOTH') then
    raise exception 'Sistema não pertence à mancha GIS' using errcode='23514';
  end if;
  if g.cancelled then
    raise exception 'Mancha GIS cancelada; classificação travada' using errcode='23514';
  end if;
  if new.segment_type='WATER' and g.engineering_project_id is not null then
    raise exception 'Classificação de Água vinculada à Engenharia deve ser alterada no projeto'
      using errcode='23514';
  end if;
  new.updated_by=(select auth.uid());
  new.updated_at=clock_timestamp();
  return new;
end; $$;
create trigger gis_system_validate before insert or update on public.gis_stain_system_status
 for each row execute function private.validate_gis_stain_system_status();

create function private.log_gis_stain_system_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.gis_stain_system_history(gis_stain_id,segment_type,old_status,new_status,changed_by)
    values(new.gis_stain_id,new.segment_type,null,new.status,(select auth.uid()));
  elsif old.status is distinct from new.status then
    insert into public.gis_stain_system_history(gis_stain_id,segment_type,old_status,new_status,changed_by)
    values(new.gis_stain_id,new.segment_type,old.status,new.status,(select auth.uid()));
  end if;
  return new;
end; $$;
create trigger gis_system_audit after insert or update on public.gis_stain_system_status
 for each row execute function private.log_gis_stain_system_status();

create view public.gis_stain_system_effective with (security_invoker=true) as
select g.id,g.contract_id,g.gis_code,g.municipality,g.classification,
       g.settlement_type,g.neighborhood,g.source_sheet,g.economies_ica,g.economies_ice,g.economies_iec,
       g.cancelled,g.engineering_project_id,
       s.segment_type,
       case when g.cancelled then 'CANCELLED'
            when s.segment_type='WATER' and g.engineering_project_id is not null then coalesce(r.status,'UNCLASSIFIED')
            else coalesce(ss.status,'UNCLASSIFIED') end as effective_status,
       p.project_name as linked_project_name
from public.gis_stains g
cross join lateral (
  select 'SEWER'::public.target_segment_type as segment_type
  union all
  select 'WATER'::public.target_segment_type where g.classification='BOTH'
) s
left join public.gis_stain_system_status ss on ss.gis_stain_id=g.id and ss.segment_type=s.segment_type
left join public.engineering_project_review_status r on r.engineering_project_id=g.engineering_project_id
left join public.engineering_projects p on p.id=g.engineering_project_id;
revoke all on public.gis_stain_system_effective from public,anon,authenticated;
grant select on public.gis_stain_system_effective to authenticated;
