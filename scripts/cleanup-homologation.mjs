import { createClient } from '@supabase/supabase-js';

const CONFIRMATION = 'REMOVER_HOMOLOGACAO_SBON17B';
const execute = process.argv.includes('--execute');
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length);

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SBON_TEST_ADMIN_EMAIL',
  'SBON_TEST_ADMIN_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);
if (execute && confirmation !== CONFIRMATION) {
  throw new Error(`Execução bloqueada. Use --execute --confirm=${CONFIRMATION} após revisar o dry-run.`);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { error: loginError } = await db.auth.signInWithPassword({
  email: process.env.SBON_TEST_ADMIN_EMAIL,
  password: process.env.SBON_TEST_ADMIN_PASSWORD,
});
if (loginError) throw new Error(`Autenticação ADMIN falhou: ${loginError.message}`);

function assert(condition, message) {
  if (!condition) throw new Error(`LIMPEZA INTERROMPIDA: ${message}`);
}
function assertQuery(result) {
  if (result.error) throw result.error;
  return result.data ?? [];
}
function sameJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

const expectedFinancials = [
  [1, 4_500_000], [2, 4_800_000], [3, 5_100_000], [4, 5_300_000],
  [5, 5_500_000], [6, 5_600_000], [7, 5_700_000], [8, 5_800_000],
];
const expectedWeekly = [
  ['2026-08-03', 10_000, 8_000, 140_000, 120_000],
  ['2026-08-10', 10_350, 8_250, 145_000, 123_500],
  ['2026-08-17', 10_730, 8_560, 151_000, 127_800],
  ['2026-08-24', 11_100, 8_840, 157_000, 132_000],
];

const { data: contract, error: contractError } = await db
  .from('contracts')
  .select('id,code,name,contract_value,start_date,end_date,active')
  .eq('code', 'SBON 17B')
  .single();
if (contractError) throw contractError;
assert(contract.name === 'SBON 17B' && contract.active === true, 'o registro estrutural do contrato diverge.');
assert(Number(contract.contract_value) === 78_500_000, 'o valor contratual não é o valor provisório esperado.');

const [targetsResult, financialsResult, weeklyResult, cyclesResult, actionsResult] = await Promise.all([
  db.from('annual_targets').select('id,year,target_economies').eq('contract_id', contract.id).order('year'),
  db.from('monthly_financials').select('id,reference_year,reference_month,amount,notes,active').eq('contract_id', contract.id).order('reference_year').order('reference_month'),
  db.from('weekly_progress').select('id,reference_date,economies_available,economies_executed,network_approved_m,network_executed_m,active').eq('contract_id', contract.id).order('reference_date'),
  db.from('projection_cycles').select('id,base_year,base_month').eq('contract_id', contract.id).order('base_year').order('base_month'),
  db.from('action_plans').select('id,title,origin,description,action,responsible,due_date,status').eq('contract_id', contract.id).order('created_at'),
]);
const targets = assertQuery(targetsResult);
const financials = assertQuery(financialsResult);
const weekly = assertQuery(weeklyResult);
const cycles = assertQuery(cyclesResult);
const actions = assertQuery(actionsResult);

assert(targets.length === 1 && targets[0].year === 2026 && targets[0].target_economies === 15_000, 'há meta oficial ou meta divergente misturada.');
assert(financials.length === 8, 'há faturamento oficial ou quantidade divergente misturada.');
assert(sameJson(financials.map((row) => [row.reference_month, Number(row.amount)]), expectedFinancials), 'as competências/valores financeiros divergem da homologação.');
assert(financials.every((row) => row.reference_year === 2026 && row.active === true && row.notes === 'HOMOLOGAÇÃO FASE 3 — substituir antes da produção'), 'há faturamento sem marca inequívoca de homologação.');
assert(weekly.length === 4, 'há progresso oficial ou quantidade divergente misturada.');
assert(sameJson(weekly.map((row) => [row.reference_date, row.economies_available, row.economies_executed, Number(row.network_approved_m), Number(row.network_executed_m)]), expectedWeekly), 'os avanços semanais divergem da homologação documentada.');
assert(weekly.every((row) => row.active === true), 'há avanço inativo não previsto.');
assert(cycles.length === 0, 'existem ciclos de projeção; sem marca inequívoca, o script não os excluirá.');
assert(actions.length === 1, 'há plano oficial ou quantidade divergente misturada.');
assert(actions[0].title === 'HOMOLOGAÇÃO — Recuperação do avanço físico'
  && actions[0].origin === 'execucao'
  && actions[0].description === 'Plano controlado para validar persistência, contagem e auditoria.'
  && actions[0].action === 'Acompanhar semanalmente a recuperação das economias executadas.'
  && actions[0].responsible === 'Equipe de execução'
  && actions[0].due_date === '2026-09-30'
  && actions[0].status === 'em_andamento', 'o plano de ação não corresponde exatamente ao artefato de homologação.');

const candidates = {
  contractValue: { id: contract.id, from: Number(contract.contract_value), to: null },
  annualTargets: targets,
  monthlyFinancials: financials,
  weeklyProgress: weekly,
  projectionCycles: cycles,
  actionPlans: actions,
  auditLogs: {
    action: 'preserve',
    reason: 'O procedimento da Fase 3 orienta exportação/retenção; a limpeza gerará novos eventos auditáveis e não removerá histórico estrutural.',
  },
  officialDataMixed: false,
};

if (!execute) {
  console.log(JSON.stringify({ mode: 'dry-run', safeToExecute: true, confirmationRequired: CONFIRMATION, candidates }, null, 2));
  process.exit(0);
}

async function deleteExact(table, ids) {
  if (!ids.length) return [];
  const rows = assertQuery(await db.from(table).delete().in('id', ids).select('id'));
  assert(sameJson(rows.map((row) => row.id).sort(), [...ids].sort()), `${table}: nem todos os IDs exatos foram removidos.`);
  return rows.map((row) => row.id);
}

const removed = {
  actionPlans: await deleteExact('action_plans', actions.map((row) => row.id)),
  projectionCycles: await deleteExact('projection_cycles', cycles.map((row) => row.id)),
  weeklyProgress: await deleteExact('weekly_progress', weekly.map((row) => row.id)),
  monthlyFinancials: await deleteExact('monthly_financials', financials.map((row) => row.id)),
  annualTargets: await deleteExact('annual_targets', targets.map((row) => row.id)),
};
const contractRows = assertQuery(await db.from('contracts')
  .update({ contract_value: null })
  .eq('id', contract.id)
  .eq('code', 'SBON 17B')
  .eq('name', 'SBON 17B')
  .eq('active', true)
  .eq('contract_value', 78_500_000)
  .select('id,code,name,contract_value,active'));
assert(contractRows.length === 1 && contractRows[0].contract_value === null, 'o valor provisório do contrato não foi limpo.');

console.log(JSON.stringify({
  mode: 'execute',
  removed,
  contractPreserved: contractRows[0],
  auditLogsPreserved: true,
}, null, 2));
