import {createClient} from '@supabase/supabase-js';

const apply=process.argv.includes('--apply');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email=process.env.SBON_TEST_ADMIN_EMAIL;
const password=process.env.SBON_TEST_ADMIN_PASSWORD;
if(!url||!key||!email||!password)throw new Error('Variáveis locais obrigatórias ausentes.');

const official={
  2026:{cycle:1,milestone:'2026-12-31',rows:[['Conchas',38,125],['Pereiras',0,15],['Porangaba',176,391],['Quadra',67,90],['Tatuí',71,736]]},
  2027:{cycle:2,milestone:'2027-12-31',rows:[['Conchas',577,546],['Pereiras',186,68],['Porangaba',1375,1232],['Quadra',403,344],['Tatuí',1024,2369]]},
  2028:{cycle:3,milestone:'2028-12-31',rows:[['Conchas',233,447],['Pereiras',227,285],['Porangaba',331,1067],['Quadra',312,289],['Tatuí',13,1384]]},
};
const expected={2026:{water:352,sewer:1357,total:1709},2027:{water:3565,sewer:4559,total:8124},2028:{water:1116,sewer:3472,total:4588},contract:{water:5033,sewer:9388,total:14421}};
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:auth,error:authError}=await db.auth.signInWithPassword({email,password});
if(authError)throw new Error(`Autenticação administrativa falhou: ${authError.message}`);

function assert(condition,message){if(!condition)throw new Error(message)}
function result(response){if(response.error)throw response.error;return response.data}
function keyOf(row){return `${row.municipality}|${row.segment_type}|${row.cut_name??''}`}
function expectedRows(cycle){return cycle.rows.flatMap(([municipality,water,sewer])=>[
  {municipality,segment_type:'WATER',cut_name:null,target_economies:water},
  {municipality,segment_type:'SEWER',cut_name:null,target_economies:sewer},
])}
function summarize(rows){return rows.reduce((sum,row)=>{const amount=Number(row.target_economies);sum[row.segment_type==='WATER'?'water':'sewer']+=amount;sum.total+=amount;return sum},{water:0,sewer:0,total:0})}

const profile=result(await db.from('profiles').select('role,active').eq('id',auth.user.id).single());
assert(profile.role==='ADMIN'&&profile.active===true,'A conta de carga não possui profile ADMIN ativo.');
const contract=result(await db.from('contracts').select('id,code,contract_value,active').eq('code','SBON 17B').single());
assert(contract.active===true,'Contrato SBON 17B não está ativo.');

for(const table of ['monthly_financials','weekly_progress']){
  const {count,error}=await db.from(table).select('id',{count:'exact',head:true}).eq('contract_id',contract.id);
  if(error)throw error;
  assert(count===0,`${table} contém registros; carga oficial interrompida.`);
}

const currentTargets=result(await db.from('annual_targets').select('id,year,cycle_number,milestone_date,target_economies').eq('contract_id',contract.id));
assert(currentTargets.every(row=>official[row.year]),'Existe annual_target fora dos ciclos oficiais 2026-2028.');
for(const target of currentTargets){
  const details=result(await db.from('annual_target_details').select('id,municipality,segment_type,cut_name,target_economies').eq('annual_target_id',target.id));
  const allowed=new Set(expectedRows(official[target.year]).map(keyOf));
  assert(details.every(row=>allowed.has(keyOf(row))),'Há detalhe de meta inesperado ou recorte não autorizado.');
}

const preview={mode:apply?'apply':'preview',contract:{id:contract.id,from:contract.contract_value,to:255497807.17},cycles:Object.entries(official).map(([year,cycle])=>({year:Number(year),cycle:cycle.cycle,milestone:cycle.milestone,details:10}))};
if(!apply){console.log(JSON.stringify(preview,null,2));process.exit(0)}

const lastAudit=result(await db.from('audit_logs').select('id').order('id',{ascending:false}).limit(1).maybeSingle());
const baselineAuditId=lastAudit?.id??0;
if(Number(contract.contract_value)!==255497807.17){
  result(await db.from('contracts').update({contract_value:255497807.17}).eq('id',contract.id).select('id').single());
}

for(const [yearText,cycle] of Object.entries(official)){
  const year=Number(yearText);
  let target=currentTargets.find(row=>row.year===year);
  if(target){
    target=result(await db.from('annual_targets').update({cycle_number:cycle.cycle,milestone_date:cycle.milestone,target_economies:null}).eq('id',target.id).select('id,year').single());
  }else{
    target=result(await db.from('annual_targets').insert({contract_id:contract.id,year,cycle_number:cycle.cycle,milestone_date:cycle.milestone,target_economies:null}).select('id,year').single());
  }
  const existing=result(await db.from('annual_target_details').select('id,municipality,segment_type,cut_name,target_economies').eq('annual_target_id',target.id));
  const byKey=new Map(existing.map(row=>[keyOf(row),row]));
  for(const row of expectedRows(cycle)){
    const found=byKey.get(keyOf(row));
    if(found){
      if(Number(found.target_economies)!==row.target_economies)result(await db.from('annual_target_details').update({target_economies:row.target_economies}).eq('id',found.id).select('id').single());
    }else{
      result(await db.from('annual_target_details').insert({...row,annual_target_id:target.id}).select('id').single());
    }
  }
}

const verifiedContract=result(await db.from('contracts').select('contract_value').eq('id',contract.id).single());
assert(Number(verifiedContract.contract_value)===255497807.17,'Valor contratual persistido diverge do oficial.');
const verifiedTargets=result(await db.from('annual_targets').select('id,year,cycle_number,milestone_date,target_economies').eq('contract_id',contract.id).order('year'));
assert(verifiedTargets.length===3,'Quantidade de ciclos oficiais divergente.');
const annual={};const all=[];
for(const target of verifiedTargets){
  const rows=result(await db.from('annual_target_details').select('municipality,segment_type,cut_name,target_economies').eq('annual_target_id',target.id));
  assert(rows.length===10&&rows.every(row=>row.cut_name===null),'Quantidade de detalhes ou recortes diverge do oficial.');
  annual[target.year]=summarize(rows);all.push(...rows);
  assert(JSON.stringify(annual[target.year])===JSON.stringify(expected[target.year]),`Totais de ${target.year} divergentes.`);
  assert(target.target_economies===null,'target_economies legado foi preenchido.');
}
const contractTotals=summarize(all);
assert(JSON.stringify(contractTotals)===JSON.stringify(expected.contract),'Total contratual divergente.');
const audits=result(await db.from('audit_logs').select('id,entity,action,user_id').gt('id',baselineAuditId).order('id'));
assert(audits.some(row=>row.entity==='contracts'&&row.action==='UPDATE'),'Auditoria do valor contratual ausente.');
assert(audits.some(row=>row.entity==='annual_targets'),'Auditoria dos ciclos ausente.');
assert(audits.some(row=>row.entity==='annual_target_details'),'Auditoria dos detalhes ausente.');
assert(audits.every(row=>row.user_id===auth.user.id),'Auditoria da carga contém ator divergente.');

console.log(JSON.stringify({mode:'applied',contractValue:Number(verifiedContract.contract_value),annual,contractTotals,cycles:verifiedTargets.map(({year,cycle_number,milestone_date,target_economies})=>({year,cycle_number,milestone_date,target_economies})),detailCount:all.length,auditEvents:audits.length},null,2));
