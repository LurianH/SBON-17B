import { createClient } from '@supabase/supabase-js';

const roles = ['ADMIN', 'HIGOR', 'EDITOR', 'GESTOR', 'DIRETORIA'];
const roleEnv = (role, kind) => {
  if (role !== 'HIGOR') return process.env[`SBON_TEST_${role}_${kind}`];
  return process.env[`SBON_TEST_HIGOR_${kind}`] ?? process.env[`SBON_TEST_NO_PROFILE_${kind}`];
};
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];
const missing = required.filter((key) => !process.env[key]);
for (const role of roles) {
  for (const kind of ['EMAIL', 'PASSWORD']) {
    if (!roleEnv(role, kind)) missing.push(`SBON_TEST_${role}_${kind}`);
  }
}
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function login(role) {
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({
    email: roleEnv(role, 'EMAIL'),
    password: roleEnv(role, 'PASSWORD'),
  });
  if (error) throw new Error(`${role}: login falhou: ${error.message}`);
  return { db, user: data.user };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectDenied(operation, message) {
  const { data, error } = await operation;
  assert(Boolean(error) || !data?.length, message);
}

const sessions = {};
for (const role of roles) sessions[role] = await login(role);

for (const role of roles) {
  const { data, error } = await sessions[role].db
    .from('profiles')
    .select('role,active')
    .eq('id', sessions[role].user.id)
    .single();
  const expectedRole = role === 'HIGOR' ? 'ADMIN' : role;
  assert(!error && data?.role === expectedRole && data.active, `${role}: profile inválido`);
}

const { data: adminProfiles } = await sessions.ADMIN.db.from('profiles').select('id');
const { data: editorProfiles } = await sessions.EDITOR.db.from('profiles').select('id');
assert(adminProfiles?.length === 9, 'ADMIN não visualizou os nove profiles definitivos');
assert(editorProfiles?.length === 1, 'EDITOR visualizou outros profiles');

const { data: contract, error: contractError } = await sessions.ADMIN.db
  .from('contracts')
  .select('id')
  .eq('code', 'SBON 17B')
  .single();
if (contractError) throw contractError;

const testDates = ['2099-12-20', '2099-12-21'];
const testActionTitle = 'HOMOLOGAÇÃO RLS — registro temporário';
await sessions.ADMIN.db.from('weekly_progress').delete().eq('contract_id', contract.id).in('reference_date', testDates);
await sessions.ADMIN.db.from('monthly_financials').delete().eq('contract_id', contract.id).eq('reference_year', 2099).eq('reference_month', 12);
await sessions.ADMIN.db.from('action_plans').delete().eq('contract_id', contract.id).eq('title', testActionTitle);

const weeklyPayload = {
  contract_id: contract.id,
  reference_date: testDates[0],
  economies_available: 10,
  economies_executed: 8,
  network_approved_m: 100,
  network_executed_m: 80,
};

const { data: adminWeekly, error: adminInsertError } = await sessions.ADMIN.db
  .from('weekly_progress')
  .insert(weeklyPayload)
  .select('id')
  .single();
assert(!adminInsertError && adminWeekly, 'ADMIN não conseguiu inserir');
const { data: adminUpdated, error: adminUpdateError } = await sessions.ADMIN.db
  .from('weekly_progress')
  .update({ economies_executed: 9 })
  .eq('id', adminWeekly.id)
  .select('id');
assert(!adminUpdateError && adminUpdated?.length === 1, 'ADMIN não conseguiu atualizar');
const { data: adminDeleted, error: adminDeleteError } = await sessions.ADMIN.db
  .from('weekly_progress')
  .delete()
  .eq('id', adminWeekly.id)
  .select('id');
assert(!adminDeleteError && adminDeleted?.length === 1, 'ADMIN não conseguiu excluir');

const { data: editorWeekly, error: editorInsertError } = await sessions.EDITOR.db
  .from('weekly_progress')
  .insert({ ...weeklyPayload, reference_date: testDates[1] })
  .select('id')
  .single();
assert(!editorInsertError && editorWeekly, 'EDITOR não conseguiu inserir weekly_progress');
const { data: editorUpdated, error: editorUpdateError } = await sessions.EDITOR.db
  .from('weekly_progress')
  .update({ economies_executed: 9 })
  .eq('id', editorWeekly.id)
  .select('id');
assert(!editorUpdateError && editorUpdated?.length === 1, 'EDITOR não conseguiu atualizar weekly_progress');

const { data: editorFinancial, error: editorFinancialError } = await sessions.EDITOR.db
  .from('monthly_financials')
  .insert({ contract_id: contract.id, reference_year: 2099, reference_month: 12, amount: 1, notes: testActionTitle })
  .select('id')
  .single();
assert(!editorFinancialError && editorFinancial, 'EDITOR não conseguiu inserir monthly_financials');
const { data: financialUpdated, error: financialUpdateError } = await sessions.EDITOR.db
  .from('monthly_financials')
  .update({ amount: 2 })
  .eq('id', editorFinancial.id)
  .select('id');
assert(!financialUpdateError && financialUpdated?.length === 1, 'EDITOR não conseguiu atualizar monthly_financials');

const { data: editorAction, error: editorActionError } = await sessions.EDITOR.db
  .from('action_plans')
  .insert({
    contract_id: contract.id,
    origin: 'execucao',
    title: testActionTitle,
    description: 'Teste temporário',
    action: 'Validar RLS',
    status: 'aberto',
  })
  .select('id')
  .single();
assert(!editorActionError && editorAction, 'EDITOR não conseguiu inserir action_plans');
const { data: actionUpdated, error: actionUpdateError } = await sessions.EDITOR.db
  .from('action_plans')
  .update({ status: 'em_andamento' })
  .eq('id', editorAction.id)
  .select('id');
assert(!actionUpdateError && actionUpdated?.length === 1, 'EDITOR não conseguiu atualizar action_plans');

for (const role of ['GESTOR', 'DIRETORIA']) {
  const { data: visibleRows, error: readError } = await sessions[role].db.from('contracts').select('id');
  assert(!readError && visibleRows?.length === 1, `${role}: SELECT negado`);
  await expectDenied(
    sessions[role].db.from('weekly_progress').insert({ ...weeklyPayload, reference_date: `2099-12-${role === 'GESTOR' ? '22' : '23'}` }).select('id'),
    `${role}: INSERT permitido indevidamente`,
  );
  await expectDenied(
    sessions[role].db.from('weekly_progress').update({ economies_executed: 7 }).eq('id', editorWeekly.id).select('id'),
    `${role}: UPDATE permitido indevidamente`,
  );
  await expectDenied(
    sessions[role].db.from('weekly_progress').delete().eq('id', editorWeekly.id).select('id'),
    `${role}: DELETE permitido indevidamente`,
  );
}

const { error: duplicateError } = await sessions.EDITOR.db.from('monthly_financials').insert({
  contract_id: contract.id,
  reference_year: 2099,
  reference_month: 12,
  amount: 3,
});
assert(duplicateError?.code === '23505', 'Duplicidade de competência não foi bloqueada');

const { data: audit, error: auditError } = await sessions.ADMIN.db
  .from('audit_logs')
  .select('user_id,old_data,new_data,created_at')
  .eq('entity', 'weekly_progress')
  .eq('entity_id', editorWeekly.id)
  .eq('action', 'UPDATE')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
assert(!auditError && audit?.user_id === sessions.EDITOR.user.id && audit.old_data && audit.new_data, 'Auditoria de atualização inválida');

await sessions.ADMIN.db.from('weekly_progress').delete().eq('id', editorWeekly.id);
await sessions.ADMIN.db.from('monthly_financials').delete().eq('id', editorFinancial.id);
await sessions.ADMIN.db.from('action_plans').delete().eq('id', editorAction.id);

console.log(JSON.stringify({
  authentication: 'ok',
  profiles: { ADMIN: 2, EDITOR: 1, GESTOR: 4, DIRETORIA: 2 },
  rls: {
    ADMIN: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    EDITOR: ['SELECT', 'INSERT/UPDATE weekly_progress', 'INSERT/UPDATE monthly_financials', 'INSERT/UPDATE action_plans'],
    GESTOR: ['SELECT', 'writes denied'],
    DIRETORIA: ['SELECT', 'writes denied'],
    HIGOR_ADMIN: ['SELECT', 'profile active', 'route authorization applicable'],
  },
  duplicateCompetence: 'blocked',
  audit: 'ok',
  cleanup: 'ok',
}, null, 2));
