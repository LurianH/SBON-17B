-- PREPARAÇÃO LOCAL: arquivo mantido/recriado a partir do inventário de Engenharia.
-- O usuário informou que já executou o preflight remoto; não foi repetido nesta etapa.
-- Para futura conferência manual: executar somente este arquivo e revisar TODOS os resultados.
-- Somente SELECTs sobre catálogos. Não executa helpers, RPCs ou triggers.
-- Objetos novos homônimos em public/private: interromper, não apagar nada.

-- 01. Ambiente, privilégios do executor e versão mínima.
select current_database() as database_name, current_user as executor,
       current_setting('server_version') as postgres_version,
       current_setting('server_version_num')::int >= 150000 as supports_invoker_view,
       current_setting('search_path') as search_path,
       current_setting('session_replication_role') as replication_role;
select rolname, rolsuper, rolbypassrls, rolinherit
from pg_roles where rolname in (current_user, 'anon', 'authenticated');
select nspname, pg_get_userbyid(nspowner) as owner, nspacl
from pg_namespace where nspname in ('public','private','auth','supabase_migrations');

-- 02. Relações homônimas: tabelas, views, índices e sequências compartilham nomes.
select n.nspname as schema_name, c.relname, c.relkind,
       pg_get_userbyid(c.relowner) as owner, c.relrowsecurity, c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relname like 'engineering\_%' escape '\'
order by n.nspname,c.relname;

-- 03. Tipos/enums: a migration NÃO cria enum; usa target_segment_type existente.
-- CREATE TABLE/VIEW também cria tipo composto: verificar nomes conflitantes.
select n.nspname as schema_name,t.typname,t.typtype,
       array(select e.enumlabel from pg_enum e where e.enumtypid=t.oid order by e.enumsortorder) as enum_values
from pg_type t join pg_namespace n on n.oid=t.typnamespace
where t.typname in ('app_role','target_segment_type','engineering_project_categories',
 'engineering_projects','engineering_project_updates','engineering_current_updates')
order by n.nspname,t.typname;

-- 04. Funções existentes, inclusive overloads e definições dos helpers.
-- Conferir capture_audit: somente INSERT em audit_logs; sem rede/dblink/etc.
select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result,pg_get_userbyid(p.proowner) as owner,
       l.lanname,p.prosecdef,p.provolatile,p.proconfig,p.proacl,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
where p.prokind='f' and (p.proname in ('stamp_engineering','create_engineering_project')
 or (n.nspname='private' and p.proname in ('current_app_role','capture_audit','touch_updated_at'))
 or (n.nspname='auth' and p.proname='uid') or p.proname='gen_random_uuid')
order by n.nspname,p.proname,arguments;
select signature,to_regprocedure(signature) as resolved_function
from (values ('private.current_app_role()'),('private.capture_audit()'),
 ('private.touch_updated_at()'),('auth.uid()'),('gen_random_uuid()')) s(signature);

-- 05. Colunas: conflitos novos e dependências existentes, sem ler dados pessoais.
select n.nspname as schema_name,c.relname,a.attname,
       format_type(a.atttypid,a.atttypmod) as data_type,a.attnotnull,a.attidentity,
       pg_get_expr(d.adbin,d.adrelid) as default_expression
from pg_attribute a join pg_class c on c.oid=a.attrelid
join pg_namespace n on n.oid=c.relnamespace
left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attnum>0 and not a.attisdropped and
 ((n.nspname='public' and (c.relname like 'engineering\_%' escape '\'
   or c.relname in ('contracts','profiles','audit_logs')))
  or (n.nspname='auth' and c.relname='users'))
order by n.nspname,c.relname,a.attnum;
with expected(table_name,column_name) as (values
 ('public.contracts','id'),('public.contracts','active'),('auth.users','id'),
 ('public.profiles','id'),('public.profiles','role'),('public.profiles','active'),
 ('public.audit_logs','id'),('public.audit_logs','user_id'),('public.audit_logs','entity'),
 ('public.audit_logs','entity_id'),('public.audit_logs','action'),('public.audit_logs','old_data'),
 ('public.audit_logs','new_data'),('public.audit_logs','created_at'))
select e.*,exists(select 1 from pg_attribute a where a.attrelid=to_regclass(e.table_name)
 and a.attname=e.column_name and a.attnum>0 and not a.attisdropped) as exists_ok from expected e;

-- 06. Constraints/FKs: inclui PKs referenciadas e novas eventuais homônimas.
select n.nspname as schema_name,c.relname,k.conname,k.contype,k.convalidated,
       k.confrelid::regclass as referenced_table,pg_get_constraintdef(k.oid,true) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and (c.relname like 'engineering\_%' escape '\'
 or c.relname in ('contracts','profiles','audit_logs')))
 or (n.nspname='auth' and c.relname='users')
