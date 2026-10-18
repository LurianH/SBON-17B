import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {StainRegistry} from '@/components/StainRegistry';
import {createClient} from '@/lib/supabase/server';
import {canReadEngineering} from '@/lib/engineering';

export const dynamic='force-dynamic';
export default async function ManchasPage(){
 const db=await createClient();
 if(!db) return <AppShell title="Cadastro de manchas"><p>Conexão de dados não configurada.</p></AppShell>;
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await db.from('profiles').select('role,active').eq('id',user.id).maybeSingle();
 if(!profile?.active||!canReadEngineering(profile.role))redirect('/login?reason=profile');
 const {data:contract}=await db.from('contracts').select('id').eq('code','SBON 17B').eq('active',true).maybeSingle();
 if(!contract)return <AppShell title="Cadastro de manchas"><p>Contrato não encontrado.</p></AppShell>;
 const [targets,stains,history]=await Promise.all([
  db.from('contract_stain_targets').select('*').eq('contract_id',contract.id).order('segment_type'),
  db.from('contract_stains').select('*').eq('contract_id',contract.id).order('segment_type').order('municipality').order('stain_code'),
  db.from('contract_stain_history').select('id,stain_id,old_status,new_status,changed_at').order('changed_at',{ascending:false}).limit(25)
 ]);
 const error=targets.error||stains.error||history.error;
 return <AppShell title="Manchas do contrato" eyebrow="CONTROLE GERENCIAL">
  {error?<p role="alert">Não foi possível carregar o cadastro de manchas: {error.message}</p>:<StainRegistry contractId={contract.id} role={profile.role} targets={targets.data??[]} rows={stains.data??[]} history={history.data??[]}/>}
 </AppShell>;
}
