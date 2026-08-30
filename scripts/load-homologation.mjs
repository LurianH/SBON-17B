import { createClient } from '@supabase/supabase-js';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SBON_TEST_ADMIN_EMAIL',
  'SBON_TEST_ADMIN_PASSWORD',
  'SBON_TEST_EDITOR_EMAIL',
  'SBON_TEST_EDITOR_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function session(email, password) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return db;
}

function assert(error) {
  if (error) throw error;
}

async function upsertActive(db, table, match, values) {
  let query = db.from(table).select('id');
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value);
  if ('active' in values) query = query.eq('active', true);
  const { data, error } = await query.maybeSingle();
  assert(error);

  if (data) {
    const result = await db.from(table).update(values).eq('id', data.id);
    assert(result.error);
    return 'updated';
  }

  const result = await db.from(table).insert({ ...match, ...values });
  assert(result.error);
  return 'inserted';
}

const admin = await session(
  process.env.SBON_TEST_ADMIN_EMAIL,
  process.env.SBON_TEST_ADMIN_PASSWORD,
);
const editor = await session(
  process.env.SBON_TEST_EDITOR_EMAIL,
  process.env.SBON_TEST_EDITOR_PASSWORD,
);

const { data: contract, error: contractError } = await admin
  .from('contracts')
  .select('id')
  .eq('code', 'SBON 17B')
  .single();
assert(contractError);

assert((await admin.from('contracts').update({ contract_value: 78_500_000 }).eq('id', contract.id)).error);

const targetResult = await upsertActive(
  admin,
  'annual_targets',
  { contract_id: contract.id, year: 2026 },
  { target_economies: 15_000 },
);

const monthly = [
  [1, 4_500_000],
  [2, 4_800_000],
  [3, 5_100_000],
  [4, 5_300_000],
  [5, 5_500_000],
  [6, 5_600_000],
  [7, 5_700_000],
];
const monthlyResults = [];
for (const [reference_month, amount] of monthly) {
  monthlyResults.push(await upsertActive(
    editor,
    'monthly_financials',
    { contract_id: contract.id, reference_year: 2026, reference_month },
    { amount, notes: 'HOMOLOGAÇÃO FASE 3 — substituir antes da produção', active: true },
  ));
}

const weekly = [
  ['2026-08-03', 10_000, 8_000, 140_000, 120_000],
  ['2026-08-10', 10_350, 8_250, 145_000, 123_500],
  ['2026-08-17', 10_730, 8_560, 151_000, 127_800],
];
const weeklyResults = [];
for (const [reference_date, economies_available, economies_executed, network_approved_m, network_executed_m] of weekly) {
  weeklyResults.push(await upsertActive(
    editor,
    'weekly_progress',
    { contract_id: contract.id, reference_date },
    { economies_available, economies_executed, network_approved_m, network_executed_m, active: true },
  ));
}

const actionTitle = 'HOMOLOGAÇÃO — Recuperação do avanço físico';
const actionResult = await upsertActive(
  editor,
  'action_plans',
  { contract_id: contract.id, title: actionTitle },
  {
    origin: 'execucao',
    description: 'Plano controlado para validar persistência, contagem e auditoria.',
    action: 'Acompanhar semanalmente a recuperação das economias executadas.',
    responsible: 'Equipe de execução',
    due_date: '2026-09-30',
    status: 'aberto',
  },
);

console.log(JSON.stringify({
  contract: 'updated',
  target: targetResult,
  monthly: monthlyResults,
  weekly: weeklyResults,
  actionPlan: actionResult,
  pendingInterface: ['monthly_financials 08/2026', 'weekly_progress 2026-08-24'],
}, null, 2));
