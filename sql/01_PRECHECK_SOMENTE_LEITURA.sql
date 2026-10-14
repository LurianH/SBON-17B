-- SBON 17B | PRECHECK SOMENTE LEITURA -- NÃO ALTERA O BANCO
-- Execute em SQL Editor apenas se desejar confirmar a estrutura existente.
-- Cada SELECT consulta metadados e não retorna senhas, tokens ou dados pessoais.
select current_database() as database_name, current_schema() as current_schema;
select table_schema, table_name
from information_schema.tables
where table_schema='public' and table_name in
('contracts','engineering_projects','engineering_project_updates',
 'engineering_localized_works','engineering_localized_work_updates')
order by table_name;
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name in
('engineering_projects','engineering_project_updates','engineering_localized_works','engineering_localized_work_updates')
order by table_name, ordinal_position;
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('engineering_projects','engineering_project_updates','engineering_localized_works','engineering_localized_work_updates');
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename in
('engineering_projects','engineering_project_updates','engineering_localized_works','engineering_localized_work_updates')
order by tablename, policyname;
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='current_app_role';
