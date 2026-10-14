/** Camada preparada para ativação após migração e testes RLS. Nunca chame antes disso. */
import {createClient} from '@/lib/supabase/client';

export type LocalizedDbWork={
  plan_row_key:string;
  engineering_project_id?:string|null;
  kind:'EEE'|'BOOSTER'|'RESERVOIR';
  designation:string;
  quantity:number;
};
export type LocalizedDbUpdate={
  reference_date:string;
  project_status:'NOT_STARTED'|'IN_PROGRESS'|'COMPLETED'|'APPROVED';
  physical_status:'NOT_STARTED'|'IN_PROGRESS'|'COMPLETED';
  budget_status:'NOT_BUDGETED'|'IN_PREPARATION'|'BUDGETED'|'UNDER_REVIEW'|'APPROVED';
  pump_power_cv?:number|null; flow_lps?:number|null;head_mca?:number|null;
  capacity_m3?:number|null;material?:string|null;
  hydraulic_project_status?:string|null;electrical_project_status?:string|null;
  structural_project_status?:string|null;contractual_item_code?:string|null;
  approved_budget_brl?:number|null;notes?:string|null;
};

/** Explicit safeguard until SQL/RLS are approved and deployed. */
export const LOCALIZED_DATABASE_ENABLED=false;

export async function saveNewLocalizedWork(work:LocalizedDbWork, update:LocalizedDbUpdate):Promise<string>{
  if(!LOCALIZED_DATABASE_ENABLED) throw new Error('Gravação central ainda não autorizada.');
  const db=createClient();
  if(!db)throw new Error('Conexão Supabase indisponível.');
  const {data:{user}}=await db.auth.getUser();
  if(!user)throw new Error('Entre novamente para salvar.');
  const {data:profile,error:profileError}=await db.from('profiles').select('role,active').eq('id',user.id).maybeSingle();
  if(profileError || !profile?.active || !['ADMIN','EDITOR'].includes(profile.role))throw new Error('Perfil sem permissão de cadastro.');
  // RPC executa cadastro e primeiro snapshot na mesma transação. RLS confere a permissão outra vez.
  const {data,error}=await db.rpc('create_sbon17b_localized_work',{p_work:work,p_update:update});
  if(error)throw new Error('Não foi possível salvar a obra localizada: '+error.message);
  if(typeof data!=='string')throw new Error('Banco não retornou identificador da obra.');
  return data;
}

/** Consulta remota apenas após implantação validada. */
export async function listLocalizedWorksForContract(contractId:string){
  if(!LOCALIZED_DATABASE_ENABLED) throw new Error('Leitura central ainda não autorizada.');
  const db=createClient(); if(!db)throw new Error('Conexão Supabase indisponível.');
  const {data,error}=await db.from('engineering_localized_works').select('*')
    .eq('contract_id',contractId).eq('active',true).order('created_at',{ascending:false});
  if(error)throw new Error('Consulta de obras localizadas falhou: '+error.message);
  return data;
}
/** Histórico completo paginado; não reutilizar um resumo como se fosse auditoria. */
export async function listLocalizedWorkHistory(workId:string,offset=0){
  if(!LOCALIZED_DATABASE_ENABLED) throw new Error('Histórico central ainda não autorizado.');
  const db=createClient(); if(!db)throw new Error('Conexão Supabase indisponível.');
  const {data,error}=await db.from('engineering_localized_work_updates').select('*')
    .eq('localized_work_id',workId).order('reference_date',{ascending:false})
    .order('created_at',{ascending:false}).order('id',{ascending:false})
    .range(offset,offset+19);
  if(error)throw new Error('Consulta de histórico falhou: '+error.message);
  return data;
}
/** Acrescenta snapshot, não altera o histórico anterior. */
export async function saveLocalizedWorkUpdate(workId:string,update:LocalizedDbUpdate):Promise<string>{
  if(!LOCALIZED_DATABASE_ENABLED)throw new Error('Gravação central ainda não autorizada.');
  const db=createClient(); if(!db)throw new Error('Conexão Supabase indisponível.');
  const {data:{user}}=await db.auth.getUser(); if(!user)throw new Error('Entre novamente para salvar.');
  const {data:profile,error:profileError}=await db.from('profiles')
    .select('role,active').eq('id',user.id).maybeSingle();
  if(profileError||!profile?.active||!['ADMIN','EDITOR'].includes(profile.role))
    throw new Error('Perfil sem permissão.');
  const {data,error}=await db.rpc('add_sbon17b_localized_work_update',
    {p_work_id:workId,p_update:update});
  if(error)throw new Error('Não foi possível atualizar: '+error.message);
  if(typeof data!=='string')throw new Error('Banco não retornou o identificador da atualização.');
  return data;
}
