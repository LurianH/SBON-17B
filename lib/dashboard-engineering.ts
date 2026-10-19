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

export function summarizeEngineeringRelease(projects:Project[],updates:Update[],reviews:EngineeringReviewSnapshot[]):EngineeringReleaseSummary{
 const eligibleIds=new Set(reviews.filter(row=>(RELEASED_REVIEW_STATUSES as readonly string[]).includes(row.status)).map(row=>row.engineering_project_id));
 const eligible=currentProjects(projects,updates).filter(project=>eligibleIds.has(project.id));
 const metric=(list:CurrentProject[],field:'approved_economies'|'approved_length_m'):ReleasedMetric=>{
  const scale=field==='approved_length_m'?1000:1;
  const known=list.map(project=>project.current?.[field]).filter(value=>value!==null&&value!==undefined);
  return {value:known.length?known.reduce<number>((sum,value)=>sum+Math.round(Number(value)*scale),0)/scale:null,
    missing:list.length-known.length};
 };
 const segment=(key:'WATER'|'SEWER'):ReleasedSegment=>{
  const list=eligible.filter(project=>project.segment_type===key);
  return {projects:list.length,economies:metric(list,'approved_economies'),network:metric(list,'approved_length_m')};
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

export async function loadDashboardEngineering(db: SupabaseClient, contractId: string) {
  const projects: Project[] = [], updates: Update[] = [];
  // Paginate both sources so PostgREST's row cap cannot silently truncate totals.
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('engineering_projects').select('*').eq('contract_id', contractId)
      .eq('active', true).order('id').range(offset, offset + 499);
    if (result.error) return summarizeDashboardEngineering([], []);
    projects.push(...result.data as Project[]);
    if (result.data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('engineering_current_updates').select('*').eq('contract_id', contractId)
      .eq('active', true).order('engineering_project_id').range(offset, offset + 499);
    if (result.error) return summarizeDashboardEngineering([], []);
    updates.push(...result.data as Update[]);
    if (result.data.length < 500) break;
  }
  const base=summarizeDashboardEngineering(projects,updates);
  const reviews=await db.from('engineering_project_review_status')
    .select('engineering_project_id,status')
    .in('engineering_project_id',projects.map(p=>p.id));
  if(reviews.error||!reviews.data){
   return {...base,releaseSummary:null};
  }
  const release=summarizeEngineeringRelease(projects,updates,reviews.data as EngineeringReviewSnapshot[]);
  // Indicadores gerenciais: somente projetos liberados, nunca o conjunto total
  // de projetos GIS sem dados técnicos. Resultados incompletos não viram metas.
  return {
   ...base,
   releaseSummary:release,
   engineeringBreakdown:{
    waterEconomies:complete(release.water.economies),
    sewerEconomies:complete(release.sewer.economies),
    waterNetwork:complete(release.water.network),
    sewerNetwork:complete(release.sewer.network)
   },
   available:completeSum(release.water.economies,release.sewer.economies),
   networkApproved:completeSum(release.water.network,release.sewer.network)
  };
}
