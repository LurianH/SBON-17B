import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {EngineeringPanel} from '@/components/EngineeringPanel';
import {createClient} from '@/lib/supabase/server';
import {canReadEngineering, type Category, type Project, type Update} from '@/lib/engineering';
import './engineering.css';

export const dynamic = 'force-dynamic';
export default async function EngineeringPage() {
  const db = await createClient();
  if (!db) return <AppShell title="Engenharia"><EngineeringPanel projects={[]} updates={[]} categories={[]} role={null} contractId={null} notice="Conexão de dados não configurada neste ambiente."/></AppShell>;
  const {data: {user}} = await db.auth.getUser();
  if (!user) redirect('/login');
  const {data: profile} = await db.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
  if (!profile?.active || !canReadEngineering(profile.role)) redirect('/login?reason=profile');
  const {data: contract, error: contractError} = await db.from('contracts').select('id').eq('code', 'SBON 17B').eq('active', true).maybeSingle();
  let projects: Project[] = [], updates: Update[] = [], categories: Category[] = [];
  let notice = contractError ? 'Não foi possível carregar o contrato.' : !contract ? 'Contrato SBON 17B não encontrado.' : '';
  if (contract) {
    const categoryResult = await db.from('engineering_project_categories').select('code,label').order('code');
    if (categoryResult.error) notice = 'Engenharia indisponível. Verifique a conexão e se a migration da área foi aplicada.';
    else {
      categories = categoryResult.data;
      // Page explicitly: Supabase's default row cap must not truncate executive totals.
      for (let offset = 0; ; offset += 500) {
        const result = await db.from('engineering_projects').select('*').eq('contract_id', contract.id).eq('active', true).order('id').range(offset, offset + 499);
        if (result.error) {notice = 'Não foi possível carregar os projetos.'; break;}
        projects.push(...result.data as Project[]);
        if (result.data.length < 500) break;
      }
      for (let offset = 0; !notice; offset += 500) {
        const result = await db.from('engineering_current_updates').select('*').eq('contract_id', contract.id).eq('active', true).order('engineering_project_id').range(offset, offset + 499);
        if (result.error) {notice = 'Não foi possível carregar as atualizações de engenharia.'; break;}
        updates.push(...result.data as Update[]);
        if (result.data.length < 500) break;
      }
    }
  }
  if (notice) {projects = []; updates = [];}
  return <AppShell title="Engenharia" eyebrow="LIBERAÇÃO DE PROJETOS"><EngineeringPanel projects={projects} updates={updates} categories={categories} role={profile.role} contractId={notice ? null : contract?.id ?? null} notice={notice}/></AppShell>;
}
