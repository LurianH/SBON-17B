import { createClient } from '@supabase/supabase-js';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SBON_TEST_ADMIN_EMAIL',
  'SBON_TEST_ADMIN_PASSWORD',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);

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

function assert(error) {
  if (error) throw error;
}

const { data: contract, error: contractError } = await db
  .from('contracts')
  .select('id,code,name,contract_value,start_date,end_date,active')
  .eq('code', 'SBON 17B')
  .single();
assert(contractError);

const [profiles, targets, financials, weekly, cycles, actions, audit] = await Promise.all([
  db.from('profiles').select('id,email,full_name,role,active').order('email'),
  db.from('annual_targets').select('id,year,target_economies,created_at,updated_at').eq('contract_id', contract.id).order('year'),
  db.from('monthly_financials').select('id,reference_year,reference_month,amount,notes,active,created_by,created_at,updated_at').eq('contract_id', contract.id).order('reference_year').order('reference_month'),
  db.from('weekly_progress').select('id,reference_date,economies_available,economies_executed,network_approved_m,network_executed_m,active,created_by,created_at,updated_at').eq('contract_id', contract.id).order('reference_date'),
  db.from('projection_cycles').select('id,base_year,base_month,avg_weekly_economies_available,avg_weekly_economies_executed,avg_weekly_network_approved_m,avg_weekly_network_executed_m,calculated_at').eq('contract_id', contract.id).order('base_year').order('base_month'),
  db.from('action_plans').select('id,title,origin,description,action,responsible,due_date,status,created_by,created_at,updated_at').eq('contract_id', contract.id).order('created_at'),
  db.from('audit_logs').select('id,entity,entity_id,action,user_id,created_at,old_data,new_data').order('created_at'),
]);
for (const result of [profiles, targets, financials, weekly, cycles, actions, audit]) assert(result.error);

const entityIds = new Set([
  contract.id,
  ...(targets.data ?? []).map((row) => row.id),
  ...(financials.data ?? []).map((row) => row.id),
  ...(weekly.data ?? []).map((row) => row.id),
  ...(cycles.data ?? []).map((row) => row.id),
  ...(actions.data ?? []).map((row) => row.id),
]);
const relatedAudit = (audit.data ?? []).filter((row) => row.entity_id && entityIds.has(row.entity_id));

console.log(JSON.stringify({
  projectRef: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0],
  contract,
  profiles: profiles.data,
  annualTargets: targets.data,
  monthlyFinancials: financials.data,
  weeklyProgress: weekly.data,
  projectionCycles: cycles.data,
  actionPlans: actions.data,
  audit: {
    totalVisible: audit.data?.length ?? 0,
    relatedToCurrentContractRecords: relatedAudit,
  },
}, null, 2));
