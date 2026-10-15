// Isolated PostgreSQL only. No Supabase URLs, credentials, production writes or paid services.
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db = new PGlite();
const migrations = (await readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort();
const migration = migrations.find(file => file.endsWith('_localized_works_permanent_history.sql'));
async function snapshot() {
  const names = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  return Promise.all(names.map(async ({tablename}) => [tablename,
    (await db.query(`select to_jsonb(t) as row from public."${tablename}" t order by to_jsonb(t)::text`)).rows]));
}
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const file of migrations.filter(file => file < migration)) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  // Fixture represents the existing linear-water schema; these columns are NOT added by the new migration.
  await db.exec(`alter table public.engineering_projects add column project_type text;
    alter table public.engineering_project_updates add column delivery_status text,
      add column pead_de63_length_m numeric(14,3), add column pead_de110_length_m numeric(14,3);
    insert into auth.users values ('00000000-0000-4000-8000-000000000010');
    insert into public.profiles(id,email,role) values ('00000000-0000-4000-8000-000000000010','original@example.test','ADMIN');
    select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',false);
    insert into public.engineering_project_categories(code,label) values ('WATER_LINEAR','Obras Lineares de Água');
    insert into public.engineering_projects(id,contract_id,municipality,segment_type,project_category,project_name,project_type)
      select '20000000-0000-4000-8000-000000000010',id,'Porangaba','WATER','WATER_LINEAR','Água existente','PE' from public.contracts where code='SBON 17B';
    insert into public.engineering_project_updates(engineering_project_id,reference_date,concept_status,executive_status,
      approved_economies,approved_length_m,delivery_status,pead_de63_length_m,pead_de110_length_m)
      values ('20000000-0000-4000-8000-000000000010','2026-10-13','PENDING','PENDING',18,1234.567,'IN_PROGRESS',1230.123,4.444);
    insert into public.weekly_progress(contract_id,reference_date,economies_executed,network_executed_m)
      select id,'2026-10-13',7,123.456 from public.contracts where code='SBON 17B';`);
  await db.exec(await readFile('sql/02_RELEASE_PRECHECK_READ_ONLY.sql','utf8'));
  const before = await snapshot();
  const existingNames = before.map(([name]) => name);
  const oldPolicies = (await db.query("select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;
  const oldColumns = (await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows;
  await db.exec(`begin;\n${await readFile(`supabase/migrations/${migration}`, 'utf8')}\ncommit;`);
  const after = await snapshot();
  assert.deepEqual(after.filter(([name]) => existingNames.includes(name)), before, 'every pre-existing table row, water quantity and audit row preserved');
  const policies = (await db.query("select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows;
  assert.deepEqual(policies.filter(row => existingNames.includes(row.tablename)), oldPolicies, 'existing access policies preserved');
  const columns = (await db.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows;
  assert.deepEqual(columns.filter(row => oldColumns.some(old => old.table_name === row.table_name)), oldColumns, 'existing tables and views unchanged');
  await db.exec(await readFile('supabase/tests/localized_works_rls.sql', 'utf8'));
  assert.deepEqual(await snapshot(), after, 'test fixtures rolled back; existing and newly migrated data preserved');
  console.log('PASS: additive migration, unchanged Vitalux/linear-water rows/schema/policies, atomic writes, RLS, immutable history, server stamps, views and contract/project validation.');
} finally {await db.close();}
