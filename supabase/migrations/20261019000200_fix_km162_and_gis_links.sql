-- Correções confirmadas no GIS e na Engenharia, mantendo IDs e históricos.
-- 553-AF-0005N = KM 162 (não KM 192).
-- 764-AF-113 = Estância; 764-AR-0001N = Cruz de Cedro.
do $$
declare
  contract uuid;
  km uuid;
  estancia uuid;
  cruz uuid;
  admin_id uuid;
  mismatched integer;
begin
  select id into strict contract from public.contracts where code='SBON 17B' and active=true;
  select id into strict km from public.engineering_projects
    where contract_id=contract and municipality='Porangaba' and project_name='KM 192' and active;
  select id into strict estancia from public.engineering_projects
    where contract_id=contract and municipality='Quadra' and project_name='Estância' and active;
  select id into strict cruz from public.engineering_projects
    where contract_id=contract and municipality='Quadra' and project_name='Cruz de Cedro' and active;

  -- Evitar sobrescrever vínculos se outro usuário alterou o cadastro.
  if (select engineering_project_id from public.gis_stains where contract_id=contract and gis_code='764-AR-0001N') is distinct from estancia
     or (select engineering_project_id from public.gis_stains where contract_id=contract and gis_code='764-AF-113') is not null
     or (select engineering_project_id from public.gis_stains where contract_id=contract and gis_code='553-AF-0005N') is not null then
    raise exception 'Os vínculos GIS foram alterados; reconciliação manual necessária antes de corrigir.';
  end if;
  select id into strict admin_id from public.profiles where role='ADMIN' and active=true order by id limit 1;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);

  update public.gis_stains set engineering_project_id=null
    where contract_id=contract and gis_code='764-AR-0001N';
  update public.gis_stains set engineering_project_id=estancia
    where contract_id=contract and gis_code='764-AF-113';
  update public.gis_stains set engineering_project_id=cruz
    where contract_id=contract and gis_code='764-AR-0001N';
  update public.gis_stains set engineering_project_id=km
    where contract_id=contract and gis_code='553-AF-0005N';

  -- Ajuste nominal de identificação (sem criar outro projeto).
  update public.engineering_projects set project_name='KM 162'
    where id=km and project_name='KM 192';
  if not found then raise exception 'Não foi possível corrigir KM 192 para KM 162'; end if;

  -- O cadastro legado de nomes de projetos também deve mostrar a correção.
  update public.contract_stains set stain_code='KM 162'
    where engineering_project_id=km and stain_code='KM 192';

  select count(*) into mismatched from (values
    ('553-AF-0005N',km),
    ('764-AF-113',estancia),
    ('764-AR-0001N',cruz)
  ) as expected(gis_code,project_id)
  left join public.gis_stains g on g.contract_id=contract and g.gis_code=expected.gis_code
  where g.engineering_project_id is distinct from expected.project_id;
  if mismatched<>0 then raise exception 'Vínculo GIS inconsistente após correção'; end if;
end $$;
