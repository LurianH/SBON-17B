-- Uma mancha distinta por projeto de Água já confirmado pelo gestor.
-- Mantém o registro de classificação na Engenharia como fonte única de verdade.
alter table public.contract_stains
  add column if not exists engineering_project_id uuid references public.engineering_projects(id) on delete restrict;
create unique index if not exists contract_stains_linked_project_uq
  on public.contract_stains(engineering_project_id) where engineering_project_id is not null;

-- Confere integridade de contrato e sistema quando uma mancha está ligada a projeto.
create or replace function private.validate_linked_contract_stain() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare found_project record;
begin
  if new.engineering_project_id is not null then
    select contract_id,segment_type,municipality into found_project
      from public.engineering_projects where id=new.engineering_project_id;
    if not found or found_project.contract_id is distinct from new.contract_id
      or found_project.segment_type is distinct from new.segment_type
      or found_project.municipality is distinct from new.municipality then
      raise exception 'O projeto vinculado deve pertencer ao mesmo contrato, sistema e município da mancha.'
        using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_linked_contract_stain on public.contract_stains;
create trigger validate_linked_contract_stain before insert or update of contract_id,segment_type,municipality,engineering_project_id
on public.contract_stains for each row execute function private.validate_linked_contract_stain();

-- Identificação inicial = nome cadastrado do projeto. Não se apresenta como código oficial.
-- Atualizações de status permanecem exclusivamente em engineering_project_review_status.
insert into public.contract_stains (
  contract_id,segment_type,municipality,stain_code,status,engineering_project_id,notes
)
select p.contract_id,p.segment_type,p.municipality,p.project_name,
       'UNCLASSIFIED',p.id,
       'Mancha vinculada ao projeto de Engenharia. A identificação inicial é o nome do projeto, não um código oficial da mancha.'
from public.engineering_projects p
join public.contracts c on c.id=p.contract_id
join public.engineering_project_review_status r on r.engineering_project_id=p.id
where c.code='SBON 17B' and c.active
  and p.active and p.segment_type='WATER' and p.project_category='WATER_LINEAR'
  and r.status <> 'UNCLASSIFIED'
on conflict do nothing;

-- O histórico de classificação desses projetos já reside em
-- engineering_project_review_history, sem copiar status para a tabela de manchas.
create or replace view public.contract_stain_effective_status
with (security_invoker=true) as
select s.*,
       case when s.engineering_project_id is not null
           then coalesce(r.status, 'UNCLASSIFIED')
           else s.status
       end as effective_status,
       p.project_name as linked_project_name
from public.contract_stains s
left join public.engineering_projects p on p.id=s.engineering_project_id
left join public.engineering_project_review_status r on r.engineering_project_id=s.engineering_project_id;
revoke all on public.contract_stain_effective_status from public,anon,authenticated;
grant select on public.contract_stain_effective_status to authenticated;

-- Os totais contratuais existentes (28 Água / 74 Esgoto) não são modificados.
