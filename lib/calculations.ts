export interface WeeklyProgress { referenceDate:string; economiesAvailable:number; economiesExecuted:number; networkApprovedM:number; networkExecutedM:number }
export type ProgressDelta=Omit<WeeklyProgress,'referenceDate'>;
export function calculateWeeklyDelta(current:WeeklyProgress,previous?:WeeklyProgress):ProgressDelta|null{
  if(!previous)return null;
  return {economiesAvailable:current.economiesAvailable-previous.economiesAvailable,economiesExecuted:current.economiesExecuted-previous.economiesExecuted,networkApprovedM:current.networkApprovedM-previous.networkApprovedM,networkExecutedM:current.networkExecutedM-previous.networkExecutedM};
}
export function calculateMonthlyBillingYTD(rows:{year:number;amount:number}[],year:number){return rows.filter(r=>r.year===year).reduce((sum,r)=>sum+r.amount,0)}
export function calculateProjectionBaseAverage(values:number[],minimumDeltas=2):number|null{
  if(values.length<minimumDeltas+1)return null;
  const deltas=values.slice(1).map((v,i)=>v-values[i]).filter(v=>v>=0);
  return deltas.length>=minimumDeltas?deltas.reduce((a,b)=>a+b,0)/deltas.length:null;
}
export function calculateQuarterProjection(current:number,weeklyAverage:number,weeksByMonth:number[]=[4.345,4.345,4.345]){
  let accumulated=current; return weeksByMonth.map(weeks=>{const increment=weeklyAverage*weeks;accumulated+=increment;return {increment:Math.round(increment),accumulated:Math.round(accumulated)}})
}
export function calculateAnnualEconomiesProjection(current:number,quarterIncrement:number,monthsRemaining:number){return Math.round(current+(quarterIncrement/3)*Math.max(0,monthsRemaining))}
export function calculateAnnualTargetDeviation(projection:number,target:number){return target<=0?null:(projection/target-1)*100}
export function calculateDeviationOrigin(target:number,elapsedRatio:number,available:number,executed:number){
  const expected=target*Math.min(1,Math.max(0,elapsedRatio));
  const engineering=Math.max(0,expected-available);
  const execution=Math.max(0,Math.min(expected,available)-executed);
  const total=engineering+execution;
  return total===0?{expected,engineering,execution,total,engineeringPercent:null,executionPercent:null}:{expected,engineering,execution,total,engineeringPercent:engineering/total*100,executionPercent:execution/total*100};
}
export function calculateDashboardStatus(projection:number,target:number,attentionThreshold=.9){const ratio=target>0?projection/target:0;return ratio>=1?'DENTRO_DO_PLANO':ratio>=attentionThreshold?'ATENCAO':'CRITICO'}
