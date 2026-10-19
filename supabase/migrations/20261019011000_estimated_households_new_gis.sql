-- Estimativas validadas pelo responsável: 1 domicílio = 1 economia ESTIMADA
-- em Água e 1 em Esgoto para 10 novas manchas do GIS.
-- Não altera economias aprovadas nem as metas anuais.
alter table public.gis_stains
  add column if not exists estimated_households integer check(estimated_households>=0);

do $$
declare
  contract uuid;
  matches integer;
  needs integer;
begin
  select id into strict contract from public.contracts
   where code='SBON 17B' and active=true;
  select count(*) into matches from public.gis_stains
   where contract_id=contract and source_sheet='Planilha2';
  select count(*) into needs from public.gis_stains
   where contract_id=contract and source_sheet='Planilha2'
   and (economies_ica is not null or economies_ice is not null or estimated_households is not null);
  if matches<>10 or needs<>0 then
    raise exception 'Cadastro GIS já foi atualizado ou contém dados diferentes (%, %) — não sobrescrever',matches,needs;
  end if;
end $$;

with gis_values(gis_code,households) as (
 values
 ('553-AF-0001N',10),
 ('271-AR-0002N',11),
 ('553-AF-0003N',13),
 ('553-AF-0004N',73),
 ('553-AF-0005N',52),
 ('553-AF-0006N',25),
 ('553-AR-0002N',154),
 ('764-AR-0001N',5),
 ('523-AR-0001N',95),
 ('271-AR-0001N',28)
)
update public.gis_stains g
 set estimated_households=v.households,
     economies_ica=v.households,
     economies_ice=v.households,
     updated_at=clock_timestamp()
from gis_values v
where g.gis_code=v.gis_code
  and g.contract_id=(select id from public.contracts where code='SBON 17B' and active=true limit 1)
  and g.source_sheet='Planilha2' and g.classification='BOTH';

do $$
declare match_count integer; households_total integer;water_total integer;sewer_total integer;
begin
 select count(*),sum(estimated_households),sum(economies_ica),sum(economies_ice)
 into match_count,households_total,water_total,sewer_total
 from public.gis_stains
 where contract_id=(select id from public.contracts where code='SBON 17B' and active=true limit 1)
   and source_sheet='Planilha2';
 if match_count<>10 or households_total<>466 or water_total<>466 or sewer_total<>466 then
   raise exception 'Conferência das 10 novas manchas falhou (%,%,%,%)',
     match_count,households_total,water_total,sewer_total;
 end if;
end $$;

-- Campo de rastreabilidade na mesma view já usada pelas duas interfaces.
create or replace view public.gis_stain_system_effective with (security_invoker=true) as
select g.id,g.contract_id,g.gis_code,g.municipality,g.classification,
       g.settlement_type,g.neighborhood,g.source_sheet,g.economies_ica,g.economies_ice,g.economies_iec,
       g.cancelled,l.engineering_project_id,
       seg.segment_type,
       case when g.cancelled then 'CANCELLED'
            else coalesce(r.status,ss.status,'UNCLASSIFIED') end as effective_status,
       p.project_name as linked_project_name,
       g.estimated_households
from public.gis_stains g
cross join lateral (
  select 'SEWER'::public.target_segment_type as segment_type
  union all select 'WATER'::public.target_segment_type where g.classification='BOTH'
) seg
left join public.gis_stain_project_links l
  on l.gis_stain_id=g.id and l.segment_type=seg.segment_type
left join public.gis_stain_system_status ss
  on ss.gis_stain_id=g.id and ss.segment_type=seg.segment_type
left join public.engineering_project_review_status r on r.engineering_project_id=l.engineering_project_id
left join public.engineering_projects p on p.id=l.engineering_project_id;
