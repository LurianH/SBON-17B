// Isolated PostgreSQL (PGlite) only; this script never connects to Supabase.
// node scripts/test-engineering-local.mjs
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    console.log(`Migration OK: ${file}`);
  }
  await db.exec(await readFile('supabase/tests/engineering_rls.sql', 'utf8'));
  await db.exec(await readFile('supabase/tests/engineering_water_linear_rls.sql', 'utf8'));
  console.log('PASS: Engenharia and Água / Obras Lineares constraints, identity, atomicity, history, audit, grants, RLS and invoker view. Test fixtures rolled back.');
} finally {await db.close();}
