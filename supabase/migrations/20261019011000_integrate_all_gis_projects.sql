-- Alinhamento GIS x Engenharia do SBON 17B:
-- uma mancha equivale a um projeto em cada sistema a que pertence.
-- 84 códigos distintos, 38 projetos de Água + 84 de Esgoto.
-- Preserva os 13 projetos lineares preexistentes e seus históricos.
insert into public.engineering_project_categories(code,label)
values ('GIS','Mancha GIS') on conflict(code) do nothing;

create table if not exists public.gis_stain_project_links (
  gis_stain_id uuid not null references public.gis_stains(id) on delete restrict,
  segment_type public.target_segment_type not null,
  engineering_project_id uuid not null unique references public.engineering_projects(id) on delete restrict,
  primary key(gis_stain_id,segment_type)
);
create index if not exists gis_project_links_project_idx
  on public.gis_stain_project_links(engineering_project_id);
alter table public.gis_stain_project_links enable row level security;
revoke all on public.gis_stain_project_links from public,anon,authenticated;
grant select on public.gis_stain_project_links to authenticated;
create policy gis_project_links_read on public.gis_stain_project_links
  for select to authenticated using (private.current_app_role() is not null);

create function private.verify_gis_project_link() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare
  g record; p record;
begin
  select contract_id,municipality,classification into g from public.gis_stains where id=new.gis_stain_id;
  select contract_id,municipality,segment_type into p from public.engineering_projects where id=new.engineering_project_id;
  if g.contract_id is distinct from p.contract_id or g.municipality is distinct from p.municipality
    or p.segment_type is distinct from new.segment_type
    or (new.segment_type='WATER' and g.classification<>'BOTH') then
      raise exception 'Projeto GIS com contrato, cidade ou sistema incompatível' using errcode='23514';
  end if;
  return new;
end $$;
create trigger gis_project_link_validate before insert or update on public.gis_stain_project_links
 for each row execute function private.verify_gis_project_link();

-- Vincula os 13 projetos de Água que já têm código GIS confirmado.
insert into public.gis_stain_project_links(gis_stain_id,segment_type,engineering_project_id)
select id,'WATER'::public.target_segment_type,engineering_project_id
from public.gis_stains where engineering_project_id is not null
on conflict(gis_stain_id,segment_type) do nothing;

do $$
declare
  contract uuid;
  admin_id uuid;
  waters integer;
  sewers integer;
  linked integer;
  new_projects integer;
  historic int;
