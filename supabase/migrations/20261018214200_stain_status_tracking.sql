-- SBON 17B: cadastro individual das manchas para indicadores gerenciais.
-- Migration aditiva: não modifica nem exclui projetos, históricos e medições existentes.
create table if not exists public.contract_stain_targets (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id),
 segment_type public.target_segment_type not null,
 total_count integer not null check(total_count between 0 and 10000),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 unique(contract_id,segment_type)
);
create table if not exists public.contract_stains (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id),
 segment_type public.target_segment_type not null,
 municipality text not null check(length(btrim(municipality))>0),
 stain_code text not null check(length(btrim(stain_code))>0),
 status text not null default 'UNCLASSIFIED' check(status in ('UNCLASSIFIED','NO_OBJECTION','NO_OBJECTION_RESERVATIONS','IN_PREPARATION','IN_REVIEW','NOT_STARTED','CANCELLED')),
 notes text,
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(contract_id,segment_type,stain_code)
);
create table if not exists public.contract_stain_history (
 id uuid primary key default gen_random_uuid(),
 stain_id uuid not null references public.contract_stains(id) on delete restrict,
 old_status text,
 new_status text not null,
 changed_by uuid references auth.users(id),
 changed_at timestamptz not null default now()
);
create index if not exists contract_stains_contract_idx on public.contract_stains(contract_id,segment_type);
create index if not exists contract_stain_history_stain_idx on public.contract_stain_history(stain_id,changed_at desc);
alter table public.contract_stain_targets enable row level security;
alter table public.contract_stains enable row level security;
alter table public.contract_stain_history enable row level security;
revoke all on public.contract_stain_targets,public.contract_stains,public.contract_stain_history from anon,authenticated;
grant select,insert,update,delete on public.contract_stain_targets,public.contract_stains to authenticated;
grant select on public.contract_stain_history to authenticated;
create policy stains_targets_read on public.contract_stain_targets for select to authenticated using(private.current_app_role() is not null);
create policy stains_targets_insert on public.contract_stain_targets for insert to authenticated with check(private.current_app_role() in ('ADMIN','EDITOR'));
create policy stains_targets_update on public.contract_stain_targets for update to authenticated using(private.current_app_role() in ('ADMIN','EDITOR')) with check(private.current_app_role() in ('ADMIN','EDITOR'));
create policy stains_targets_delete on public.contract_stain_targets for delete to authenticated using(private.current_app_role()='ADMIN');
create policy stains_read on public.contract_stains for select to authenticated using(private.current_app_role() is not null);
create policy stains_insert on public.contract_stains for insert to authenticated with check(private.current_app_role() in ('ADMIN','EDITOR'));
create policy stains_update on public.contract_stains for update to authenticated using(private.current_app_role() in ('ADMIN','EDITOR')) with check(private.current_app_role() in ('ADMIN','EDITOR'));
create policy stains_delete on public.contract_stains for delete to authenticated using(private.current_app_role()='ADMIN');
create policy stains_history_read on public.contract_stain_history for select to authenticated using(private.current_app_role() is not null);
create trigger touch_contract_stain_targets before update on public.contract_stain_targets for each row execute function private.touch_updated_at();
create trigger touch_contract_stains before update on public.contract_stains for each row execute function private.touch_updated_at();
create function private.record_contract_stain_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then
  insert into public.contract_stain_history(stain_id,old_status,new_status,changed_by)
  values(new.id,case when tg_op='INSERT' then null else old.status end,new.status,(select auth.uid()));
 end if;
 return new;
end $$;
revoke all on function private.record_contract_stain_history() from public;
create trigger log_contract_stain_history after insert or update on public.contract_stains
for each row execute function private.record_contract_stain_history();
-- Totais confirmados pelo contrato (editáveis por ADMIN e EDITOR).
insert into public.contract_stain_targets(contract_id,segment_type,total_count)
select id,'WATER'::public.target_segment_type,28 from public.contracts where code='SBON 17B' and active=true
on conflict(contract_id,segment_type) do nothing;
insert into public.contract_stain_targets(contract_id,segment_type,total_count)
select id,'SEWER'::public.target_segment_type,74 from public.contracts where code='SBON 17B' and active=true
on conflict(contract_id,segment_type) do nothing;
