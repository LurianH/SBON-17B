-- Importação original: Base Ondas PPM - ERN 151026.xlsx, Lote 17b.
-- 74 manchas originais (Planilha1), 10 novas (Planilha2), classificação confirmada BOTH.
-- Valores ICA/ICE/IEC nulos permanecem desconhecidos; não são inventados.
with input(gis_code,municipality,classification,settlement_type,neighborhood,economies_ica,economies_ice,economies_iec,source_sheet) as (
 values
 ('271-AF-102','Conchas','BOTH','Formal',NULL,38,38,38,'Planilha1'),
('271-AF-122','Conchas','SEWER','Formal','Bairro Vila Pastina',NULL,36,36,'Planilha1'),
('271-AF-129','Conchas','BOTH','Formal',NULL,10,10,10,'Planilha1'),
('271-AF-201','Conchas','BOTH','Formal','Bairro Santo Antonio',70,70,70,'Planilha1'),
('271-AF-254','Conchas','SEWER','Formal','Bairro Santana',NULL,224,224,'Planilha1'),
('271-AF-257','Conchas','SEWER','Formal','Bairro Santana',NULL,8,8,'Planilha1'),
('271-AF-2828','Conchas','SEWER','Formal','Bairro Paraíso das Conchas',NULL,354,354,'Planilha1'),
('271-AF-2832','Conchas','SEWER','Formal','Bairro Próx. Marechal Rondon e Lopes',NULL,30,30,'Planilha1'),
('271-AF-2833','Conchas','BOTH','Formal','Bairro Recreio Vitória',234,234,234,'Planilha1'),
('271-AF-2842','Conchas','BOTH','Formal','Bairro Loteamento Tabarana',250,250,250,'Planilha1'),
('271-AF-2843','Conchas','SEWER','Formal',NULL,NULL,402,402,'Planilha1'),
('271-AR-0001N','Conchas','BOTH','Rural','Aflitos',NULL,NULL,NULL,'Planilha2'),
('271-AR-0002N','Conchas','BOTH','Rural','Estrada CH 12,5',NULL,NULL,NULL,'Planilha2'),
('271-AR-2747','Conchas','SEWER','Rural','Bairro Próx. Marechal Rondon e Lopes',NULL,6,6,'Planilha1'),
('523-AF-158','Pereiras','SEWER','Formal','Rio da Varzea',NULL,148,148,'Planilha1'),
('523-AR-0001N','Pereiras','BOTH','Rural','Bela Vista',NULL,NULL,NULL,'Planilha2'),
('523-AR-309','Pereiras','SEWER','Rural','Adélio Ferreira',NULL,56,56,'Planilha1'),
('553-AF-0001N','Porangaba','BOTH','Formal','Nucleo Santino',NULL,NULL,NULL,'Planilha2'),
('553-AF-0003N','Porangaba','BOTH','Formal','Estrada Porangaba/Pereiras',NULL,NULL,NULL,'Planilha2'),
('553-AF-0004N','Porangaba','BOTH','Formal','Polis',NULL,NULL,NULL,'Planilha2'),
('553-AF-0005N','Porangaba','BOTH','Formal','KM 162',NULL,NULL,NULL,'Planilha2'),
('553-AF-0006N','Porangaba','BOTH','Formal','Lopes',NULL,NULL,NULL,'Planilha2'),
('553-AF-1089','Porangaba','BOTH','Formal','Ninho Verde',308,308,308,'Planilha1'),
('553-AF-132','Porangaba','SEWER','Formal','Recanto dos Bosques',NULL,72,72,'Planilha1'),
('553-AF-162','Porangaba','SEWER','Formal','Ribeiras',NULL,10,10,'Planilha1'),
('553-AF-164','Porangaba','SEWER','Formal','Estrada Rachel Miranda',NULL,70,70,'Planilha1'),
('553-AF-185','Porangaba','SEWER','Formal','Ribeiras',NULL,64,64,'Planilha1'),
('553-AF-2','Porangaba','BOTH','Formal','Bairro Vicente (Loteamento)',6,NULL,NULL,'Planilha1'),
('553-AF-285','Porangaba','SEWER','Formal','Estância Irene',NULL,322,322,'Planilha1'),
('553-AF-292','Porangaba','BOTH','Formal','São João',88,88,88,'Planilha1'),
('553-AF-299','Porangaba','BOTH','Formal',NULL,762,762,762,'Planilha1'),
('553-AF-303','Porangaba','BOTH','Formal','Garças',54,54,54,'Planilha1'),
('553-AF-308','Porangaba','BOTH','Formal','Galerias',286,286,286,'Planilha1'),
('553-AF-311','Porangaba','BOTH','Formal','Recanto da Castelo',390,390,390,'Planilha1'),
('553-AF-315','Porangaba','SEWER','Formal','Ribeiras',NULL,26,26,'Planilha1'),
('553-AF-64','Porangaba','SEWER','Formal',NULL,NULL,768,768,'Planilha1'),
('553-AF-82','Porangaba','SEWER','Formal','Primavera',NULL,148,148,'Planilha1'),
('553-AF-88','Porangaba','BOTH','Formal','Loteamento Vidas Novas',242,242,242,'Planilha1'),
('553-AF-91','Porangaba','SEWER','Formal','Ypê II',NULL,110,110,'Planilha1'),
('553-AF-92','Porangaba','SEWER','Formal','Ypê I',NULL,244,244,'Planilha1'),
('553-AR-0002N','Porangaba','BOTH','Rural','Alto da Serra',NULL,NULL,NULL,'Planilha2'),
('553-AR-1850','Porangaba','SEWER','Rural',NULL,NULL,68,68,'Planilha1'),
('553-AR-340','Porangaba','SEWER','Rural',NULL,NULL,54,54,'Planilha1'),
('553-AR-341','Porangaba','SEWER','Rural','Bairro das Partes',NULL,46,46,'Planilha1'),
('764-AF-109','Quadra','SEWER','Formal','Bairro São Bento',NULL,8,8,'Planilha1'),
('764-AF-111','Quadra','SEWER','Formal','Bairro São Bento',NULL,110,110,'Planilha1'),
('764-AF-113','Quadra','BOTH','Formal','Bairro São Bento',80,80,80,'Planilha1'),
('764-AF-2785','Quadra','BOTH','Formal',NULL,1446,1446,1446,'Planilha1'),
('764-AF-93','Quadra','SEWER','Formal','Bairro Centro',NULL,16,16,'Planilha1'),
('764-AF-97','Quadra','SEWER','Formal','Bairro do Vaz e Centro',NULL,38,38,'Planilha1'),
('764-AF-98','Quadra','SEWER','Formal','Bairro Centro',NULL,18,18,'Planilha1'),
('764-AR-0001N','Quadra','BOTH','Rural','Estancia',NULL,NULL,NULL,'Planilha2'),
('687-AF-1','Tatuí','BOTH','Formal','Chacaras Rio Sorocaba',34,34,34,'Planilha1'),
('687-AF-128','Tatuí','BOTH','Formal','Americana',148,148,148,'Planilha1'),
('687-AF-13','Tatuí','BOTH','Formal',NULL,64,64,64,'Planilha1'),
('687-AF-150','Tatuí','BOTH','Formal','Americana',20,20,20,'Planilha1'),
('687-AF-198','Tatuí','SEWER','Formal','Mirandas',NULL,6,6,'Planilha1'),
('687-AF-2','Tatuí','BOTH','Formal','Chacaras Rio Sorocaba',70,70,70,'Planilha1'),
('687-AF-2045','Tatuí','SEWER','Formal','Santuário',NULL,1202,1202,'Planilha1'),
('687-AF-2046','Tatuí','SEWER','Formal','Santuário',NULL,528,528,'Planilha1'),
('687-AF-2047','Tatuí','SEWER','Formal','Santuário',NULL,866,866,'Planilha1'),
('687-AF-2048','Tatuí','SEWER','Formal','Santuário',NULL,70,70,'Planilha1'),
('687-AF-2049','Tatuí','SEWER','Formal','Santuário',NULL,48,48,'Planilha1'),
('687-AF-207','Tatuí','BOTH','Formal','Mirandas',8,8,8,'Planilha1'),
('687-AF-288','Tatuí','SEWER','Formal','Vale dos Lagos',NULL,34,34,'Planilha1'),
('687-AF-330','Tatuí','BOTH','Formal','Enxovia',106,106,106,'Planilha1'),
('687-AF-340','Tatuí','SEWER','Formal','Enxovia',NULL,308,308,'Planilha1'),
('687-AF-343','Tatuí','SEWER','Formal','Mirandas',NULL,988,988,'Planilha1'),
('687-AF-347','Tatuí','SEWER','Formal','Mirandas',NULL,2,2,'Planilha1'),
('687-AF-35','Tatuí','SEWER','Formal',NULL,NULL,202,202,'Planilha1'),
('687-AF-356','Tatuí','BOTH','Formal','Tanquinho',24,24,24,'Planilha1'),
('687-AF-357','Tatuí','SEWER','Formal','Enxovia',NULL,214,214,'Planilha1'),
('687-AF-358','Tatuí','SEWER','Formal','Mirandas',NULL,38,38,'Planilha1'),
('687-AF-390','Tatuí','BOTH','Formal','Mirandas',14,14,14,'Planilha1'),
('687-AF-403','Tatuí','SEWER','Formal',NULL,NULL,856,856,'Planilha1'),
('687-AF-415','Tatuí','SEWER','Formal','Congonhal',NULL,104,104,'Planilha1'),
('687-AF-421','Tatuí','SEWER','Formal','Congonhal',NULL,116,116,'Planilha1'),
('687-AF-424','Tatuí','SEWER','Formal','Congonhal',NULL,10,10,'Planilha1'),
('687-AF-47','Tatuí','BOTH','Formal','Caguaçu',88,88,88,'Planilha1'),
('687-AF-50','Tatuí','BOTH','Formal','Caguaçu',8,8,8,'Planilha1'),
('687-AF-52','Tatuí','BOTH','Formal','Caguaçu',8,8,8,'Planilha1'),
('687-AF-66','Tatuí','BOTH','Formal',NULL,238,238,238,'Planilha1'),
('687-AF-73','Tatuí','SEWER','Formal','Americana',NULL,884,884,'Planilha1'),
('687-AR-344','Tatuí','SEWER','Rural','Enxovia',NULL,54,54,'Planilha1')
), identified(gis_code,project_name) as (values ('271-AR-0001N','Aflitos'),('271-AR-0002N','Estrada CH 12,5'),('553-AR-0002N','Booster Alto da Serra'),('553-AF-292','Booster São João'),('553-AF-88','Booster Vidas Novas'),('553-AF-0006N','Dos Lopes'),('553-AF-303','Garças'),('553-AF-2','Vicente'),('764-AR-0001N','Estância'),('687-AF-207','Mirandas (687_AF_207)'),('687-AF-390','Mirandas (687_AF_390)'))
insert into public.gis_stains
 (contract_id,gis_code,municipality,classification,settlement_type,neighborhood,
  economies_ica,economies_ice,economies_iec,source_sheet,cancelled,engineering_project_id)