begin
  select id into strict contract from public.contracts where code='SBON 17B' and active=true;
  select id into strict admin_id from public.profiles where active=true and role='ADMIN' order by id limit 1;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  if (select count(*) from public.gis_stains where contract_id=contract) <> 84
    or (select count(*) from public.gis_stains where contract_id=contract and classification='BOTH') <> 38
    or (select count(*) from public.gis_stain_project_links l
        join public.gis_stains g on g.id=l.gis_stain_id
        where g.contract_id=contract and l.segment_type='WATER') <> 13 then
    raise exception 'Contagens GIS ou vínculos anteriores diferentes da base aprovada';
  end if;

  -- As novas linhas GIS são cadastros de projeto, não indicadores de aprovação.
  -- Não cria snapshots de engenharia nem converte ICE em metragem/esgoto aprovado.
  insert into public.engineering_projects(
    contract_id,municipality,segment_type,project_category,project_name,project_type,created_by,updated_by)
  select g.contract_id,g.municipality,seg.segment_type,'GIS',
         left('Mancha '||g.gis_code||coalesce(' · '||nullif(btrim(g.neighborhood),''),''),200),
         null,admin_id,admin_id
  from public.gis_stains g
  cross join lateral (
    select 'SEWER'::public.target_segment_type as segment_type
    union all select 'WATER'::public.target_segment_type where g.classification='BOTH'
  ) seg
  left join public.gis_stain_project_links l
    on l.gis_stain_id=g.id and l.segment_type=seg.segment_type
  where g.contract_id=contract and l.gis_stain_id is null
  on conflict do nothing;
  get diagnostics new_projects=row_count;

  insert into public.gis_stain_project_links(gis_stain_id,segment_type,engineering_project_id)
  select g.id,seg.segment_type,p.id
  from public.gis_stains g
  cross join lateral (
    select 'SEWER'::public.target_segment_type as segment_type
    union all select 'WATER'::public.target_segment_type where g.classification='BOTH'
  ) seg
  join public.engineering_projects p
    on p.contract_id=g.contract_id and p.municipality=g.municipality
    and p.segment_type=seg.segment_type and p.project_category='GIS'
    and p.project_name=left('Mancha '||g.gis_code||coalesce(' · '||nullif(btrim(g.neighborhood),''),''),200)
  left join public.gis_stain_project_links l
    on l.gis_stain_id=g.id and l.segment_type=seg.segment_type
  where g.contract_id=contract and l.gis_stain_id is null
  on conflict do nothing;

  -- Migra exatamente a classificação que já estava visível em Manchas.
  -- Preserva o status técnico existente dos 13 projetos originais.
  insert into public.engineering_project_review_status(engineering_project_id,status,updated_by)
  select l.engineering_project_id,
         case when g.cancelled then 'CANCELLED'
              else coalesce(s.status,'UNCLASSIFIED') end,
         admin_id
  from public.gis_stain_project_links l
  join public.gis_stains g on g.id=l.gis_stain_id
  left join public.gis_stain_system_status s
    on s.gis_stain_id=g.id and s.segment_type=l.segment_type
  where g.contract_id=contract
    and not exists (select 1 from public.engineering_project_review_status r
                    where r.engineering_project_id=l.engineering_project_id)
  on conflict do nothing;

  select count(*) filter (where segment_type='WATER'),count(*) filter (where segment_type='SEWER'),count(*)
    into waters,sewers,linked
  from public.gis_stain_project_links l
  join public.gis_stains g on g.id=l.gis_stain_id where g.contract_id=contract;
  if waters<>38 or sewers<>84 or linked<>122 or new_projects<>109 then
    raise exception 'Importação incompleta: água %, esgoto %, links %, novos %',waters,sewers,linked,new_projects;
  end if;
  if (select count(*) from public.engineering_projects where contract_id=contract and active)<>122 then
    raise exception 'Total de projetos ativos incoerente com a base GIS';
  end if;
  if (select count(*) from public.engineering_project_review_status r
      join public.engineering_projects p on p.id=r.engineering_project_id
      where p.contract_id=contract and p.active)<>122 then
    raise exception 'Classificação de projetos não foi sincronizada';
  end if;
end $$;

-- Fonte única: o projeto correspondente AO SISTEMA selecionado.
-- A classificação de Esgoto não utiliza mais o projeto de Água associado à mesma mancha.
create or replace view public.gis_stain_system_effective with (security_invoker=true) as
select g.id,g.contract_id,g.gis_code,g.municipality,g.classification,
       g.settlement_type,g.neighborhood,g.source_sheet,g.economies_ica,g.economies_ice,g.economies_iec,
       g.cancelled,l.engineering_project_id,
       seg.segment_type,
       case when g.cancelled then 'CANCELLED'
            else coalesce(r.status,ss.status,'UNCLASSIFIED') end as effective_status,
       p.project_name as linked_project_name
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

-- Impede duplicidade de alteração (GIS vs Engenharia), inclusive Esgoto.
create or replace function private.validate_gis_stain_system_status() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
  g record;
begin
  select classification,cancelled into g from public.gis_stains where id=new.gis_stain_id;
  if not found or (new.segment_type='WATER' and g.classification<>'BOTH') then
    raise exception 'Sistema não pertence à mancha GIS' using errcode='23514';
  end if;
  if g.cancelled then
    raise exception 'Mancha GIS cancelada; classificação travada' using errcode='23514';
  end if;
  if exists (select 1 from public.gis_stain_project_links l
      where l.gis_stain_id=new.gis_stain_id and l.segment_type=new.segment_type) then
    raise exception 'Classificação desta mancha deve ser alterada no projeto da Engenharia'
      using errcode='23514';
  end if;
  new.updated_by=(select auth.uid());
  new.updated_at=clock_timestamp();
  return new;
end $$;
