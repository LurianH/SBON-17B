# Engenharia — preparação local para SQL Editor

## Ambiente e origem

Esta preparação foi realizada no workspace efetivamente acessível:
`C:\Users\Lurian Taina\Documents\ChatGPT\SBON 17B`, branch `feat/engenharia`.
Esta sessão não está conectada a um Codespace. A pasta `docs/sql` já existia aqui e os três arquivos solicitados foram atualizados. Nada foi transferido para outro ambiente.

Única migration candidata da nova área:
`supabase/migrations/20260911183427_add_engineering_projects.sql`.
A ocorrência de “engenharia” em `202608290001_initial_sbon17b.sql` é apenas o valor do enum legado `action_origin`, não uma segunda migration candidata da área.

A fonte exclusiva do bloco funcional do arquivo 02 é a migration real encontrada no disco. Não foi reconstruída de memória, de texto de conversa ou de SQL remoto.

SHA-256 da migration original e do bloco copiado:
`781df1dbc07c7388f2c1875b2d3f7de421477c3299bf0280a199dac2f668a24b`.

## Arquivos

1. `engenharia-01-preflight-readonly.sql`: documentação das consultas somente leitura de inventário, helpers, dependências e event triggers. Não executado nesta etapa.
2. `engenharia-02-migration-rollback.sql`: BEGIN, limites locais, migration integral, SELECTs de validação, ROLLBACK e SELECTs de confirmação de ausência. Não executado nesta etapa.
3. Este arquivo de instruções.
4. `engenharia-validacao-local.json`: evidência da contagem, comparação byte a byte e análise sintática sem execução.

O usuário informou que já executou manualmente o preflight remoto: apenas event triggers normais Supabase/PostgREST, nenhum impedimento identificado e zero linhas de locks nas tabelas consultadas. Esse resultado foi recebido como informação do usuário, não como uma nova verificação remota. Ausência de locks naquele momento não garante ausência no momento do teste.

## Inventário da migration real

**36 statements de topo**, contando CREATE FUNCTION inteiro como uma instrução. Os pontos e vírgulas internos aos corpos das funções não entram separadamente na contagem.

| Tipo de statement | Quantidade |
| --- | ---: |
| CREATE TABLE | 3 |
| INSERT de categorias | 1 |
| CREATE INDEX, incluindo UNIQUE | 6 |
| ALTER TABLE ENABLE ROW LEVEL SECURITY | 3 |
| CREATE POLICY | 6 |
| CREATE FUNCTION | 2 |
| CREATE TRIGGER | 5 |
| CREATE VIEW | 1 |
| GRANT | 5 |
| REVOKE | 4 |
| Total | 36 |

Tabelas:

- `public.engineering_project_categories`: code e label; domínio Geral/Estática.
- `public.engineering_projects`: identificação, contrato, cidade, segmento, categoria, nome, active, datas e autores.
- `public.engineering_project_updates`: projeto, referência, status/datas de concepção e executivo, economias, metragem, observação, autor e instante.

Não cria enum novo. Reutiliza `public.target_segment_type` (WATER/SEWER). Criação de tabelas/view também cria os tipos compostos correspondentes.

Há 13 CHECKs e três PKs. Os CHECKs tratam formato de categoria, texto obrigatório, municípios admitidos, status PENDING/IN_PROGRESS/APPROVED e PENDING/IN_PROGRESS/COMPLETED, economias não negativas, metragem numeric(14,3) não negativa e finita, tamanho de observação, presença coerente de datas e datas até a referência.

Seis FKs:

- projects.contract_id → contracts.id;
- projects.project_category → engineering_project_categories.code;
- projects.created_by e projects.updated_by → auth.users.id;
- updates.engineering_project_id → engineering_projects.id;
- updates.created_by → auth.users.id.

Seis índices explícitos: engineering_projects_identity_idx (UNIQUE), engineering_projects_category_idx, engineering_projects_created_by_idx, engineering_projects_updated_by_idx, engineering_updates_current_idx e engineering_updates_created_by_idx. Somados aos três índices implícitos de PK, são nove índices esperados.

Cinco triggers explícitos:

- stamp_engineering_projects e stamp_engineering_updates → private.stamp_engineering();
- touch_engineering_projects → private.touch_updated_at();
- audit_engineering_projects e audit_engineering_updates → private.capture_audit().

Os triggers internos das FKs são criados pelo PostgreSQL e também aparecem na consulta de inventário. A função de auditoria existente não é redefinida nem invocada por este ensaio sem dados operacionais.

Funções novas: `private.stamp_engineering()` e `public.create_engineering_project(uuid,jsonb,jsonb)`, ambas invoker. A RPC só é definida, não executada pelo script.

View: `public.engineering_current_updates`, com security_invoker=true. Retorna o snapshot vigente por referência, instante e UUID.

RLS habilitada nas três tabelas. Policies:

