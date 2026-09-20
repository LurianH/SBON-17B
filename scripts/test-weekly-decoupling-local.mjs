// Isolated PostgreSQL only. No environment credentials or network connections.
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '../tmp/db-verification/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const migration = '20260914124220_decouple_weekly_progress_engineering.sql';
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql') && f < migration).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-000000000001');
    insert into public.profiles(id,email,role) values ('00000000-0000-0000-0000-000000000001','local@example.test','EDITOR');
    insert into public.contracts(id,code,name) values ('10000000-0000-0000-0000-000000000001','TEST','Local');
    select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    insert into public.weekly_progress(contract_id,reference_date,economies_available,economies_executed,network_approved_m,network_executed_m)
    values ('10000000-0000-0000-0000-000000000001','2026-09-01',100,80,123.456,100.123);`);
  const tables = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  const snapshot = async () => Promise.all(tables.map(async ({tablename}) => [tablename, (await db.query(`select to_jsonb(t) as row from public."${tablename}" t order by to_jsonb(t)::text`)).rows]));
  const before = await snapshot();
  const checks = async () => (await db.query("select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.weekly_progress'::regclass and contype='c' order by conname")).rows;
  const oldChecks = await checks();
  await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
  assert.deepEqual(await snapshot(), before, 'all existing public table rows, including audit and weekly history, unchanged');
  assert.deepEqual(await checks(), oldChecks, 'all CHECK constraints preserved');
  const nullable = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='weekly_progress' and is_nullable='YES' order by column_name")).rows;
  assert.deepEqual(nullable.map(r => r.column_name), ['economies_available', 'network_approved_m']);
  await db.exec(`set role authenticated;
    insert into public.weekly_progress(contract_id,reference_date,economies_executed,network_executed_m)
    values ('10000000-0000-0000-0000-000000000001','2026-09-14',120,150.123);`);
  const rows = (await db.query('select reference_date::text,economies_available,network_approved_m::text,economies_executed,network_executed_m::text from public.weekly_progress order by reference_date')).rows;
  assert.equal(rows[0].economies_available, 100);
  assert.equal(rows[0].network_approved_m, '123.456');
  assert.equal(rows[1].economies_available, null);
  assert.equal(rows[1].network_approved_m, null);
  assert.equal(rows[1].network_executed_m, '150.123');
  await assert.rejects(db.exec(`insert into public.weekly_progress(contract_id,reference_date,economies_available,economies_executed,network_executed_m)
    values ('10000000-0000-0000-0000-000000000001','2026-09-15',-1,1,1)`), e => e.code === '23514');
  await assert.rejects(db.exec(`insert into public.weekly_progress(contract_id,reference_date,network_approved_m,economies_executed,network_executed_m)
    values ('10000000-0000-0000-0000-000000000001','2026-09-15',-1,1,1)`), e => e.code === '23514');
  console.log('PASS: incremental migration, all historical rows/audit preserved, CHECKs unchanged, EDITOR execution-only insert and NULL readback, negative legacy values rejected.');
} finally {await db.close();}
