// Local files only. Does not execute SQL or connect to Supabase.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export function splitStatements(sql) {
  const statements=[]; let start=0,mode='',tag='',depth=0;
  for(let i=0;i<sql.length;i++) {
    const c=sql[i],next=sql[i+1];
    if(mode==='line'){if(c==='\n')mode='';continue;}
    if(mode==='block'){if(c==='/'&&next==='*'){depth++;i++;}else if(c==='*'&&next==='/'){i++;if(--depth===0)mode='';}continue;}
    if(mode==='single'||mode==='double'){const quote=mode==='single'?"'":'"';if(c===quote){if(next===quote)i++;else mode='';}continue;}
    if(mode==='dollar'){if(sql.startsWith(tag,i)){i+=tag.length-1;mode='';}continue;}
    if(c==='-'&&next==='-'){mode='line';i++;continue;}
    if(c==='/'&&next==='*'){mode='block';depth=1;i++;continue;}
    if(c==="'"){mode='single';continue;}if(c==='"'){mode='double';continue;}
    if(c==='$'){const match=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);if(match){tag=match[0];mode='dollar';i+=tag.length-1;continue;}}
    if(c===';'){const text=sql.slice(start,i+1);if(stripLeadingComments(text).trim())statements.push(text);start=i+1;}
  }
  assert(!mode||mode==='line','SQL com literal/comentário aberto');
  assert(!stripLeadingComments(sql.slice(start)).trim(),'Instrução sem ponto e vírgula final');
  return statements;
}
function stripLeadingComments(s){return s.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/,'');}
const quote=s=>`'${s.replaceAll("'","''")}'`;
const files=(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql'));
const candidates=[];
for(const name of files){const sql=await readFile(`supabase/migrations/${name}`,'utf8');if(/create\s+table\s+(?:public\.)?engineering_(?:projects|project_updates)\b/i.test(sql))candidates.push(name);}
assert.equal(candidates.length,1,`Parar: ${candidates.length} migrations candidatas`);
const migrationPath=`supabase/migrations/${candidates[0]}`,original=await readFile(migrationPath),sql=original.toString('utf8');
const statements=splitStatements(sql).map(stripLeadingComments);
const tables=[],indexes=[],triggers=[],policies=[],functions=[],views=[];
for(const statement of statements){let m;
  if((m=statement.match(/^create\s+table\s+(\w+\.\w+)/i)))tables.push(m[1]);
  if((m=statement.match(/^create\s+(?:unique\s+)?index\s+(\w+)\s+on\s+(\w+)\./i)))indexes.push(`${m[2]}.${m[1]}`);
  if((m=statement.match(/^create\s+view\s+(\w+\.\w+)/i)))views.push(m[1]);
  if((m=statement.match(/^create\s+trigger\s+(\w+)[\s\S]*?\bon\s+(\w+\.\w+)[\s\S]*?execute\s+function\s+(\w+\.\w+\([^)]*\))/i)))triggers.push({name:m[1],table:m[2],function:m[3]});
  if((m=statement.match(/^create\s+policy\s+(\w+)\s+on\s+(\w+\.\w+)\s+for\s+(\w+)/i)))policies.push({name:m[1],table:m[2],command:m[3].toUpperCase()});
  if((m=statement.match(/^create\s+function\s+(\w+\.\w+)\(([^)]*)\)/i)))functions.push(`${m[1]}(${m[2].split(',').filter(Boolean).map(a=>a.trim().split(/\s+/).slice(1).join(' ')).join(',')})`);
}
assert(statements.filter(s=>/^insert\s/i.test(s)).every(s=>/^insert into public\.engineering_project_categories\(/i.test(s)),'INSERT operacional detectado');
assert(!statements.some(s=>/^(?:commit|rollback|begin|vacuum|call)\b/i.test(s)),'Controle transacional ou efeito não previsto na migration');
const tableOids=tables.map(n=>`${quote(n)}::regclass`).join(','),relations=[...tables,...views],hash=createHash('sha256').update(original).digest('hex');
const relationValues=relations.map(n=>`(${quote(n)})`).join(',\n ');
const functionValues=functions.map(n=>`(${quote(n)})`).join(',\n ');
const objectValues=[...relations,...indexes].map(n=>`(${quote(n)})`).join(',\n ');
const triggerValues=triggers.map(t=>`(${quote(t.table)},${quote(t.name)},${quote(t.function)})`).join(',\n ');
const policyValues=policies.map(p=>`(${quote(p.table)},${quote(p.name)},${quote(p.command)})`).join(',\n ');
const validation=`
-- FIM MIGRATION INTEGRAL
-- VALIDAÇÃO SOMENTE LEITURA DOS OBJETOS CRIADOS, AINDA NA TRANSAÇÃO.
-- Não executa RPC, helpers, triggers ou DML de teste. Perfis são valores do app,
-- não papéis SQL. Catálogos não substituem sessões reais de ADMIN/EDITOR/etc.

-- 1. Tabelas/view e RLS: tabelas devem ter relrowsecurity=true.
select e.name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,
 pg_get_userbyid(c.relowner) as owner,c.oid is not null as exists_ok
from (values ${relationValues}) e(name) left join pg_class c on c.oid=to_regclass(e.name);

-- 2. Colunas, tipos, nulabilidade, identidade e defaults.
select a.attrelid::regclass as table_name,a.attnum,a.attname,
 format_type(a.atttypid,a.atttypmod) as data_type,a.attnotnull,a.attidentity,
 pg_get_expr(d.adbin,d.adrelid) as default_expression
from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid in (${tableOids}) and a.attnum>0 and not a.attisdropped order by a.attrelid,a.attnum;

-- 3. Categorias: exclusivamente as duas linhas de domínio da migration.
select code,label from public.engineering_project_categories order by code;

-- 4. Todas as constraints, incluindo CHECKs, PKs e FKs.
select conrelid::regclass as table_name,conname,contype,convalidated,
 pg_get_constraintdef(oid,true) as definition
from pg_constraint where conrelid in (${tableOids}) order by conrelid,conname;

-- 5. Foreign keys destacadas: origem, destino e ações de exclusão/atualização.
select conrelid::regclass as source_table,conname,confrelid::regclass as referenced_table,
 confdeltype,confupdtype,convalidated,pg_get_constraintdef(oid,true) as definition
from pg_constraint where conrelid in (${tableOids}) and contype='f' order by conrelid,conname;

-- 6. Índices explícitos e implícitos das PKs, sem omitir definições.
select indrelid::regclass as table_name,indexrelid::regclass as index_name,
 indisunique,indisprimary,indisvalid,indisready,pg_get_indexdef(indexrelid) as definition
from pg_index where indrelid in (${tableOids}) order by indrelid,indexrelid;

-- 7. Triggers explícitos e internos; vínculos da auditoria.
select tgrelid::regclass as table_name,tgname,tgenabled,tgisinternal,
 tgfoid::regprocedure as function_name,pg_get_triggerdef(oid,true) as definition
from pg_trigger where tgrelid in (${tableOids}) order by tgrelid,tgname;
select e.*,t.tgfoid=to_regprocedure(e.expected_function) as binding_ok,t.tgenabled
from (values ${triggerValues}) e(table_name,trigger_name,expected_function)
left join pg_trigger t on t.tgrelid=to_regclass(e.table_name) and t.tgname=e.trigger_name;

-- 8. Policies: expressões completas para conferir perfis e autoria.
select e.table_name,e.policy_name,e.expected_command,p.cmd,p.roles,p.permissive,p.qual,p.with_check,
 p.cmd=e.expected_command as command_ok,p.roles=array['authenticated'::name] as target_ok
from (values ${policyValues}) e(table_name,policy_name,expected_command)
left join pg_policies p on p.schemaname=split_part(e.table_name,'.',1)
 and p.tablename=split_part(e.table_name,'.',2) and p.policyname=e.policy_name;

-- 9. Grants efetivos de tabela e de coluna: verificar UPDATE apenas em active.
select r.rolname,e.name as object_name,
 has_table_privilege(r.oid,to_regclass(e.name),'SELECT') as can_select,
 has_table_privilege(r.oid,to_regclass(e.name),'INSERT') as can_insert,
 has_table_privilege(r.oid,to_regclass(e.name),'UPDATE') as table_update,
 has_table_privilege(r.oid,to_regclass(e.name),'DELETE') as can_delete,
 has_table_privilege(r.oid,to_regclass(e.name),'TRUNCATE') as can_truncate
from pg_roles r cross join (values ${relationValues}) e(name)
where r.rolname in ('anon','authenticated') order by r.rolname,e.name;
select a.attrelid::regclass as table_name,a.attname,
 has_column_privilege('authenticated',a.attrelid,a.attnum,'INSERT') as can_insert,
 has_column_privilege('authenticated',a.attrelid,a.attnum,'UPDATE') as can_update
from pg_attribute a where a.attrelid in (${tableOids}) and a.attnum>0 and not a.attisdropped
order by a.attrelid,a.attnum;

-- 10. Funções novas e ACLs: RPC/stamp invoker; não executar funções.
select e.signature,p.oid is not null as exists_ok,p.prosecdef,p.proconfig,p.proacl,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,pg_get_functiondef(p.oid) as definition
from (values ${functionValues}) e(signature) left join pg_proc p on p.oid=to_regprocedure(e.signature);

-- 11. Conferência de ausência de projetos/snapshots. Esperado: true/true.
select not exists(select 1 from public.engineering_projects) as projects_empty,
 not exists(select 1 from public.engineering_project_updates) as updates_empty;

ROLLBACK;

-- PÓS-ROLLBACK: APENAS SELECT. Estas consultas não criam uma nova transação de DDL.
-- Esperado: absent_ok=true em todas as linhas, com os objetos ausentes antes do teste.
select e.name,to_regclass(e.name) as remaining_oid,to_regclass(e.name) is null as absent_ok
from (values ${objectValues}) e(name);
select e.signature,to_regprocedure(e.signature) as remaining_oid,
 to_regprocedure(e.signature) is null as absent_ok
from (values ${functionValues}) e(signature);
select e.name,to_regtype(e.name) as remaining_type,to_regtype(e.name) is null as absent_ok
from (values ${relationValues}) e(name);
select e.table_name,e.trigger_name,not exists(select 1 from pg_trigger t
 where t.tgrelid=to_regclass(e.table_name) and t.tgname=e.trigger_name) as absent_ok
from (values ${triggerValues}) e(table_name,trigger_name,expected_function);
select e.table_name,e.policy_name,not exists(select 1 from pg_policy p
 where p.polrelid=to_regclass(e.table_name) and p.polname=e.policy_name) as absent_ok
from (values ${policyValues}) e(table_name,policy_name,expected_command);
-- Esperado: nenhuma constraint nem índice implícito de PK restante nas tabelas novas.
select c.conname,c.conrelid::regclass from pg_constraint c
where c.conrelid in (select to_regclass(e.name) from (values ${relationValues}) e(name));
-- O bloco de alterações terminou obrigatoriamente em ROLLBACK; acima, apenas SELECTs posteriores.
`;
await mkdir('docs/sql',{recursive:true});
await mkdir('tmp',{recursive:true});
const header=`BEGIN;
-- Execução manual integral, somente após preflight revisado.
-- Não executar a seleção isolada da migration e não trocar ROLLBACK por COMMIT.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
-- INICIO MIGRATION INTEGRAL: ${migrationPath}
-- SHA256 ${hash}; ${statements.length} statements de topo.
`;
await writeFile('docs/sql/engenharia-02-migration-rollback.sql',Buffer.concat([Buffer.from(header),original,Buffer.from(validation)]));
const inventory={migrationPath,sha256:hash,statementCount:statements.length,tables,views,functions,indexes,triggers,policies};
await writeFile('tmp/engineering-editor-inventory.json',JSON.stringify(inventory,null,2));
console.log(JSON.stringify(inventory,null,2));
