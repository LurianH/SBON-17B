import {calculateAnnualEconomiesProjection,calculateAnnualTargetDeviation,calculateDashboardStatus,calculateDeviationOrigin,calculateMonthlyBillingYTD,calculateProjectionBaseAverage} from './calculations';
import {createClient} from './supabase/client';
import {isSupabaseConfigured} from './supabase/config';
import {summarizeAnnualTarget,type AnnualTargetDetail,type AnnualTargetSummary} from './target-calculations';
export interface DashboardData{source:'demo'|'supabase'|'empty';targetYear:number;contractValue:number|null;billingYtd:number|null;target:number|null;targetBreakdown:AnnualTargetSummary|null;annualProjection:number|null;latestDate:string|null;available:number|null;executed:number|null;networkApproved:number|null;networkExecuted:number|null;deviation:number|null;status:'DENTRO_DO_PLANO'|'ATENCAO'|'CRITICO'|null;origin:{engineeringPercent:number|null;executionPercent:number|null;engineering:number;execution:number}|null;openActions:number;weeklyExecuted:number[];contractId:string|null}
const currentYear=new Date().getFullYear();
const empty:DashboardData={source:'empty',targetYear:currentYear,contractValue:null,billingYtd:null,target:null,targetBreakdown:null,annualProjection:null,latestDate:null,available:null,executed:null,networkApproved:null,networkExecuted:null,deviation:null,status:null,origin:null,openActions:0,weeklyExecuted:[],contractId:null};
const demo:DashboardData={source:'demo',targetYear:2026,contractValue:78500000,billingYtd:42300000,target:15000,targetBreakdown:null,annualProjection:14400,latestDate:'2026-08-24',available:13480,executed:11920,networkApproved:186400,networkExecuted:154300,deviation:-4,status:'ATENCAO',origin:{engineeringPercent:42,executionPercent:58,engineering:640,execution:880},openActions:3,weeklyExecuted:[10820,11040,11200,11480,11610,11770,11920],contractId:'demo'};
function remainingMonths(date:Date){const days=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();return 11-date.getMonth()+(days-date.getDate())/days}
function elapsedYear(date:Date){const start=new Date(date.getFullYear(),0,1);const end=new Date(date.getFullYear()+1,0,1);return (date.getTime()-start.getTime())/(end.getTime()-start.getTime())}
export async function loadDashboardData():Promise<DashboardData>{
 if(!isSupabaseConfigured())return process.env.NODE_ENV==='development'?demo:empty;
 const db=createClient();if(!db)return empty;
 const {data:contract}=await db.from('contracts').select('id,contract_value').eq('code','SBON 17B').eq('active',true).maybeSingle();if(!contract)return empty;
 const year=new Date().getFullYear();
 const [{data:targetRow},{data:financials},{data:weekly},{count:openActions}]=await Promise.all([
  db.from('annual_targets').select('id,target_economies').eq('contract_id',contract.id).eq('year',year).maybeSingle(),
  db.from('monthly_financials').select('reference_year,amount').eq('contract_id',contract.id).eq('reference_year',year).eq('active',true),
  db.from('weekly_progress').select('reference_date,economies_available,economies_executed,network_approved_m,network_executed_m').eq('contract_id',contract.id).eq('active',true).order('reference_date',{ascending:true}),
  db.from('action_plans').select('id',{count:'exact',head:true}).eq('contract_id',contract.id).neq('status','concluido')
 ]);
 const {data:detailRows}=targetRow?.id
  ?await db.from('annual_target_details').select('municipality,segment_type,cut_name,target_economies').eq('annual_target_id',targetRow.id)
  :{data:null};
 const targetBreakdown=detailRows?.length?summarizeAnnualTarget(detailRows as AnnualTargetDetail[]):null;
 const rows=weekly??[],latest=rows.at(-1),target=targetBreakdown?.total??targetRow?.target_economies??null,firstMonth=rows[0]?.reference_date.slice(0,7),baseRows=firstMonth?rows.filter(r=>r.reference_date.startsWith(firstMonth)):[];
 const avgExecuted=calculateProjectionBaseAverage(baseRows.map(r=>r.economies_executed)),date=latest?new Date(latest.reference_date+'T12:00:00'):new Date(),quarterIncrement=avgExecuted===null?null:avgExecuted*4.345*3;
 const projection=latest&&quarterIncrement!==null?calculateAnnualEconomiesProjection(latest.economies_executed,quarterIncrement,remainingMonths(date)):null;
 const origin=target!==null&&latest?calculateDeviationOrigin(target,elapsedYear(date),latest.economies_available,latest.economies_executed):null;
 return {source:'supabase',targetYear:year,contractValue:contract.contract_value===null?null:Number(contract.contract_value),billingYtd:financials?.length?calculateMonthlyBillingYTD(financials.map(r=>({year:r.reference_year,amount:Number(r.amount)})),year):null,target,targetBreakdown,annualProjection:projection,latestDate:latest?.reference_date??null,available:latest?.economies_available??null,executed:latest?.economies_executed??null,networkApproved:latest?Number(latest.network_approved_m):null,networkExecuted:latest?Number(latest.network_executed_m):null,deviation:projection!==null&&target!==null?calculateAnnualTargetDeviation(projection,target):null,status:projection!==null&&target!==null?calculateDashboardStatus(projection,target):null,origin:origin?{engineeringPercent:origin.engineeringPercent,executionPercent:origin.executionPercent,engineering:origin.engineering,execution:origin.execution}:null,openActions:openActions??0,weeklyExecuted:rows.slice(-7).map(r=>r.economies_executed),contractId:contract.id};
}
