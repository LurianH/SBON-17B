-- SOMENTE desenvolvimento/homologação. Nunca executar automaticamente em produção.
update public.contracts set contract_value=78500000,start_date='2026-01-01',end_date='2026-12-31' where code='SBON 17B';
insert into public.annual_targets(contract_id,year,target_economies)
select id,2026,15000 from public.contracts where code='SBON 17B'
on conflict(contract_id,year) do update set target_economies=excluded.target_economies;
do $$
declare contract uuid; actor uuid;
begin
 select id into contract from public.contracts where code='SBON 17B';
 select id into actor from public.profiles where active=true order by created_at limit 1;
 if actor is null then raise notice 'Crie um usuário/profile de homologação antes de carregar movimentos.'; return; end if;
 insert into public.monthly_financials(contract_id,reference_month,reference_year,amount,notes,created_by) values
 (contract,7,2026,3500000,'Homologação',actor),(contract,8,2026,4250000,'Homologação',actor)
 on conflict do nothing;
 insert into public.weekly_progress(contract_id,reference_date,economies_available,economies_executed,network_approved_m,network_executed_m,created_by) values
 (contract,'2026-08-03',10000,8000,140000,120000,actor),
 (contract,'2026-08-10',10350,8250,145000,123500,actor),
 (contract,'2026-08-17',10730,8560,151000,127800,actor),
 (contract,'2026-08-24',11100,8840,157000,132000,actor)
 on conflict do nothing;
end $$;
