// Apenas PostgreSQL isolado já instalado em tmp/. Nunca conecta ao remoto.
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../tmp/db-verification/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&!f.includes('add_engineering_projects')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
  }
  // Fingerprint lógico de todas as tabelas públicas/auth anteriores, sem mostrar dados.
  const tables=(await db.query(`select quote_ident(n.nspname)||'.'||quote_ident(c.relname) as name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','auth') and c.relkind='r' order by 1`)).rows;
  async function snapshot(){
    const result={};
    for(const {name} of tables) result[name]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as data from ${name} t`)).rows[0].data;
    return result;
  }
  const before=await snapshot();
  const preflight=await readFile('docs/sql/engenharia-01-preflight-readonly.sql','utf8');
  // READ ONLY impõe que o preflight não escreva no banco.
  await db.exec('BEGIN READ ONLY');
  const preflightResults=await db.exec(preflight);
  await db.exec('ROLLBACK');
  console.log(`Preflight OK: ${preflightResults.length} consultas em transação READ ONLY.`);
  const script=await readFile('docs/sql/engenharia-02-migration-rollback.sql','utf8');
  const migration=await readFile('supabase/migrations/20260911183427_add_engineering_projects.sql','utf8');
  assert(script.includes(migration),'migration integral deve estar inalterada');
  assert(script.startsWith('BEGIN;')&&/^ROLLBACK;\r?$/m.test(script));
  const results=await db.exec(script);
  const rows=results.flatMap(r=>r.rows??[]);
  for(const flag of ['exists_ok','binding_ok','command_ok','target_ok','absent_ok']) {
    const checked=rows.filter(row=>Object.hasOwn(row,flag));
    assert(checked.length>0,`Verificações ausentes: ${flag}`);
    assert(checked.every(row=>row[flag]===true),`Verificação falhou: ${flag}`);
  }
  const categories=rows.filter(row=>Object.hasOwn(row,'code')&&Object.hasOwn(row,'label'));
  assert.deepEqual(categories,[{code:'GENERAL',label:'Geral'},{code:'STATIC',label:'Estática'}]);
  const remaining=(await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname like 'engineering_%'
    union all select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname='stamp_engineering')
      or (n.nspname='public' and p.proname='create_engineering_project')`)).rows;
  assert.equal(remaining.length,0,'rollback deve remover todos os objetos novos');
  assert.deepEqual(await snapshot(),before,'dados anteriores devem permanecer iguais');
  console.log('PASS: migration integral, 3 tabelas, 2 categorias, constraints/índices/triggers/RLS/policies/grants; rollback remove objetos e preserva dados anteriores. Nenhum usuário ou dado operacional inserido pelo teste.');
} finally {await db.close();}
