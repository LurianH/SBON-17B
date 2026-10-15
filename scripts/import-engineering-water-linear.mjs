// Guarded workbook import. Preview is the default; --apply writes through the
// authenticated create_engineering_project RPC and its existing RLS policies.
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
if (process.argv.some(arg => arg.startsWith('--') && arg !== '--apply')) throw new Error('Use sem argumentos ou somente --apply.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SBON_ENGINEERING_IMPORT_EMAIL;
const password = process.env.SBON_ENGINEERING_IMPORT_PASSWORD;
if (!url || !key || !email || !password) {
  throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SBON_ENGINEERING_IMPORT_EMAIL e SBON_ENGINEERING_IMPORT_PASSWORD no ambiente local.');
}

const source = JSON.parse(await readFile(new URL('../data/engineering-water-linear.json', import.meta.url), 'utf8'));
const asMillimeters = value => {
  const [whole, fraction = ''] = String(value).split('.');
  return Number(whole) * 1000 + Number((fraction + '000').slice(0, 3));
};
const fromMillimeters = value => `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, '0')}`;
const rows = source.records.map(row => ({...row,
  approved_length_m: fromMillimeters(asMillimeters(row.pead_de63_length_m) + asMillimeters(row.pead_de110_length_m)),
}));
const sourceTotals = {
  projects: rows.length,
  economies: rows.reduce((sum, row) => sum + (row.approved_economies ?? 0), 0),
  network_m: rows.reduce((sum, row) => sum + asMillimeters(row.approved_length_m), 0) / 1000,
};
if (sourceTotals.projects !== 13 || sourceTotals.economies !== 399 || sourceTotals.network_m !== 25908.34) {
  throw new Error(`Totais da fonte divergentes; importação interrompida: ${JSON.stringify(sourceTotals)}`);
}

const db = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
const {data: auth, error: authError} = await db.auth.signInWithPassword({email, password});
if (authError || !auth.user) throw new Error('Autenticação do operador falhou.');
const result = async response => {
  const resolved = await response;
  if (resolved.error) throw resolved.error;
  return resolved.data;
};
const profile = await result(db.from('profiles').select('role,active').eq('id', auth.user.id).single());
if (!profile.active || !['ADMIN', 'EDITOR'].includes(profile.role)) throw new Error('A conta precisa ter perfil ADMIN ou EDITOR ativo.');
const contract = await result(db.from('contracts').select('id,code,active').eq('code', source.contract_code).single());
if (!contract.active) throw new Error('O contrato SBON 17B não está ativo.');

const existing = [];
for (let offset = 0; ; offset += 500) {
  const page = await result(db.from('engineering_projects').select('id,municipality,segment_type,project_category,project_name,project_type,active')
    .eq('contract_id', contract.id).order('id').range(offset, offset + 499));
  existing.push(...page);
  if (page.length < 500) break;
}
const identity = row => `${row.segment_type}|${row.municipality}|${row.project_name.trim().toLocaleLowerCase('pt-BR')}`;
const byIdentity = new Map();
for (const project of existing) byIdentity.set(identity(project), [...(byIdentity.get(identity(project)) ?? []), project]);
const sourceKeys = new Set();
const toCreate = [], alreadyPresent = [], conflicts = [];
for (const row of rows) {
  const key = identity(row), matches = byIdentity.get(key) ?? [];
  if (sourceKeys.has(key) || matches.length > 1) conflicts.push(row.project_name);
  else if (matches.length === 1 && matches[0].project_type === 'PE' && matches[0].project_category === 'WATER_LINEAR') alreadyPresent.push(row.project_name);
  else if (matches.length === 1) conflicts.push(row.project_name);
  else toCreate.push(row);
  sourceKeys.add(key);
}
if (conflicts.length) throw new Error(`Conflito de identidade encontrado; nenhum dado foi gravado: ${conflicts.join(', ')}`);

const preview = {mode: apply ? 'apply' : 'preview', contract: contract.code,
  source: {file: source.source_file, reference_date: source.source_updated_at},
  totals: sourceTotals, already_present: alreadyPresent.length, to_create: toCreate.map(row => `${row.municipality} · ${row.project_name}`)};
if (!apply) {
  console.log(JSON.stringify(preview, null, 2));
  process.exit(0);
}

const created = [];
for (const row of toCreate) {
  const project = {municipality: row.municipality, segment_type: row.segment_type,
    project_category: row.project_category, project_name: row.project_name, project_type: row.project_type};
  const update = {reference_date: row.reference_date, concept_status: null, concept_approved_at: null,
    executive_status: null, executive_completed_at: null, delivery_status: row.delivery_status,
    approved_economies: row.approved_economies, approved_length_m: row.approved_length_m,
    pead_de63_length_m: row.pead_de63_length_m, pead_de110_length_m: row.pead_de110_length_m, notes: row.notes};
  const id = await result(db.rpc('create_engineering_project', {p_contract_id: contract.id, p_project: project, p_update: update}));
  created.push({id, municipality: row.municipality, project_name: row.project_name});
}
console.log(JSON.stringify({...preview, created: created.length, created_projects: created}, null, 2));
