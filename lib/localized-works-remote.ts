import type {SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/client';
import {LOCALIZED_DATABASE_ENABLED} from './localized-works-config';
import {localizedDbWorkSchema, localizedDbUpdateSchema, type LocalizedDbWork, type LocalizedDbUpdate,
  type LocalizedWorkRow, type LocalizedUpdateRow} from './localized-works-model';

export {LOCALIZED_DATABASE_ENABLED};
export type {LocalizedDbWork, LocalizedDbUpdate};
export const LOCALIZED_HISTORY_PAGE_SIZE = 20;
function client() {
  if (!LOCALIZED_DATABASE_ENABLED) throw new Error('Cadastro central aguardando liberação deste ambiente.');
  const db = createClient();
  if (!db) throw new Error('Conexão Supabase indisponível.');
  return db;
}
async function authorizeWriter(db: SupabaseClient) {
  const {data: {user}, error} = await db.auth.getUser();
  if (error || !user) throw new Error('Entre novamente para salvar.');
  const {data: profile, error: profileError} = await db.from('profiles').select('role,active').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.active || !['ADMIN', 'EDITOR'].includes(profile.role)) throw new Error('Perfil sem permissão de cadastro.');
}
export async function saveNewLocalizedWork(work: LocalizedDbWork, update: LocalizedDbUpdate): Promise<string> {
  const db = client();
  const checkedWork = localizedDbWorkSchema.parse(work), checkedUpdate = localizedDbUpdateSchema.parse(update);
  await authorizeWriter(db);
  const {data, error} = await db.rpc('create_sbon17b_localized_work', {p_work: checkedWork, p_update: checkedUpdate});
  if (error) throw new Error('Não foi possível salvar a obra localizada: ' + error.message);
  if (typeof data !== 'string') throw new Error('Banco não retornou identificador da obra.');
  return data;
}
/** Server and browser share the paginated canonical query; reference seeds stay local. */
export async function loadLocalizedWorks(db: SupabaseClient, contractId: string): Promise<LocalizedWorkRow[]> {
  if (!LOCALIZED_DATABASE_ENABLED) throw new Error('Cadastro central aguardando liberação deste ambiente.');
  const rows: LocalizedWorkRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const {data, error} = await db.from('engineering_localized_work_current').select('*')
      .eq('contract_id', contractId).eq('active', true).order('id').range(offset, offset + 499);
    if (error || !data) throw new Error('Consulta de obras localizadas falhou: ' + (error?.message ?? 'resposta vazia'));
    rows.push(...data as LocalizedWorkRow[]);
    if (data.length < 500) return rows;
  }
}
export async function listLocalizedWorksForContract(contractId: string) {
  return loadLocalizedWorks(client(), contractId);
}
/** Stable ordering, with one extra row to know whether another page exists. */
export async function listLocalizedWorkHistory(workId: string, offset = 0): Promise<{rows: LocalizedUpdateRow[]; hasMore: boolean}> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Página de histórico inválida.');
  const {data, error} = await client().from('engineering_localized_work_updates').select('*')
    .eq('localized_work_id', workId).order('reference_date', {ascending: false})
    .order('created_at', {ascending: false}).order('id', {ascending: false})
    .range(offset, offset + LOCALIZED_HISTORY_PAGE_SIZE);
  if (error || !data) throw new Error('Consulta de histórico falhou: ' + (error?.message ?? 'resposta vazia'));
  return {rows: data.slice(0, LOCALIZED_HISTORY_PAGE_SIZE) as LocalizedUpdateRow[], hasMore: data.length > LOCALIZED_HISTORY_PAGE_SIZE};
}
export async function saveLocalizedWorkUpdate(workId: string, update: LocalizedDbUpdate): Promise<string> {
  const db = client(), checked = localizedDbUpdateSchema.parse(update);
  await authorizeWriter(db);
  const {data, error} = await db.rpc('add_sbon17b_localized_work_update', {p_work_id: workId, p_update: checked});
  if (error) throw new Error('Não foi possível atualizar: ' + error.message);
  if (typeof data !== 'string') throw new Error('Banco não retornou o identificador da atualização.');
  return data;
}
