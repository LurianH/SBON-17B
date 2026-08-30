-- Fase 2: endurecimento incremental. Não remove dados existentes.
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.contracts alter column contract_value drop not null;
alter table public.contracts alter column start_date drop not null;
alter table public.contracts alter column end_date drop not null;
alter table public.monthly_financials add constraint monthly_financials_year_check check(reference_year between 2000 and 2100) not valid;
alter table public.monthly_financials validate constraint monthly_financials_year_check;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path=''
as $$
  select role
  from public.profiles
  where id=(select auth.uid()) and active=true
$$;

drop policy if exists read_contracts on public.contracts;
drop policy if exists read_subcontracts on public.subcontracts;
drop policy if exists read_targets on public.annual_targets;
drop policy if exists read_financials on public.monthly_financials;
drop policy if exists read_progress on public.weekly_progress;
drop policy if exists read_cycles on public.projection_cycles;
drop policy if exists read_actions on public.action_plans;

create policy active_profiles_read_contracts on public.contracts for select to authenticated using(private.current_app_role() is not null);
create policy active_profiles_read_subcontracts on public.subcontracts for select to authenticated using(private.current_app_role() is not null);
create policy active_profiles_read_targets on public.annual_targets for select to authenticated using(private.current_app_role() is not null);
create policy active_profiles_read_financials on public.monthly_financials for select to authenticated using(private.current_app_role() is not null);
create policy active_profiles_read_progress on public.weekly_progress for select to authenticated using(private.current_app_role() is not null);
create policy active_profiles_read_cycles on public.projection_cycles for select to authenticated using(private.current_app_role() is not null);
create policy active_profiles_read_actions on public.action_plans for select to authenticated using(private.current_app_role() is not null);

create or replace function private.touch_updated_at()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end
$$;
revoke all on function private.touch_updated_at() from public,anon,authenticated;

create trigger touch_profiles before update on public.profiles for each row execute function private.touch_updated_at();
create trigger touch_contracts before update on public.contracts for each row execute function private.touch_updated_at();
create trigger touch_targets before update on public.annual_targets for each row execute function private.touch_updated_at();
create trigger touch_financials before update on public.monthly_financials for each row execute function private.touch_updated_at();
create trigger touch_progress before update on public.weekly_progress for each row execute function private.touch_updated_at();
create trigger touch_actions before update on public.action_plans for each row execute function private.touch_updated_at();

create or replace function private.capture_audit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(user_id,entity,entity_id,action,old_data,new_data)
 values((select auth.uid()),TG_TABLE_NAME,coalesce(NEW.id,OLD.id),TG_OP,case when TG_OP<>'INSERT' then to_jsonb(OLD) end,case when TG_OP<>'DELETE' then to_jsonb(NEW) end);
 return coalesce(NEW,OLD);
end
$$;
revoke all on function private.capture_audit() from public,anon,authenticated;
drop trigger if exists audit_contracts on public.contracts;drop trigger if exists audit_targets on public.annual_targets;drop trigger if exists audit_financials on public.monthly_financials;drop trigger if exists audit_progress on public.weekly_progress;drop trigger if exists audit_actions on public.action_plans;
create trigger audit_contracts after insert or update or delete on public.contracts for each row execute function private.capture_audit();create trigger audit_targets after insert or update or delete on public.annual_targets for each row execute function private.capture_audit();create trigger audit_financials after insert or update or delete on public.monthly_financials for each row execute function private.capture_audit();create trigger audit_progress after insert or update or delete on public.weekly_progress for each row execute function private.capture_audit();create trigger audit_actions after insert or update or delete on public.action_plans for each row execute function private.capture_audit();
drop function if exists public.capture_audit();

insert into public.contracts(code,name,contract_value,start_date,end_date)
values('SBON 17B','SBON 17B',null,null,null)
on conflict(code) do nothing;
