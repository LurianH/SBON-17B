import {type Project,type Update} from '@/lib/engineering';
import type {ProjectNetworkRow} from '@/lib/engineering-unified-model';

export type SourceQuantity={
  segment_type:string;gis_code:string;monday_network_m:number|string|null;
  fallback_network_m?:number|string|null;monday_economies:number|null;
  monday_project_status?:string|null;source_version?:string|null;municipality?:string;
  master_network_m?:number|string|null;master_economies?:number|null;
};

// GIS codes used to reconcile modern source records with legacy projects.
// Only the four explicitly confirmed projects are overridden.
const legacyIdForCode:Record<string,string>={
  'WATER:271_AR_0001N':'7ffbb432-c2f2-4847-a134-9989e0ea658e',
  'WATER:553_AF_88':'c0bb744e-0794-407e-873f-d8bd596462e4',
  'WATER:553_AF_0001N':'a8505fb0-8fb3-47d8-bd00-588ed1f84d12',
  'WATER:764_AF_113':'7e622c51-257c-41c4-b355-f3716e526ace'
};
export function reconcileProjectQuantities(projects:Project[],updates:Update[],segments:ProjectNetworkRow[],sources:SourceQuantity[],gisRows:{gis_code:string;segment_type:string;municipality:string;engineering_project_id:string|null}[]=[]){
 const projectIds=new Set(projects.map(p=>p.id));
 const linkedIds=new Map(gisRows.filter(g=>g.engineering_project_id).map(g=>[g.segment_type+':'+g.gis_code.replaceAll('-','_').toUpperCase()+':'+g.municipality,g.engineering_project_id!]));
 const resolvedId=(r:SourceQuantity)=>legacyIdForCode[r.segment_type+':'+r.gis_code]??linkedIds.get(r.segment_type+':'+r.gis_code.replaceAll('-','_').toUpperCase()+':'+(r as SourceQuantity&{municipality?:string}).municipality);
 const effectiveUpdates=updates.map(x=>({...x}));
 const effectiveSegments=segments.filter(x=>x.active).map(x=>({...x}));
 for(const source of sources){
   const pid=resolvedId(source);
   if(!pid||!projectIds.has(pid))continue;
   for(let i=effectiveSegments.length-1;i>=0;i--)if(effectiveSegments[i].engineering_project_id===pid)effectiveSegments.splice(i,1);
   if(source.master_network_m==null)continue;
   const meters=source.master_network_m;
   const updatedOn=(source.source_version??'').length===10?String(source.source_version):'2026-11-23';
   if(meters==null)continue;
   const previous=effectiveUpdates.filter(u=>u.engineering_project_id===pid)
     .sort((a,b)=>b.reference_date.localeCompare(a.reference_date)||b.created_at.localeCompare(a.created_at))[0];
   const revised:Update={
     ...(previous??{
       id:'source-'+source.gis_code,engineering_project_id:pid,reference_date:updatedOn,
       concept_status:null,concept_approved_at:null,executive_status:null,executive_completed_at:null,
       delivery_status:null,approved_economies:null,approved_length_m:null,
       pead_de63_length_m:null,pead_de110_length_m:null,notes:null,created_by:'',created_at:updatedOn+'T12:00:00Z'
     }),
     id:'current-source-'+source.gis_code,reference_date:updatedOn,
     created_at:updatedOn+'T12:00:00Z',
     approved_length_m:Number(meters),approved_economies:source.master_economies??null,
     // Diameter breakdown from the older project is not validated for the new alignment.
     pead_de63_length_m:null,pead_de110_length_m:null,
     delivery_status:source.monday_project_status?.toLocaleLowerCase('pt-BR')==='em andamento'?'IN_PROGRESS':previous?.delivery_status??null,
     notes:'Quantitativo de projeto conforme Lista Mestra vigente em '+updatedOn.split('-').reverse().join('/')+'. Composição por diâmetro a conferir.'
   };
   effectiveUpdates.push(revised);
   // A metragem consolidada vem da fonte atual; não criar trechos artificiais editáveis.
   // Uma distribuição por diâmetro só pode ser exibida após confirmação técnica.
 }
 return {updates:effectiveUpdates,segments:effectiveSegments};
}
