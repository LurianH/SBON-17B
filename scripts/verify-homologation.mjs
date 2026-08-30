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

async function login(email, password) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { db, user: data.user };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deltas(values) {
  return values.slice(1).map((value, index) => value - values[index]);
}

function projectedMonths(current, weeklyAverage) {
  const increment = weeklyAverage * 4.345;
  return [Math.round(current + increment), Math.round(current + increment * 2)];
}

const admin = await login(process.env.SBON_TEST_ADMIN_EMAIL, process.env.SBON_TEST_ADMIN_PASSWORD);
const editor = await login(process.env.SBON_TEST_EDITOR_EMAIL, process.env.SBON_TEST_EDITOR_PASSWORD);

const { data: contract, error: contractError } = await admin.db
  .from('contracts')
  .select('id,code,name,contract_value,active')
  .eq('code', 'SBON 17B')
  .single();
if (contractError) throw contractError;
assert(contract.name === 'SBON 17B' && contract.active && Number(contract.contract_value) === 78_500_000, 'Contrato divergente');

const [{ data: target }, { data: financials }, { data: weekly }, { data: action }, auditBefore] = await Promise.all([
  admin.db.from('annual_targets').select('year,target_economies').eq('contract_id', contract.id).eq('year', 2026).single(),
  admin.db.from('monthly_financials').select('reference_year,reference_month,amount,notes').eq('contract_id', contract.id).eq('reference_year', 2026).eq('active', true).order('reference_month'),
  admin.db.from('weekly_progress').select('reference_date,economies_available,economies_executed,network_approved_m,network_executed_m').eq('contract_id', contract.id).eq('active', true).gte('reference_date', '2026-08-01').lte('reference_date', '2026-08-31').order('reference_date'),
  admin.db.from('action_plans').select('id,origin,status,title').eq('contract_id', contract.id).eq('title', 'HOMOLOGAÇÃO — Recuperação do avanço físico').single(),
  admin.db.from('audit_logs').select('id', { count: 'exact', head: true }),
]);

assert(target?.target_economies === 15_000, 'Meta anual divergente');
assert(financials?.length === 8, 'Esperadas oito competências de faturamento');
const billingYtd = financials.reduce((sum, row) => sum + Number(row.amount), 0);
assert(billingYtd === 42_300_000, 'YTD divergente');
assert(financials.every((row) => row.notes?.includes('HOMOLOGAÇÃO')), 'Faturamento sem marca de homologação');
assert(weekly?.length === 4, 'Esperadas quatro semanas de homologação');

const keys = ['economies_available', 'economies_executed', 'network_approved_m', 'network_executed_m'];
const deltaMap = Object.fromEntries(keys.map((key) => [key, deltas(weekly.map((row) => Number(row[key])))]));
const averages = Object.fromEntries(keys.map((key) => [key, average(deltaMap[key])]));
assert(JSON.stringify(deltaMap.economies_executed) === JSON.stringify([250, 310, 280]), 'Deltas executados divergentes');
assert(JSON.stringify(deltaMap.economies_available) === JSON.stringify([350, 380, 370]), 'Deltas disponíveis divergentes');
assert(JSON.stringify(deltaMap.network_approved_m) === JSON.stringify([5000, 6000, 6000]), 'Deltas de rede aprovada divergentes');
assert(JSON.stringify(deltaMap.network_executed_m) === JSON.stringify([3500, 4300, 4200]), 'Deltas de rede executada divergentes');

const latest = weekly.at(-1);
const quarterProjection = Object.fromEntries(keys.map((key) => [
  key,
  projectedMonths(Number(latest[key]), averages[key]),
]));
const latestDate = new Date(`${latest.reference_date}T12:00:00`);
const daysInMonth = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0).getDate();
const monthsRemaining = 11 - latestDate.getMonth() + (daysInMonth - latestDate.getDate()) / daysInMonth;
const annualProjection = Math.round(Number(latest.economies_executed) + averages.economies_executed * 4.345 * monthsRemaining);
const targetRatio = annualProjection / target.target_economies;
const deviationPercent = (targetRatio - 1) * 100;
const status = targetRatio >= 1 ? 'DENTRO_DO_PLANO' : targetRatio >= 0.9 ? 'ATENCAO' : 'CRITICO';

const yearStart = new Date(latestDate.getFullYear(), 0, 1);
const yearEnd = new Date(latestDate.getFullYear() + 1, 0, 1);
const expected = target.target_economies * ((latestDate.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime()));
const engineering = Math.max(0, expected - Number(latest.economies_available));
const execution = Math.max(0, Math.min(expected, Number(latest.economies_available)) - Number(latest.economies_executed));
const totalOrigin = engineering + execution;

if (action.status === 'aberto') {
  const { error } = await editor.db.from('action_plans').update({ status: 'em_andamento' }).eq('id', action.id);
  if (error) throw error;
}

const [{ data: updatedAction }, { data: actionAudit }, auditAfter] = await Promise.all([
  admin.db.from('action_plans').select('origin,status').eq('id', action.id).single(),
  admin.db.from('audit_logs').select('user_id,entity,entity_id,action,old_data,new_data,created_at').eq('entity', 'action_plans').eq('entity_id', action.id).eq('action', 'UPDATE').order('created_at', { ascending: false }).limit(1).single(),
  admin.db.from('audit_logs').select('id', { count: 'exact', head: true }),
]);
assert(updatedAction?.origin === 'execucao' && updatedAction.status === 'em_andamento', 'Plano de ação não atualizado');
assert(actionAudit?.user_id === editor.user.id && actionAudit.old_data?.status === 'aberto' && actionAudit.new_data?.status === 'em_andamento', 'Auditoria do plano inválida');
assert((auditAfter.count ?? 0) >= (auditBefore.count ?? 0), 'Histórico anterior foi reduzido');

console.log(JSON.stringify({
  contract: { code: contract.code, value: Number(contract.contract_value), active: contract.active },
  target: { year: target.year, economies: target.target_economies, homologation: true },
  billing: { months: financials.length, ytd: billingYtd },
  weekly: { lastReferenceDate: latest.reference_date, rows: weekly.length, deltas: deltaMap, averages },
  quarterProjection,
  annualProjection,
  targetDeviation: { percent: deviationPercent, status },
  deviationOrigin: totalOrigin === 0 ? { label: 'Sem desvio relevante' } : {
    engineering,
    execution,
    engineeringPercent: engineering / totalOrigin * 100,
    executionPercent: execution / totalOrigin * 100,
  },
  actionPlan: { origin: updatedAction.origin, status: updatedAction.status },
  audit: { preserved: true, attributedToEditor: true },
}, null, 2));
