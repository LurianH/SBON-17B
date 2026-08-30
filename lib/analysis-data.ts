import {calculateProjectionBaseAverage,calculateQuarterProjection} from './calculations';
import {createClient} from './supabase/client';import {isSupabaseConfigured} from './supabase/config';
export interface AnalysisData{source:'demo'|'supabase'|'empty';headers:string[];rows:string[][]}
const demo={source:'demo' as const,headers:['Indicador','Agosto · Real','Setembro · Proj.','Outubro · Proj.'],rows:[['Economias disponíveis','13.480','14.610','15.730'],['Economias executadas','11.920','13.136','14.352'],['Rede aprovada','186.400 m','194.220 m','202.040 m'],['Rede executada','154.300 m','162.990 m','171.680 m']]};
const fmt=(v:number,suffix='')=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v)+suffix;
export async function loadAnalysisData():Promise<AnalysisData>{
 if(!isSupabaseConfigured())return process.env.NODE_ENV==='development'?demo:{source:'empty',headers:demo.headers,rows:[]};
 const db=createClient();if(!db)return {source:'empty',headers:demo.headers,rows:[]};
 const {data:contract}=await db.from('contracts').select('id').eq('code','SBON 17B').eq('active',true).maybeSingle();if(!contract)return {source:'empty',headers:demo.headers,rows:[]};
 const {data}=await db.from('weekly_progress').select('reference_date,economies_available,economies_executed,network_approved_m,network_executed_m').eq('contract_id',contract.id).eq('active',true).order('reference_date');
 const all=data??[],month=all[0]?.reference_date.slice(0,7),base=month?all.filter(r=>r.reference_date.startsWith(month)):[],latest=base.at(-1);if(!latest)return {source:'empty',headers:demo.headers,rows:[]};
 const start=new Date(latest.reference_date+'T12:00:00'),months=[start,new Date(start.getFullYear(),start.getMonth()+1,1),new Date(start.getFullYear(),start.getMonth()+2,1)],names=months.map((d,i)=>new Intl.DateTimeFormat('pt-BR',{month:'long'}).format(d)+(i?' · Proj.':' · Real'));
 const specs=[['Economias disponíveis','economies_available',''],['Economias executadas','economies_executed',''],['Rede aprovada','network_approved_m',' m'],['Rede executada','network_executed_m',' m']] as const;
 const rows=specs.map(([label,key,suffix])=>{const current=Number(latest[key]),avg=calculateProjectionBaseAverage(base.map(r=>Number(r[key]))),future=avg===null?null:calculateQuarterProjection(current,avg,[4.345,4.345]);return [label,fmt(current,suffix),future?fmt(future[0].accumulated,suffix):'Em formação',future?fmt(future[1].accumulated,suffix):'Em formação']});
 return {source:'supabase',headers:['Indicador',...names],rows};
}