order by n.nspname,c.relname,k.conname;

-- 07. Índices novos homônimos e índices das tabelas dependentes.
select n.nspname as schema_name,c.relname as table_name,i.relname as index_name,
       x.indisunique,x.indisvalid,pg_get_indexdef(i.oid) as definition
from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid
join pg_namespace n on n.oid=c.relnamespace
where i.relname like 'engineering\_%' escape '\'
 or (n.nspname='public' and c.relname in ('contracts','profiles','audit_logs'))
 or (n.nspname='auth' and c.relname='users') order by n.nspname,c.relname,i.relname;

-- 08. Triggers de linha/statement: includes internos de FKs e audit_logs.
select n.nspname as schema_name,c.relname,t.tgname,t.tgenabled,t.tgisinternal,
       t.tgfoid::regprocedure as function_name,pg_get_triggerdef(t.oid,true) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where t.tgname like '%engineering%' or c.relname like 'engineering\_%' escape '\' or (n.nspname='public' and c.relname in ('contracts','profiles','audit_logs'))
 or (n.nspname='auth' and c.relname='users') order by n.nspname,c.relname,t.tgname;

-- 09. Policies existentes/homônimas: helper e auditoria dependem das atuais.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where policyname like 'engineering\_%' escape '\' or tablename like 'engineering\_%' escape '\'
 or (schemaname='public' and tablename in ('contracts','profiles','audit_logs'))
order by schemaname,tablename,policyname;

-- 10. Dependências de catálogo da auditoria e funções dependentes dela.
-- PL/pgSQL em string não registra todas as referências no pg_depend:
-- revisar também o corpo completo no resultado 04 e os triggers no 08.
select 'outgoing' as direction,pg_describe_object(d.classid,d.objid,d.objsubid) as object,
       pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) as dependency,d.deptype
from pg_depend d where d.classid='pg_proc'::regclass and d.objid=to_regprocedure('private.capture_audit()')
union all
select 'incoming',pg_describe_object(d.classid,d.objid,d.objsubid),
       pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),d.deptype
from pg_depend d where d.refclassid='pg_proc'::regclass and d.refobjid=to_regprocedure('private.capture_audit()');
select s.oid::regclass as audit_identity_sequence,a.attname,d.deptype
from pg_depend d join pg_class s on s.oid=d.objid and d.classid='pg_class'::regclass
join pg_attribute a on a.attrelid=d.refobjid and a.attnum=d.refobjsubid
where s.relkind='S' and d.refclassid='pg_class'::regclass
 and d.refobjid=to_regclass('public.audit_logs') and a.attname='id';

-- 11. Acesso aos helpers/schema para o papel real das sessões da aplicação.
select r.rolname,p.oid::regprocedure as function_name,has_function_privilege(r.oid,p.oid,'EXECUTE') as execute_allowed
from pg_roles r cross join pg_proc p
where r.rolname in ('anon','authenticated') and p.oid in
 (to_regprocedure('private.current_app_role()'),to_regprocedure('private.capture_audit()'),
  to_regprocedure('private.touch_updated_at()'),to_regprocedure('auth.uid()'))
order by r.rolname,function_name;
select r.rolname,n.nspname,has_schema_privilege(r.oid,n.oid,'USAGE') as usage_allowed
from pg_roles r cross join pg_namespace n
where r.rolname in ('anon','authenticated') and n.nspname in ('public','private','auth');

-- 12. IMPORTANTE: event triggers de DDL podem rodar durante a migration.
-- Não os desativar. Revisar chamadas indiretas e efeitos externos antes do teste.
select e.evtname,e.evtevent,e.evtenabled,e.evttags,e.evtfoid::regprocedure as function_name,
       pg_get_userbyid(e.evtowner) as owner,pg_get_functiondef(e.evtfoid) as function_definition
from pg_event_trigger e order by e.evtname;
select extname,extversion from pg_extension order by extname;
select pg_get_userbyid(d.defaclrole) as owner,n.nspname,d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace;

-- 13. Locks existentes nas referências; fotografia, não garantia de ausência futura.
select l.pid,n.nspname,c.relname,l.mode,l.granted
from pg_locks l join pg_class c on c.oid=l.relation join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='auth' and c.relname='users') or (n.nspname='public' and c.relname='contracts')
order by n.nspname,c.relname,l.pid;

-- PARAR e revisar resultados antes de executar o arquivo 02.
