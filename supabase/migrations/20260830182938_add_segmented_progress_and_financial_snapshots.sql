-- Preserva medições acumuladas e avanços físicos segmentados sem alterar históricos consolidados.
create table public.financial_measurement_snapshots (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  reference_year integer not null check (reference_year between 2000 and 2100),
  reference_month integer not null check (reference_month between 1 and 12),
  cumulative_amount numeric(18,2) not null check (cumulative_amount >= 0),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, reference_year, reference_month)
);

create index financial_measurement_snapshots_contract_id_idx on public.financial_measurement_snapshots(contract_id);

create table public.weekly_progress_details (
  id uuid primary key default gen_random_uuid(),
  weekly_progress_id uuid not null references public.weekly_progress(id) on delete cascade,
  municipality text not null check (btrim(municipality) <> ''),
  segment_type public.target_segment_type not null,
  economies_available integer not null check (economies_available >= 0),
  economies_executed integer not null check (economies_executed >= 0),
  network_approved_m numeric(14,3) not null check (network_approved_m >= 0),
  network_executed_m numeric(14,3) not null check (network_executed_m >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_progress_id, municipality, segment_type)
);

create index weekly_progress_details_progress_id_idx on public.weekly_progress_details(weekly_progress_id);

alter table public.financial_measurement_snapshots enable row level security;
alter table public.weekly_progress_details enable row level security;
revoke all on public.financial_measurement_snapshots, public.weekly_progress_details from anon, authenticated;
grant select, insert, update, delete on public.financial_measurement_snapshots, public.weekly_progress_details to authenticated;

create policy active_profiles_read_financial_snapshots on public.financial_measurement_snapshots for select to authenticated using (private.current_app_role() is not null);
create policy write_financial_snapshots_i on public.financial_measurement_snapshots for insert to authenticated with check (private.current_app_role() in ('ADMIN','EDITOR') and created_by=(select auth.uid()));
create policy write_financial_snapshots_u on public.financial_measurement_snapshots for update to authenticated using (private.current_app_role() in ('ADMIN','EDITOR')) with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy admin_financial_snapshots_d on public.financial_measurement_snapshots for delete to authenticated using (private.current_app_role()='ADMIN');

create policy active_profiles_read_progress_details on public.weekly_progress_details for select to authenticated using (private.current_app_role() is not null);
create policy write_progress_details_i on public.weekly_progress_details for insert to authenticated with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy write_progress_details_u on public.weekly_progress_details for update to authenticated using (private.current_app_role() in ('ADMIN','EDITOR')) with check (private.current_app_role() in ('ADMIN','EDITOR'));
create policy admin_progress_details_d on public.weekly_progress_details for delete to authenticated using (private.current_app_role()='ADMIN');

create trigger touch_financial_snapshots before update on public.financial_measurement_snapshots for each row execute function private.touch_updated_at();
create trigger touch_progress_details before update on public.weekly_progress_details for each row execute function private.touch_updated_at();
create trigger audit_financial_snapshots after insert or update or delete on public.financial_measurement_snapshots for each row execute function private.capture_audit();
create trigger audit_progress_details after insert or update or delete on public.weekly_progress_details for each row execute function private.capture_audit();
