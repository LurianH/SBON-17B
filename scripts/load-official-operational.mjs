import {createClient} from '@supabase/supabase-js';
const apply=process.argv.includes('--apply');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,email=process.env.SBON_TEST_ADMIN_EMAIL,password=process.env.SBON_TEST_ADMIN_PASSWORD;
if(!url||!key||!email||!password)throw new Error('Variáveis locais obrigatórias ausentes.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:auth,error:authError}=await db.auth.signInWithPassword({email,password});if(authError)throw new Error('Autenticação administrativa falhou.');
function result(response){if(response.error)throw response.error;return response.data}function assert(value,message){if(!value)throw new Error(message)}
const profile=result(await db.from('profiles').select('role,active').eq('id',auth.user.id).single());assert(profile.role==='ADMIN'&&profile.active,'Conta de carga não é ADMIN ativa.');
const contract=result(await db.from('contracts').select('id').eq('code','SBON 17B').single());
const financial={contract_id:contract.id,reference_year:2026,reference_month:8,cumulative_amount:14879147.88,notes:'Medição acumulada oficial com data-base agosto/2026'};
const weekly={contract_id:contract.id,reference_date:'2026-08-27',economies_available:366,economies_executed:0,network_approved_m:16989.544,network_executed_m:0};
const details=[
 {municipality:'Quadra',segment_type:'WATER',economies_available:44,economies_executed:0,network_approved_m:1590.220,network_executed_m:0},
 {municipality:'Porangaba',segment_type:'WATER',economies_available:277,economies_executed:0,network_approved_m:14306.324,network_executed_m:0},
 {municipality:'Porangaba',segment_type:'SEWER',economies_available:45,economies_executed:0,network_approved_m:1093.000,network_executed_m:0},
];
const totals=details.reduce((s,r)=>({economies_available:s.economies_available+r.economies_available,economies_executed:s.economies_executed+r.economies_executed,network_approved_m:s.network_approved_m+r.network_approved_m,network_executed_m:s.network_executed_m+r.network_executed_m}),{economies_available:0,economies_executed:0,network_approved_m:0,network_executed_m:0});
assert(Math.abs(totals.network_approved_m-weekly.network_approved_m)<0.0001&&totals.economies_available===weekly.economies_available,'Detalhes físicos não fecham com o consolidado.');
const existingFinancial=result(await db.from('financial_measurement_snapshots').select('id,cumulative_amount').eq('contract_id',contract.id).eq('reference_year',2026).eq('reference_month',8).maybeSingle());
const existingWeekly=result(await db.from('weekly_progress').select('id,economies_available,economies_executed,network_approved_m,network_executed_m').eq('contract_id',contract.id).eq('reference_date',weekly.reference_date).maybeSingle());
if(!apply){console.log(JSON.stringify({mode:'preview',financial,weekly,details},null,2));process.exit(0)}
if(existingFinancial)result(await db.from('financial_measurement_snapshots').update(financial).eq('id',existingFinancial.id).select('id').single());else result(await db.from('financial_measurement_snapshots').insert(financial).select('id').single());
let progress;if(existingWeekly)progress=result(await db.from('weekly_progress').update(weekly).eq('id',existingWeekly.id).select('id').single());else progress=result(await db.from('weekly_progress').insert(weekly).select('id').single());
const existingDetails=result(await db.from('weekly_progress_details').select('id,municipality,segment_type').eq('weekly_progress_id',progress.id));
assert(existingDetails.every(r=>details.some(d=>d.municipality===r.municipality&&d.segment_type===r.segment_type)),'Há detalhe físico inesperado na data oficial.');
for(const row of details){const old=existingDetails.find(r=>r.municipality===row.municipality&&r.segment_type===row.segment_type);if(old)result(await db.from('weekly_progress_details').update(row).eq('id',old.id).select('id').single());else result(await db.from('weekly_progress_details').insert({...row,weekly_progress_id:progress.id}).select('id').single())}
const verifiedFinancial=result(await db.from('financial_measurement_snapshots').select('reference_year,reference_month,cumulative_amount').eq('contract_id',contract.id).single());
const verifiedWeekly=result(await db.from('weekly_progress').select('id,reference_date,economies_available,economies_executed,network_approved_m,network_executed_m').eq('id',progress.id).single());
const verifiedDetails=result(await db.from('weekly_progress_details').select('municipality,segment_type,economies_available,economies_executed,network_approved_m,network_executed_m').eq('weekly_progress_id',progress.id));
assert(Number(verifiedFinancial.cumulative_amount)===financial.cumulative_amount,'Medição acumulada divergente.');assert(verifiedDetails.length===3,'Detalhes físicos divergentes.');
console.log(JSON.stringify({mode:'applied',financial:{...verifiedFinancial,cumulative_amount:Number(verifiedFinancial.cumulative_amount)},weekly:{...verifiedWeekly,network_approved_m:Number(verifiedWeekly.network_approved_m),network_executed_m:Number(verifiedWeekly.network_executed_m)},details:verifiedDetails.map(r=>({...r,network_approved_m:Number(r.network_approved_m),network_executed_m:Number(r.network_executed_m)}))},null,2));
