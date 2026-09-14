// Análise local, SEM executar os scripts SQL (nem mesmo em banco local).
// Envia somente mensagem Parse + Sync ao parser PostgreSQL já disponível.
// Não usa Query, Bind ou Execute. Sem conexão externa e sem instalar dependências.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PGlite,protocol} from '../tmp/db-verification/node_modules/@electric-sql/pglite/dist/index.js';

const inventory=JSON.parse(await readFile('tmp/engineering-editor-inventory.json','utf8'));
const original=await readFile(inventory.migrationPath);
const script=await readFile('docs/sql/engenharia-02-migration-rollback.sql');
const index=script.indexOf(original);
assert(index>=0&&script.indexOf(original,index+1)===-1,'Migration deve ocorrer integralmente uma única vez');
assert.equal(createHash('sha256').update(script.subarray(index,index+original.length)).digest('hex'),inventory.sha256);
const content=script.toString('utf8');
assert(content.startsWith('BEGIN;'));
assert.equal((content.match(/^ROLLBACK;\r?$/gm)??[]).length,1,'Um único ROLLBACK obrigatório');
const after=content.slice(content.indexOf('\nROLLBACK;')+'\nROLLBACK;'.length).replace(/--[^\n]*/g,'').trim();
assert(after.startsWith('select '),'Consultas pós-rollback ausentes');
const afterWithoutLiterals=after.replace(/'(?:''|[^'])*'/g,"''");
assert(!/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|DO|CALL)\b/i.test(afterWithoutLiterals), 'Pós-rollback deve ser somente leitura');
const pg=new PGlite();
const checks=[];
try {
  await pg.waitReady;
  // O parser lê o lote inteiro antes de rejeitar múltiplos comandos em Parse.
  // Essa rejeição esperada comprova gramática SQL externa; nenhum Execute é enviado.
  // Não comprova resolução de objetos, tipos ou compilação de corpos PL/pgSQL.
  for(const file of [inventory.migrationPath,'docs/sql/engenharia-01-preflight-readonly.sql','docs/sql/engenharia-02-migration-rollback.sql']) {
    const sql=await readFile(file,'utf8');
    const response=await pg.execProtocol(Buffer.concat([
      protocol.serialize.parse({text:sql}),protocol.serialize.sync()
    ]),{throwOnError:false});
    const errors=response.messages.filter(m=>m.name==='error');
    assert.equal(errors.length,1,`Resposta inesperada do parser: ${file}`);
    assert.equal(errors[0].message,'cannot insert multiple commands into a prepared statement',`Erro sintático inesperado em ${file}: ${errors[0].message}`);
    checks.push({file,grammar:'PASS',sqlExecuted:false});
  }
} finally {await pg.close();}
const report={migration:inventory.migrationPath,statements:inventory.statementCount,sha256:inventory.sha256,
  exactBytesPreserved:true,begin:true,rollback:true,afterRollback:'SELECT only',checks,
  limitation:'Somente gramática SQL externa. Não executa scripts nem resolve dependências remotas; corpos PL/pgSQL originais preservados, não recompilados nesta etapa.'};
await writeFile('docs/sql/engenharia-validacao-local.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
