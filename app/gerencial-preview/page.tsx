import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {createClient} from '@/lib/supabase/server';
import {canReadEngineering} from '@/lib/engineering';
import {ManagementDashboardPreview} from '@/components/ManagementDashboardPreview';
import './preview.css';

export const dynamic = 'force-dynamic';
export default async function ManagementPreviewPage(){
  const db=await createClient();
  if(!db) return <AppShell title="Prévia Gerencial"><p>Conexão Supabase não configurada.</p></AppShell>;
  const {data:{user}}=await db.auth.getUser();
  if(!user) redirect('/login');
  const {data:profile}=await db.from('profiles').select('role,active').eq('id',user.id).maybeSingle();
  if(!profile?.active||!canReadEngineering(profile.role)) redirect('/login?reason=profile');
  return <AppShell title="Prévia Gerencial" eyebrow="ENGENHARIA · HOMOLOGAÇÃO"><ManagementDashboardPreview/></AppShell>;
}
