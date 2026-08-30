-- Fase 5: normaliza metas anuais sem inserir ou remover dados operacionais.
create type public.target_segment_type as enum ('WATER', 'SEWER');

alter table public.annual_targets
  add column cycle_number smallint,
  add column milestone_date date,
  alter column target_economies drop not null;

comment on column public.annual_targets.target_economies is
  'Campo agregado legado. Novas metas devem ser calculadas a partir de annual_target_details.';

alter table public.annual_targets
  add constraint annual_targets_cycle_number_check
    check (cycle_number is null or cycle_number > 0),
  add constraint annual_targets_milestone_year_check
    check (milestone_date is null or extract(year from milestone_date)::integer = year);

create unique index annual_targets_contract_cycle_unique
  on public.annual_targets (contract_id, cycle_number)
  where cycle_number is not null;

create table public.annual_target_details (
  id uuid primary key default gen_random_uuid(),
  annual_target_id uuid not null references public.annual_targets(id) on delete cascade,
  municipality text not null check (btrim(municipality) <> ''),
  segment_type public.target_segment_type not null,
  cut_name text check (cut_name is null or btrim(cut_name) <> ''),
  target_economies integer not null check (target_economies >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index annual_target_details_annual_target_id_idx
  on public.annual_target_details (annual_target_id);

create unique index annual_target_details_natural_key_unique
  on public.annual_target_details (
    annual_target_id,
    lower(btrim(municipality)),
    segment_type,
    coalesce(lower(btrim(cut_name)), '')
  );

alter table public.annual_target_details enable row level security;

revoke all on table public.annual_target_details from anon, authenticated;
grant select, insert, update, delete on table public.annual_target_details to authenticated;

create policy active_profiles_read_target_details
  on public.annual_target_details
  for select
  to authenticated
  using (private.current_app_role() is not null);

create policy admin_insert_target_details
  on public.annual_target_details
  for insert
  to authenticated
  with check (private.current_app_role() = 'ADMIN');

create policy admin_update_target_details
  on public.annual_target_details
  for update
  to authenticated
  using (private.current_app_role() = 'ADMIN')
  with check (private.current_app_role() = 'ADMIN');

create policy admin_delete_target_details
  on public.annual_target_details
  for delete
  to authenticated
  using (private.current_app_role() = 'ADMIN');

create trigger touch_target_details
  before update on public.annual_target_details
  for each row execute function private.touch_updated_at();

create trigger audit_target_details
  after insert or update or delete on public.annual_target_details
  for each row execute function private.capture_audit();
