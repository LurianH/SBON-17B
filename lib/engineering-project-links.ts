import {attackPlan2026, type AttackPlanRow} from './attack-plan-2026';

export type EngineeringProjectIdentity = {id:string;contract_id:string;municipality:string;segment_type:'WATER'|'SEWER';project_name:string;active:boolean};
export type ProjectLinkResolution = {rowKey:string; stainId:string; front:string; municipality:string; segment:'WATER'|'SEWER'; projectId:string|null; status:'MATCHED'|'MISSING'|'AMBIGUOUS'; candidateIds:string[]; reason:string};

const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
// Aliases should only be used for known display-name differences, never numeric guesswork.
const aliases:Record<string,string[]>={
 'attack-2026-04':['booster sao joao','sao joao'],
 'attack-2026-09':['booster alto da serra','alto da serra'],
 'attack-2026-10':['booster vidas novas','vidas novas'],
 'attack-2026-13':['estrada ch 12 5'],
 'attack-2026-14':['aflitos'],
};
export function resolveEngineeringProjectLinks(projects:readonly EngineeringProjectIdentity[],contractId:string,plan:readonly AttackPlanRow[]=attackPlan2026):ProjectLinkResolution[]{
 return plan.map(row=>{
  const names=[row.front,...(aliases[row.rowKey]??[])].map(normalize);
  const candidates=projects.filter(p=>p.active&&p.contract_id===contractId&&p.municipality===row.municipality&&p.segment_type===row.segment&&names.includes(normalize(p.project_name)));
  // A repeated stain code is NOT a valid unique key. Only a precise front match may resolve it.
  const status:ProjectLinkResolution['status']=candidates.length===1?'MATCHED':candidates.length===0?'MISSING':'AMBIGUOUS';
  return {rowKey:row.rowKey,stainId:row.stainId,front:row.front,municipality:row.municipality,segment:row.segment,projectId:status==='MATCHED'?candidates[0].id:null,status,candidateIds:candidates.map(p=>p.id),reason:status==='MATCHED'?'Identificação por frente, município e sistema':status==='MISSING'?'Projeto correspondente não encontrado; revisão manual necessária':'Múltiplos projetos correspondentes; vínculo bloqueado'};
 });
}
export function linkSummary(rows:readonly ProjectLinkResolution[]){return {matched:rows.filter(r=>r.status==='MATCHED').length,missing:rows.filter(r=>r.status==='MISSING').length,ambiguous:rows.filter(r=>r.status==='AMBIGUOUS').length};}
