import {type SupabaseClient} from '@supabase/supabase-js';
import {currentProjects, type CurrentProject, type Project, type Update} from './engineering';

export type EngineeringBreakdown = {
  waterEconomies: number | null; sewerEconomies: number | null;
  waterNetwork: number | null; sewerNetwork: number | null;
};


/** Status distintos que permitem iniciar execução, conforme regra gerencial do contrato. */
export const RELEASED_REVIEW_STATUSES=['NO_OBJECTION','NO_OBJECTION_RESERVATIONS'] as const;
export type ReleasedMetric={value:number|null;missing:number};
export type ReleasedSegment={
 projects:number;economies:ReleasedMetric;network:ReleasedMetric;
};
export type EngineeringReleaseSummary={
 water:ReleasedSegment;sewer:ReleasedSegment;projects:number;
};
export type EngineeringReviewSnapshot={engineering_project_id:string;status:string};
export type NetworkReleaseRow={engineering_project_id:string;length_m:string|number;segment_status:string;active:boolean};

export function summarizeEngineeringRelease(projects:Project[],updates:Update[],reviews:EngineeringReviewSnapshot[],networkRows:NetworkReleaseRow[]=[]):EngineeringReleaseSummary{
 const eligibleIds=new Set(reviews.filter(row=>(RELEASED_REVIEW_STATUSES as readonly string[]).includes(row.status)).map(row=>row.engineering_project_id));
 const eligible=currentProjects(projects,updates).filter(project=>eligibleIds.has(project.id));
 const metric=(list:CurrentProject[],field:'approved_economies'|'approved_length_m'):ReleasedMetric=>{
  const scale=field==='approved_length_m'?1000:1;
  const known=list.map(project=>project.current?.[field]).filter(value=>value!==null&&value!==undefined);
  return {value:known.length?known.reduce<number>((sum,value)=>sum+Math.round(Number(value)*scale),0)/scale:null,
    missing:list.length-known.length};
 };
 const networkForProject=(project:CurrentProject):number|null=>{
   const rows=networkRows.filter(row=>row.engineering_project_id===project.id&&row.active);
   if(rows.length===0)return project.current?.approved_length_m==null?null:Number(project.current.approved_length_m);
   const accepted=rows.filter(row=>row.segment_status==='APPROVED'||row.segment_status==='EXECUTED');
   if(accepted.length===0)return null;
   return accepted.reduce((n,row)=>n+Math.round(Number(row.length_m)*1000),0)/1000;
 };
 const networkMetric=(list:CurrentProject[]):ReleasedMetric=>{
  const valid=list.map(networkForProject).filter((v):v is number=>v!==null);
  return {value:valid.length?valid.reduce((n,v)=>n+Math.round(v*1000),0)/1000:null,missing:list.length-valid.length};
 };
 const segment=(key:'WATER'|'SEWER'):ReleasedSegment=>{
  const list=eligible.filter(project=>project.segment_type===key);
  return {projects:list.length,economies:metric(list,'approved_economies'),network:networkMetric(list)};
 };
 return {water:segment('WATER'),sewer:segment('SEWER'),projects:eligible.length};
}
function complete(metric:ReleasedMetric):number|null{
 return metric.missing===0?metric.value:null;
}
function completeSum(a:ReleasedMetric,b:ReleasedMetric):number|null{
 if(a.missing>0||b.missing>0)return null;
 if(a.value===null&&b.value===null)return null;
 return (a.value??0)+(b.value??0);
}

export function summarizeDashboardEngineering(projects: Project[], updates: Update[]) {
  const current = currentProjects(projects, updates);
  // A missing value cannot be treated as zero or as a complete contract total.
  const total = (rows: CurrentProject[], field: 'approved_economies' | 'approved_length_m') => {
    if (!rows.length || rows.some(p => p.current?.[field] == null)) return null;
    const scale = field === 'approved_length_m' ? 1000 : 1;
    return rows.reduce((sum, p) => sum + Math.round(Number(p.current![field]) * scale), 0) / scale;
  };
  const water = current.filter(p => p.segment_type === 'WATER');
  const sewer = current.filter(p => p.segment_type === 'SEWER');
  const engineeringBreakdown: EngineeringBreakdown | null = current.length ? {
    waterEconomies: total(water, 'approved_economies'), sewerEconomies: total(sewer, 'approved_economies'),
    waterNetwork: total(water, 'approved_length_m'), sewerNetwork: total(sewer, 'approved_length_m'),
  } : null;
  return {engineeringBreakdown, available: total(current, 'approved_economies'),
    networkApproved: total(current, 'approved_length_m'),
    engineeringDate: current.reduce<string | null>((date, p) => p.current && (!date || p.current.reference_date > date) ? p.current.reference_date : date, null)};
}

export async function loadDashboardEngineering(db:SupabaseClient,contractId:string){
 const source=await db.from('engineering_source_snapshot')
   .select('segment_type,master_network_m,master_economies,network_document_status')
   .eq('contract_id',contractId).not('master_network_m','is',null);
 if(source.error||!source.data)return {engineeringBreakdown:null,available:null,networkApproved:null,engineeringDate:null,releaseSummary:null};
 const qualified=source.data.filter(r=>
   r.network_document_status==='NO_OBJECTION'||r.network_document_status==='UNDER_SABESP_REVIEW');
 const segment=(type:'WATER'|'SEWER'):ReleasedSegment=>{
   const rows=qualified.filter(r=>r.segment_type===type);
   const economies=rows.filter(r=>r.master_economies!=null);
   const lengths=rows.filter(r=>r.master_network_m!=null);
   return {
     projects:rows.length,
     economies:{value:economies.length?economies.reduce((sum,r)=>sum+Number(r.master_economies),0):null,missing:rows.length-economies.length},
     network:{value:lengths.length?lengths.reduce((sum,r)=>sum+Math.round(Number(r.master_network_m)*1000),0)/1000:null,missing:rows.length-lengths.length}
   };
 };
 const water=segment('WATER'),sewer=segment('SEWER');
 const releaseSummary:EngineeringReleaseSummary={water,sewer,projects:water.projects+sewer.projects};
 return {
   releaseSummary,
   engineeringBreakdown:{
     waterEconomies:complete(water.economies),sewerEconomies:complete(sewer.economies),
     waterNetwork:complete(water.network),sewerNetwork:complete(sewer.network)
   },
   available:completeSum(water.economies,sewer.economies),
   networkApproved:completeSum(water.network,sewer.network),
   engineeringDate:'2026-11-27'
 };
}
