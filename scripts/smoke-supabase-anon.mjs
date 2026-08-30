import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Supabase URL ou publishable key ausente.');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  'profiles',
  'contracts',
  'subcontracts',
  'annual_targets',
  'monthly_financials',
  'weekly_progress',
  'projection_cycles',
  'action_plans',
  'audit_logs',
];

for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*').limit(1);

  if (error) {
    if (error.code === '42501' && error.message.includes('permission denied')) {
      continue;
    }

    throw new Error(`${table}: ${error.message}`);
  }

  if (data.length !== 0) {
    throw new Error(`${table}: sessão anônima recebeu dados protegidos.`);
  }
}

console.log(JSON.stringify({ tables, anonymousRls: 'ok' }, null, 2));
