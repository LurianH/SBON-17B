import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {GisRegistry,type GisSystemRow} from '@/components/GisRegistry';
import {createClient} from '@/lib/supabase/server';
import {canReadEngineering} from '@/lib/engineering';

export const dynamic='force-dynamic';
export default async function ManchasPage(){
 const db=await createClient();
 if(!db)return <AppShell title="Manchas GIS"><p>Conexão de dados não configurada.</p></AppShell>;
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await db.from('profiles').select('role,active').eq('id',user.id).maybeSingle();
 if(!profile?.active||!canReadEngineering(profile.role))redirect('/login?reason=profile');
 const {data:contract}=await db.from('contracts').select('id').eq('code','SBON 17B').eq('active',true).maybeSingle();
 if(!contract)return <AppShell title="Manchas GIS"><p>Contrato SBON 17B não encontrado.</p></AppShell>;
 const result=await db.from('gis_stain_system_effective').select('*').eq('contract_id',contract.id)
    .order('municipality').order('gis_code').order('segment_type');
 return <AppShell title="Manchas GIS" eyebrow="CADASTRO OFICIAL · LOTE 17B">
  {result.error?<p role="alert">Não foi possível carregar o cadastro GIS. Verifique a implantação da base e tente novamente.</p>
    :<GisRegistry rows={(result.data??[]) as GisSystemRow[]} role={profile.role}/>}
 </AppShell>;
}