- engineering_categories_read, engineering_projects_read e engineering_updates_read: leitura ADMIN/EDITOR/GESTOR/DIRETORIA ativos;
- engineering_projects_insert e engineering_updates_insert: inserção ADMIN/EDITOR, autoria e contrato/projeto ativo;
- engineering_projects_update: ADMIN/EDITOR, autoria da atualização, com USING e WITH CHECK.

Grants para authenticated: SELECT nas tabelas e view; INSERT em projetos/updates; UPDATE somente na coluna active do projeto; EXECUTE na RPC. Sem UPDATE/DELETE dos snapshots, mesmo para ADMIN do aplicativo. Revokes retiram acesso de PUBLIC/anon/authenticated antes dos grants seletivos e retiram EXECUTE público da função de trigger. Categorias não recebem manutenção por usuários do app.

## Estrutura e uso futuro do script 02

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
-- migration real integral
-- SELECTs de validação de todos os objetos
ROLLBACK;
-- somente SELECTs para comprovar a ausência dos objetos novos
```

Interpretação das instruções solicitadas: o bloco de alterações termina obrigatoriamente com ROLLBACK; o arquivo continua apenas com as consultas somente leitura expressamente pedidas após o rollback. Não há COMMIT, DDL ou DML depois dele.

Os únicos INSERTs executáveis de topo do ensaio são os da própria migration para GENERAL/Geral e STATIC/Estática. Não há INSERT de usuário, projeto, snapshot ou outro dado operacional. Os INSERTs escritos dentro do corpo da RPC não são executados ao criar a função.

Executar manualmente o arquivo inteiro em uma submissão/sessão. Nunca executar somente uma seleção de DDL sem BEGIN/ROLLBACK. Nunca trocar ROLLBACK por COMMIT neste arquivo.

As consultas antes do rollback exibem tabelas, RLS, colunas/defaults, categorias, constraints, FKs, índices, triggers e vínculo de auditoria, policies completas, grants efetivos por tabela/coluna e funções. Avaliar exists_ok, binding_ok, command_ok e target_ok e as definições completas.

As consultas posteriores esperam absent_ok=true para relações, funções, tipos compostos, triggers e policies. A consulta de constraints remanescentes deve retornar zero linhas. Índices e grants dependentes das tabelas desaparecem com elas. Esses resultados pressupõem que os objetos estavam ausentes antes do ensaio e não foram criados simultaneamente por terceiros.

Verificar catálogos não equivale a homologar sessões reais dos quatro perfis. O executor privilegiado do SQL Editor pode contornar RLS. Não há impersonação de usuário nem substituição de helpers nestes arquivos.

## Ressalvas

Todos os comandos presentes aceitam uma transação PostgreSQL. Não existe CREATE INDEX CONCURRENTLY, VACUUM, CREATE DATABASE, COMMIT intermediário ou chamada externa explícita.

As FKs podem adquirir SHARE ROW EXCLUSIVE nas referências `auth.users` e `public.contracts`, bloqueando gravações até o rollback. O lock_timeout reduz a espera por obtenção de locks, não elimina o impacto de locks já obtidos. statement_timeout limita cada instrução, não necessariamente o lote inteiro. Não deixar a transação aberta durante a leitura manual de resultados.

Se ocorrer erro/cancelamento e a sessão continuar aberta, emitir ROLLBACK nessa mesma sessão. Uma nova conexão não desfaz a transação anterior; o timeout de sessão ociosa ajuda a limitar retenção de locks.

Event triggers instalados no banco podem executar código durante DDL. A revisão manual informada pelo usuário reduz essa incerteza, mas logs, efeitos externos e consumo de sequências eventualmente provocado por automações não são universalmente revertidos. Nenhuma auditoria operacional é disparada no caminho previsto da migration sem projetos/snapshots.

Dependências remotas não foram verificadas novamente: tabelas referenciadas, enum, helpers e respectivos owners/grants, estrutura de audit_logs e PostgreSQL >=15 para a view invoker. Nomes novos preexistentes exigem investigação; não apagar objetos para fazer o ensaio passar.

## Validação local desta preparação

- Contagem lexical respeitando strings, comentários e blocos dollar-quoted: 36 statements.
- Bloco copiado encontrado exatamente uma vez; igualdade byte a byte e SHA-256 confirmadas.
- BEGIN inicial, um ROLLBACK e somente SELECTs posteriores confirmados.
- Gramática SQL externa da migration, do preflight e do arquivo 02 analisada pelo parser PostgreSQL local já instalado, sem enviar mensagens Query/Bind/Execute.
- Resultado: aprovado. Nenhum desses scripts SQL foi executado, nem local nem remotamente, nesta etapa.
- Limite: o Parse não resolve dependências remotas nem recompila corpos PL/pgSQL, preservados integralmente. Não se apresenta essa verificação como execução da migration ou homologação funcional.

Gerador local: `scripts/prepare-engineering-editor-files.mjs`.
Verificador sem execução SQL: `scripts/check-engineering-editor-syntax.mjs`.
As ferramentas já estavam disponíveis; nenhuma instalação foi necessária.

Sem db push, acesso ao Supabase remoto, commit, push, deploy ou alteração de produção. Parar após entregar os arquivos.
