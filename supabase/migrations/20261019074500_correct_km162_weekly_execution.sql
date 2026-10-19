-- Correção confirmada: KM162, Porangaba, Água PEAD DE63.
-- A planilha semanal do contrato registra ACUMULADOS, não produções diárias.
-- As correções guardam antes/depois e mantêm todos os IDs e datas originais.
create table if not exists public.weekly_progress_correction_audit (
 id uuid primary key default gen_random_uuid(),
 weekly_progress_id uuid not null references public.weekly_progress(id) on delete restrict,
 engineering_project_id uuid not null references public.engineering_projects(id) on delete restrict,
 old_network_executed_m numeric(14,3) not null,
 new_network_executed_m numeric(14,3) not null,
 notes text not null,
 corrected_at timestamptz not null default clock_timestamp(),
 corrected_by uuid references auth.users(id)
);
create index if not exists weekly_correction_progress_idx
 on public.weekly_progress_correction_audit(weekly_progress_id,corrected_at desc);
create table if not exists public.engineering_project_execution_progress (
 id uuid primary key default gen_random_uuid(),
 engineering_project_id uuid not null references public.engineering_projects(id) on delete restrict,
 reference_date date not null,
 material text not null,
 diameter_label text not null,
 period_length_m numeric(14,3) not null check (period_length_m>=0),
 cumulative_length_m numeric(14,3) not null check (cumulative_length_m>=0),
 executed_economies integer not null default 0 check (executed_economies>=0),
 source_weekly_progress_id uuid not null unique references public.weekly_progress(id) on delete restrict,
 source_note text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(engineering_project_id,reference_date,material,diameter_label)
);
create index if not exists engineering_exec_progress_project_idx
 on public.engineering_project_execution_progress(engineering_project_id,reference_date desc);
alter table public.weekly_progress_correction_audit enable row level security;
alter table public.engineering_project_execution_progress enable row level security;
revoke all on public.weekly_progress_correction_audit,public.engineering_project_execution_progress from public,anon,authenticated;
grant select on public.weekly_progress_correction_audit to authenticated;
grant select on public.engineering_project_execution_progress to authenticated;
create policy weekly_correction_read on public.weekly_progress_correction_audit for select to authenticated
 using (private.current_app_role() is not null);
create policy engineering_execution_read on public.engineering_project_execution_progress for select to authenticated
 using (private.current_app_role() is not null);

do $$
declare
 contract_uuid uuid;
 project_uuid uuid;
 matches integer;
 correct_row record;
 expected_dates date[] := array[date '2026-10-08',date '2026-10-09',date '2026-10-15',date '2026-10-16'];
 expected_original numeric[] := array[23.680,76.320,65.000,165.000];
 correct_accumulated numeric[] := array[23.680,100.000,165.000,165.000];
 period_execution numeric[] := array[23.680,76.320,65.000,0.000];
 i integer;
begin
 select id into strict contract_uuid from public.contracts where code='SBON 17B' and active;
 select p.id into strict project_uuid
 from public.gis_stains g
 join public.gis_stain_project_links l on l.gis_stain_id=g.id and l.segment_type='WATER'
 join public.engineering_projects p on p.id=l.engineering_project_id
 where g.contract_id=contract_uuid and g.gis_code='553-AF-0005N' and p.active
 and p.municipality='Porangaba' and p.segment_type='WATER';
 select count(*) into matches from public.weekly_progress
 where contract_id=contract_uuid and active=true and reference_date=any(expected_dates);
 if matches<>4 then raise exception 'Esperados 4 lançamentos ativos, recebidos %',matches; end if;
 for i in 1..4 loop
  select * into strict correct_row from public.weekly_progress
  where contract_id=contract_uuid and active and reference_date=expected_dates[i] for update;
  if correct_row.economies_executed<>0 or correct_row.network_executed_m<>expected_original[i] then
   raise exception 'Lançamento % não coincide com valores originais confirmados. Nenhum valor foi alterado.',expected_dates[i];
  end if;
  if correct_accumulated[i]<>correct_row.network_executed_m then
   insert into public.weekly_progress_correction_audit
    (weekly_progress_id,engineering_project_id,old_network_executed_m,new_network_executed_m,notes)
   values(correct_row.id,project_uuid,correct_row.network_executed_m,correct_accumulated[i],
   'Retificação autorizada: 23,68 + 76,32 + 65,00 = 165,00 m de Água PEAD DE63 no KM 162 até 15/10. Série contratual representa acumulados.');
   update public.weekly_progress set network_executed_m=correct_accumulated[i],updated_at=clock_timestamp()
   where id=correct_row.id;
  end if;
  insert into public.engineering_project_execution_progress
   (engineering_project_id,reference_date,material,diameter_label,
    period_length_m,cumulative_length_m,executed_economies,source_weekly_progress_id,source_note)
   values(project_uuid,expected_dates[i],'PEAD','DE63',period_execution[i],
     correct_accumulated[i],0,correct_row.id,
     'KM 162 · registro de evolução acumulada validado pelo usuário em 19/10/2026; em 16/10 não houve acréscimo sobre os 165 m registrados até 15/10.');
 end loop;
 if (select sum(period_length_m) from public.engineering_project_execution_progress
     where engineering_project_id=project_uuid)<>165
   or (select cumulative_length_m from public.engineering_project_execution_progress
       where engineering_project_id=project_uuid and reference_date=date '2026-10-16')<>165 then
    raise exception 'Totais de execução não conciliados.';
 end if;
end $$;
