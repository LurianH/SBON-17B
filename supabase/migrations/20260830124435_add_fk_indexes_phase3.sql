-- Fase 3: índices nas chaves estrangeiras apontadas pelo Performance Advisor.
create index if not exists action_plans_contract_id_idx
  on public.action_plans (contract_id);

create index if not exists action_plans_created_by_idx
  on public.action_plans (created_by);

create index if not exists monthly_financials_created_by_idx
  on public.monthly_financials (created_by);

create index if not exists weekly_progress_created_by_idx
  on public.weekly_progress (created_by);
