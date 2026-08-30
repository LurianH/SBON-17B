import {createClient} from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Configuração pública do Supabase ausente.');
const roles=['ADMIN','EDITOR','GESTOR','DIRETORIA'];
const sessions={};
function assert(condition,message){if(!condition)throw new Error(message)}
function result(response){if(response.error)throw response.error;return response.data}
function summarize(rows){return rows.reduce((sum,row)=>{const amount=Number(row.target_economies);sum[row.segment_type==='WATER'?'water':'sewer']+=amount;sum.total+=amount;return sum},{water:0,sewer:0,total:0})}

for(const role of roles){
  const email=process.env[`SBON_TEST_${role}_EMAIL`];
  const password=process.env[`SBON_TEST_${role}_PASSWORD`];
  if(!email||!password)throw new Error(`Credenciais locais ausentes para ${role}.`);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.auth.signInWithPassword({email,password});
  if(error)throw new Error(`${role}: autenticação falhou.`);
  const profile=result(await db.from('profiles').select('role,active').eq('id',data.user.id).single());
  assert(profile.role===role&&profile.active===true,`${role}: profile inesperado.`);
  sessions[role]={db,user:data.user};
}

const contract=result(await sessions.ADMIN.db.from('contracts').select('id,contract_value').eq('code','SBON 17B').single());
assert(Number(contract.contract_value)===255497807.17,'Valor contratual divergente.');
const targets=result(await sessions.ADMIN.db.from('annual_targets').select('id,year,cycle_number,milestone_date,target_economies').eq('contract_id',contract.id).order('year'));
assert(targets.length===3&&targets.every(row=>row.target_economies===null),'Cabeçalhos anuais divergentes.');
const expected={2026:{water:352,sewer:1357,total:1709},2027:{water:3565,sewer:4559,total:8124},2028:{water:1116,sewer:3472,total:4588}};
const all=[];
let protectedDetail;
for(const target of targets){
  const rows=result(await sessions.ADMIN.db.from('annual_target_details').select('id,municipality,segment_type,cut_name,target_economies').eq('annual_target_id',target.id));
  assert(rows.length===10&&rows.every(row=>row.cut_name===null),`${target.year}: detalhes divergentes.`);
  assert(JSON.stringify(summarize(rows))===JSON.stringify(expected[target.year]),`${target.year}: totais divergentes.`);
  protectedDetail??=rows[0];all.push(...rows);
}
assert(JSON.stringify(summarize(all))===JSON.stringify({water:5033,sewer:9388,total:14421}),'Total contratual divergente.');

for(const role of ['EDITOR','GESTOR','DIRETORIA']){
  const visible=result(await sessions[role].db.from('annual_target_details').select('id').eq('id',protectedDetail.id));
  assert(visible.length===1,`${role}: leitura das metas negada.`);
  const {data,error}=await sessions[role].db.from('annual_target_details').update({target_economies:999999}).eq('id',protectedDetail.id).select('id');
  assert(Boolean(error)||!data?.length,`${role}: alteração de meta permitida indevidamente.`);
}
const unchanged=result(await sessions.ADMIN.db.from('annual_target_details').select('target_economies').eq('id',protectedDetail.id).single());
assert(Number(unchanged.target_economies)===Number(protectedDetail.target_economies),'Tentativa negada alterou a meta oficial.');

const audit=result(await sessions.ADMIN.db.from('audit_logs').select('entity,action,user_id').in('entity',['contracts','annual_targets','annual_target_details']).order('id',{ascending:false}).limit(100));
for(const entity of ['contracts','annual_targets','annual_target_details'])assert(audit.some(row=>row.entity===entity),`Auditoria ausente para ${entity}.`);
const counts={};
for(const table of ['monthly_financials','weekly_progress']){
  const {count,error}=await sessions.ADMIN.db.from(table).select('id',{count:'exact',head:true}).eq('contract_id',contract.id);
  if(error)throw error;counts[table]=count??0;
}
assert(counts.monthly_financials===0,'monthly_financials recebeu rateio não autorizado.');
assert(counts.weekly_progress===1,'Quantidade de snapshots semanais oficiais divergente.');

console.log(JSON.stringify({contractValue:Number(contract.contract_value),cycles:targets.map(row=>({year:row.year,cycle:row.cycle_number,milestone:row.milestone_date})),annual:expected,contract:summarize(all),details:all.length,rls:{ADMIN:'write confirmed by official load',EDITOR:'read only',GESTOR:'read only',DIRETORIA:'read only'},audit:'ok',operationalCounts:counts},null,2));
