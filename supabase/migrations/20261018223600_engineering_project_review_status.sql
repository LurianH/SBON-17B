-- Controle separado de classificação gerencial de projetos, sem modificar snapshots existentes.
-- Projetos não são manchas; gráficos contratuais de 28/74 manchas permanecem independentes.
create table if not exists public.engineering_project_review_status (
  engineering_project_id uuid primary key references public.engineering_projects(id) on delete restrict,
  status text not null check (status in (
    'UNCLASSIFIED','NO_OBJECTION','NO_OBJECTION_RESERVATIONS',
    'IN_PREPARATION','IN_REVIEW','NOT_STARTED','CANCELLED'
  )),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.engineering_project_review_history (
  id uuid primary key default gen_random_uuid(),
  engineering_project_id uuid not null references public.engineering_projects(id) on delete restrict,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default clock_timestamp()
);
create index if not exists engineering_project_review_history_project_idx
  on public.engineering_project_review_history(engineering_project_id, changed_at desc);
alter table public.engineering_project_review_status enable row level security;
alter table public.engineering_project_review_history enable row level security;
revoke all on public.engineering_project_review_status,public.engineering_project_review_history from anon,authenticated;
grant select,insert,update on public.engineering_project_review_status to authenticated;
grant select on public.engineering_project_review_history to authenticated;
create policy engineering_review_read on public.engineering_project_review_status
 for select to authenticated using (private.current_app_role() is not null);
create policy engineering_review_insert on public.engineering_project_review_status
 for insert to authenticated with check (
   private.current_app_role() in ('ADMIN','EDITOR')
   and (updated_by=(select auth.uid()))
   and exists(select 1 from public.engineering_projects p
              join public.contracts c on c.id=p.contract_id
              where p.id=engineering_project_id and p.active and c.active)
 );
create policy engineering_review_update on public.engineering_project_review_status
 for update to authenticated using (
   private.current_app_role() in ('ADMIN','EDITOR')
 ) with check (
   private.current_app_role() in ('ADMIN','EDITOR')
   and updated_by=(select auth.uid())
   and exists(select 1 from public.engineering_projects p
              join public.contracts c on c.id=p.contract_id
              where p.id=engineering_project_id and p.active and c.active)
 );
create policy engineering_review_history_read on public.engineering_project_review_history
 for select to authenticated using (private.current_app_role() is not null);
create function private.audit_engineering_project_review() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 new.updated_at=clock_timestamp();
 new.updated_by=(select auth.uid());
 return new;
end;
$$;
create trigger engineering_review_stamp before insert or update on public.engineering_project_review_status
 for each row execute function private.audit_engineering_project_review();
create function private.record_engineering_project_review() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   insert into public.engineering_project_review_history(engineering_project_id,old_status,new_status,changed_by)
     values(new.engineering_project_id,null,new.status,(select auth.uid()));
 elsif new.status is distinct from old.status then
   insert into public.engineering_project_review_history(engineering_project_id,old_status,new_status,changed_by)
     values(new.engineering_project_id,old.status,new.status,(select auth.uid()));
 end if;
 return new;
end;
$$;
create trigger engineering_review_history after insert or update on public.engineering_project_review_status
 for each row execute function private.record_engineering_project_review();