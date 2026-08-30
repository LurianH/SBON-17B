export type TargetSegmentType='WATER'|'SEWER';

export interface AnnualTargetDetail{
  municipality:string;
  segment_type:TargetSegmentType;
  cut_name:string|null;
  target_economies:number;
}

export interface MunicipalityTargetSummary{
  municipality:string;
  water:number;
  sewer:number;
  total:number;
}

export interface AnnualTargetSummary{
  water:number;
  sewer:number;
  total:number;
  municipalities:MunicipalityTargetSummary[];
}

export function summarizeAnnualTarget(details:AnnualTargetDetail[]):AnnualTargetSummary{
  const municipalities=new Map<string,MunicipalityTargetSummary>();
  let water=0,sewer=0;
  for(const detail of details){
    const amount=Number(detail.target_economies);
    if(!Number.isFinite(amount)||amount<0)continue;
    const current=municipalities.get(detail.municipality)??{municipality:detail.municipality,water:0,sewer:0,total:0};
    if(detail.segment_type==='WATER'){water+=amount;current.water+=amount}else{sewer+=amount;current.sewer+=amount}
    current.total+=amount;
    municipalities.set(detail.municipality,current);
  }
  return {water,sewer,total:water+sewer,municipalities:[...municipalities.values()].sort((a,b)=>a.municipality.localeCompare(b.municipality,'pt-BR'))};
}