select c.id,i.gis_code,i.municipality,i.classification,i.settlement_type,i.neighborhood,
       i.economies_ica::integer,i.economies_ice::integer,i.economies_iec::integer,i.source_sheet,
       i.gis_code in ('553-AF-299','764-AF-2785'),
       p.id
from input i cross join lateral
 (select id from public.contracts where code='SBON 17B' and active=true limit 1) c
left join identified k on k.gis_code=i.gis_code
left join public.engineering_projects p on p.contract_id=c.id and p.municipality=i.municipality
 and p.project_name=k.project_name and p.active=true
on conflict(contract_id,gis_code) do nothing;

do $$
declare ct uuid; n integer; both_count integer; link_count integer; new_count integer; cancelled_count integer;
begin
  select id into ct from public.contracts where code='SBON 17B' and active=true limit 1;
  select count(*),count(*) filter(where classification='BOTH'),
         count(*) filter(where engineering_project_id is not null),
         count(*) filter(where source_sheet='Planilha2'),
         count(*) filter(where cancelled)
  into n,both_count,link_count,new_count,cancelled_count
  from public.gis_stains where contract_id=ct;
  if n<>84 or both_count<>38 or link_count<>11 or new_count<>10 or cancelled_count<>2 then
     raise exception 'GIS verification failed: total %, both %, linked %, new %, cancelled %',
        n,both_count,link_count,new_count,cancelled_count;
  end if;
end $$;

-- Os totais de manchas refletem a fonte GIS; não alterar metas de economias anuais.
update public.contract_stain_targets
 set total_count=case when segment_type='WATER' then 38 else 84 end
where contract_id in(select id from public.contracts where code='SBON 17B' and active=true)
  and segment_type in ('WATER','SEWER');
