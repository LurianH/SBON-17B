-- Cadastro único: a mancha GIS continua representada por 1 código
-- com 1 projeto-filho para cada sistema aplicável.
-- Não modifica project_id, snapshots técnicos nem histórico de classificação.
create table if not exists public.engineering_project_management (
 engineering_project_id uuid primary key references public.engineering_projects(id) on delete restrict,
 responsible text check (responsible in ('VITALUX','ESTATICA')),
 delivery_status text check (delivery_status in ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
 notes text,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.engineering_project_management_history(
 id uuid primary key default gen_random_uuid(),
 engineering_project_id uuid not null references public.engineering_projects(id) on delete restrict,
 old_data jsonb,
 new_data jsonb not null,
 changed_by uuid references auth.users(id),
 changed_at timestamptz not null default clock_timestamp()
);
create index if not exists engineering_management_history_project_idx
on public.engineering_project_management_history(engineering_project_id,changed_at desc);

create table if not exists public.engineering_project_network_segments(
 id uuid primary key default gen_random_uuid(),
 engineering_project_id uuid not null references public.engineering_projects(id) on delete restrict,
 material text not null check (length(trim(material)) between 1 and 50),
 diameter_label text not null check (length(trim(diameter_label)) between 1 and 35),
 segment_kind text check (segment_kind is null or length(segment_kind)<=100),
 length_m numeric(14,3) not null check (length_m>0),
 segment_status text not null default 'PROJECTED'
   check (segment_status in ('PROJECTED','APPROVED','EXECUTED')),
 source text not null default 'MANUAL' check (source in ('LEGACY','MANUAL')),
 notes text,
 active boolean not null default true,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id)
);
create unique index if not exists engineering_network_legacy_unique on public.engineering_project_network_segments(engineering_project_id,material,diameter_label) where source='LEGACY';
create index if not exists engineering_network_segments_project on public.engineering_project_network_segments(engineering_project_id,active);
create table if not exists public.engineering_project_network_segments_history(
 id uuid primary key default gen_random_uuid(),
 network_segment_id uuid not null references public.engineering_project_network_segments(id) on delete restrict,
 engineering_project_id uuid not null references public.engineering_projects(id) on delete restrict,
 old_data jsonb,
 new_data jsonb not null,
 changed_by uuid references auth.users(id),
 changed_at timestamptz not null default clock_timestamp()
);
create index if not exists engineering_network_history_project on public.engineering_project_network_segments_history(engineering_project_id,changed_at desc);

alter table public.engineering_project_management enable row level security;
alter table public.engineering_project_management_history enable row level security;
alter table public.engineering_project_network_segments enable row level security;
alter table public.engineering_project_network_segments_history enable row level security;
revoke all on public.engineering_project_management,public.engineering_project_management_history,
public.engineering_project_network_segments,public.engineering_project_network_segments_history from public,anon,authenticated;
grant select,insert,update on public.engineering_project_management,public.engineering_project_network_segments to authenticated;
grant select on public.engineering_project_management_history,public.engineering_project_network_segments_history to authenticated;
create policy management_read on public.engineering_project_management for select to authenticated
using (private.current_app_role() is not null);
create policy management_write on public.engineering_project_management for insert to authenticated
with check (private.current_app_role() in ('ADMIN','EDITOR') and exists
  (select 1 from public.engineering_projects p where p.id=engineering_project_id and p.active));
create policy management_edit on public.engineering_project_management for update to authenticated
using (private.current_app_role() in ('ADMIN','EDITOR'))
with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy management_history_read on public.engineering_project_management_history for select to authenticated
using (private.current_app_role() is not null);
create policy network_read on public.engineering_project_network_segments for select to authenticated
using (private.current_app_role() is not null);
create policy network_write on public.engineering_project_network_segments for insert to authenticated
with check (private.current_app_role() in ('ADMIN','EDITOR') and source='MANUAL' and exists
 (select 1 from public.engineering_projects p where p.id=engineering_project_id and p.active));
create policy network_edit on public.engineering_project_network_segments for update to authenticated
using (private.current_app_role() in ('ADMIN','EDITOR'))
with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy network_history_read on public.engineering_project_network_segments_history for select to authenticated
using (private.current_app_role() is not null);

create function private.audit_eng_management() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  new.updated_at=clock_timestamp();
  new.updated_by=auth.uid();
  insert into public.engineering_project_management_history(engineering_project_id,old_data,new_data,changed_by)
   values(new.engineering_project_id,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
  return new;
end $$;
create trigger management_track before insert or update on public.engineering_project_management
for each row execute function private.audit_eng_management();

create function private.stamp_eng_network() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  new.updated_at=clock_timestamp();
  new.updated_by=auth.uid();
  if tg_op='INSERT' then new.created_by=auth.uid(); end if;
  return new;
end $$;
create trigger network_stamp before insert or update on public.engineering_project_network_segments
for each row execute function private.stamp_eng_network();
create function private.audit_eng_network() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  insert into public.engineering_project_network_segments_history(network_segment_id,engineering_project_id,old_data,new_data,changed_by)
  values(new.id,new.engineering_project_id,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());
  return new;
end $$;
create trigger network_track after insert or update on public.engineering_project_network_segments
for each row execute function private.audit_eng_network();

-- Valores históricos aprovados: migrar DE63 e DE110 uma única vez, sem duplicar.
-- O total de cada projeto continua sendo exatamente o original (13 projetos).
insert into public.engineering_project_network_segments
 (engineering_project_id,material,diameter_label,segment_kind,length_m,segment_status,source,notes)
select p.id,'PEAD','DE63','Rede de Água',u.pead_de63_length_m,'APPROVED','LEGACY',
 'Importado do último lançamento de Obras Lineares. Snapshot e histórico técnico originais preservados.'
from public.engineering_projects p
join public.engineering_current_updates u on u.engineering_project_id=p.id
where p.active and p.project_category='WATER_LINEAR' and u.pead_de63_length_m>0
on conflict do nothing;
insert into public.engineering_project_network_segments
 (engineering_project_id,material,diameter_label,segment_kind,length_m,segment_status,source,notes)
select p.id,'PEAD','DE110','Rede de Água',u.pead_de110_length_m,'APPROVED','LEGACY',
 'Importado do último lançamento de Obras Lineares. Snapshot e histórico técnico originais preservados.'
from public.engineering_projects p
join public.engineering_current_updates u on u.engineering_project_id=p.id
where p.active and p.project_category='WATER_LINEAR' and u.pead_de110_length_m>0
on conflict do nothing;

do $$
declare
 total_segments integer;
 legacy_m numeric;
 original_m numeric;
begin
 select count(*),coalesce(sum(length_m),0) into total_segments,legacy_m
 from public.engineering_project_network_segments where source='LEGACY' and active;
 select coalesce(sum(u.approved_length_m),0) into original_m
 from public.engineering_projects p join public.engineering_current_updates u
 on u.engineering_project_id=p.id where p.active and p.project_category='WATER_LINEAR';
 if total_segments<>15 or legacy_m<>original_m then
  raise exception 'Migração de rede não coincide com os registros existentes: trechos %, metros % vs %',total_segments,legacy_m,original_m;
 end if;
end $$;
