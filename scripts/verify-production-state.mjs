import { createClient } from '@supabase/supabase-js';

const higorEmail = process.env.SBON_TEST_HIGOR_EMAIL ?? process.env.SBON_TEST_NO_PROFILE_EMAIL;
const higorPassword = process.env.SBON_TEST_HIGOR_PASSWORD ?? process.env.SBON_TEST_NO_PROFILE_PASSWORD;
const required = [
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  higorEmail,
  higorPassword,
];
if (required.some((value) => !value)) throw new Error('Variáveis de produção/teste ausentes.');

const db = createClient(required[0], required[1], {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: auth, error: authError } = await db.auth.signInWithPassword({
  email: higorEmail,
  password: higorPassword,
});
if (authError) throw new Error(`Login de Higor falhou: ${authError.message}`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { data: profile, error: profileError } = await db.from('profiles')
  .select('id,email,role,active').eq('id', auth.user.id).single();
if (profileError) throw profileError;
assert(profile.role === 'ADMIN' && profile.active, 'Higor não é ADMIN ativo.');

const { data: contract, error: contractError } = await db.from('contracts')
  .select('id,code,name,contract_value,active').eq('code', 'SBON 17B').single();
if (contractError) throw contractError;
assert(contract.name === 'SBON 17B' && contract.active && contract.contract_value === null, 'Contrato estrutural divergente.');

const tables = ['annual_targets', 'monthly_financials', 'weekly_progress', 'projection_cycles', 'action_plans'];
const results = await Promise.all(tables.map((table) => db.from(table).select('id', { count: 'exact', head: true }).eq('contract_id', contract.id)));
const operationalCounts = {};
for (let i = 0; i < tables.length; i += 1) {
  if (results[i].error) throw results[i].error;
  operationalCounts[tables[i]] = results[i].count ?? 0;
}
assert(Object.values(operationalCounts).every((count) => count === 0), 'Ainda existem dados operacionais.');

const { count: profiles, error: profilesError } = await db.from('profiles').select('id', { count: 'exact', head: true });
if (profilesError) throw profilesError;
assert(profiles === 9, 'Quantidade final de profiles divergente.');

console.log(JSON.stringify({
  higor: { authenticated: true, profile },
  contract,
  profiles,
  operationalCounts,
  rlsApplied: true,
}, null, 2));
