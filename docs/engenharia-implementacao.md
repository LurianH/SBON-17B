# Engenharia — relatório de implementação local

Data: 11/09/2026. Repositório: `LurianH/SBON-17B`. Branch: `feat/engenharia`.

## 1. Diagnóstico e preparação

A pasta inicialmente aberta estava vazia, com Git sem commits em `master` e sem remoto. Foi configurado `origin` para o repositório solicitado, executado `git pull origin main` e criada `feat/engenharia`, a partir de `4680c9936f29084d914afcabf7d8ba456ad404f1`. Não havia mudanças de aplicação preexistentes nessa pasta.

O código atual é Next.js 16.3.3, React 19, TypeScript e Supabase SSR. A autenticação usa clientes SSR e proxy; autorização consulta `profiles.active` e `profiles.role`. As migrations existentes fornecem `private.current_app_role()`, `private.capture_audit()` e `private.touch_updated_at()`.

Já existem `contracts`, `annual_targets`, `annual_target_details`, `weekly_progress`, `weekly_progress_details`, medições financeiras e `audit_logs`. Os detalhes anuais representam metas; os detalhes semanais representam medições por cidade/segmento. Nenhuma dessas estruturas identifica projetos, categorias e suas aprovações históricas. Por isso a nova modelagem reutiliza contrato, enum de segmento, perfis e auditoria, mas mantém projetos independentes das metas e medições. O diagnóstico refere-se ao código/migrations do repositório; não houve inventário do banco remoto.

## 2. Modelagem e campos

Nova migration: `supabase/migrations/20260911183427_add_engineering_projects.sql`, criada pela CLI com `supabase migration new add_engineering_projects`. Nenhuma migration anterior foi alterada.

| Estrutura | Campos |
| --- | --- |
| `engineering_project_categories` | `code`, `label` |
| `engineering_projects` | `id`, `contract_id`, `municipality`, `segment_type`, `project_category`, `project_name`, `active`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| `engineering_project_updates` | `id`, `engineering_project_id`, `reference_date`, `concept_status`, `concept_approved_at`, `executive_status`, `executive_completed_at`, `approved_economies`, `approved_length_m`, `notes`, `created_by`, `created_at` |

As tabelas estão definidas no arquivo local e foram criadas somente no PostgreSQL isolado de testes; **não foram criadas no Supabase remoto**.

Categorias são normalizadas em tabela com FK. `GENERAL` aparece como “Geral”; `STATIC`, como “Estática”. As únicas inserções da migration são essas duas definições de domínio, sem projetos ou valores operacionais fictícios. Novas categorias podem ser cadastradas administrativamente no banco sem adicionar colunas ou alterar enums; a interface carrega o catálogo. O painel desta versão destaca Geral e Estática.

`segment_type` reutiliza `public.target_segment_type` (`WATER`/`SEWER`). A identidade natural de projeto é única por contrato, cidade, segmento, categoria e nome normalizado. A identificação fica imutável para não reclassificar silenciosamente snapshots antigos. A aplicação atualiza status e valores por novos snapshots; o banco permite alterar somente `active` no cadastro para ADMIN/EDITOR.

Economias são inteiros não negativos; metragem é `numeric(14,3)`, não negativa e finita. Ausência permanece `NULL`; zero informado é um dado válido. Datas são obrigatórias para concepção aprovada e executivo finalizado, ausentes nos demais status e não posteriores à referência. Validação de formulário bloqueia negativos, NaN, infinitos, economias fracionárias, datas inválidas e metragem com mais de três casas decimais.

## 3. Histórico, estado vigente e auditoria

Cada atualização insere um snapshot. Nenhum perfil do aplicativo, inclusive ADMIN, recebe UPDATE/DELETE em `engineering_project_updates`. A referência ao projeto não usa exclusão em cascata. Autor e instante são preenchidos pelo servidor, impedindo falsificação pelo formulário.

A view `engineering_current_updates` retorna no máximo um snapshot por projeto, ordenando por `reference_date DESC`, `created_at DESC`, `id DESC`. Um lançamento retroativo permanece no histórico sem substituir uma referência mais nova. A view é `security_invoker`, preservando RLS. Índices cobrem identidade, FKs e consulta do estado vigente.

`create_engineering_project()` cria cadastro e primeiro snapshot em uma única transação. Usa `SECURITY INVOKER`, verifica perfil e mantém RLS. Falha na atualização desfaz também o cadastro. Os triggers existentes de auditoria registram operações relevantes em `audit_logs`; o histórico expandido da Engenharia vem dos próprios snapshots e pode ser lido pelos perfis autorizados sem ampliar acesso geral a `audit_logs`.

Totais são calculados, nunca gravados manualmente. Somente projetos ativos e seu snapshot vigente entram nas somas. O carregamento da página é paginado para evitar truncamento pelo limite padrão de linhas do Supabase. Na soma da metragem, o cálculo usa unidades de milímetro antes de converter para exibição em metros. Totais com dados faltantes são identificados como parciais; ausência completa não vira zero. Percentuais usam o número de projetos ativos da categoria como denominador; sem cadastro, aparecem como “Aguardando cadastro”.

## 4. Rota, navegação e interface

`/engenharia` é uma rota dinâmica SSR, com validação de usuário e perfil antes da leitura. Sem configuração local, mostra aviso de conexão e estados vazios, sem dados demonstrativos nem escrita. Erros de consulta/migration são exibidos como indisponibilidade e não como totais válidos.

A página contém:

- Cards de concepção aprovada e executivo finalizado, separados entre Geral e Estática, com percentual, quantidade e barra discreta.
- Economias e metragem aprovadas de Água, Esgoto e total.
- Cards de Porangaba, Quadra, Pereiras, Tatuí e Conchas, com Água/Esgoto e projetos expansíveis.
- Categoria, status, economias, metragem e última atualização por projeto.
- Histórico sob demanda, paginado, com datas, valores, observações e UUID do responsável.
- Filtros de cidade, segmento, categoria, concepção e executivo, com “Limpar filtros”. Cards e totais refletem o recorte informado.
- Cadastro e atualização com data de referência, status/datas, economias, metragem e observação. Valores existentes são pré-preenchidos ao atualizar. Há validação, bloqueio durante envio, erro e confirmação de sucesso.
- Modo Diretoria iniciado automaticamente para DIRETORIA, sem controles de edição ou histórico operacional. Outros perfis podem ativar uma visão resumida local.

A navegação compartilhada mantém Dashboard, Atualização, Análise, Histórico e Administração segundo `canAccessRoute`, acrescentando Engenharia. O menu também fica acessível em telas pequenas. O Dashboard teve apenas a substituição do menu: consultas, fórmulas, metas e indicadores foram preservados.

Layout segue Vitalux, verde petróleo, fundo claro, bordas suaves e cards. Sem gauges, gradientes ou 3D. Água/Esgoto ficam lado a lado em telas maiores e empilhados no mobile.

## 5. Permissões e RLS

| Perfil ativo | Ler Engenharia | Cadastrar/inserir atualização |
| --- | --- | --- |
| ADMIN | Sim | Sim |
| EDITOR | Sim | Sim |
| GESTOR | Sim | Não |
| DIRETORIA | Sim | Não |
| Perfil inativo/ausente ou anon | Não | Não |

As regras são aplicadas na rota, nos controles e na verificação anterior ao envio, além de grants/policies no banco. RLS usa o helper existente que consulta perfil ativo. `anon` não recebe acesso a tabelas, view ou RPC. Nenhuma chave `service_role` foi introduzida no aplicativo.

## 6. Validação

Validação final com **Node 22.19.0**, atendendo `engines.node: 22.x`. O ambiente originalmente oferecia Node 24 e não tinha npm no PATH; npm e Node 22 foram obtidos somente em `tmp/`. Dependências foram instaladas pelo lockfile com `npm ci`; `package.json` e `package-lock.json` ficaram inalterados. ESLint passou a ignorar `tmp/`, já ignorada no Git, para não analisar o código das ferramentas temporárias.

| Verificação | Resultado |
| --- | --- |
| `npm test` | 76 testes passaram, sendo 42 novos de Engenharia |
| `npm run lint` | Passou, sem erros ou warnings |
| `npm run typecheck` | Passou |
| `npm run build` | Passou; `/engenharia` incluída como rota dinâmica |
| `node scripts/test-engineering-local.mjs` | Passou no PostgreSQL PGlite isolado; todas as migrations aplicadas e fixtures revertidas |
| `git diff --check` | Passou |
| Prévia `/engenharia` | HTTP 200, sem Supabase configurado |
| Desktop/tablet/mobile | Inspeção visual em 1440×1000, 768×1024 e 390×844; largura do documento não excedeu viewport |
| Interações na prévia | Filtro Tatuí restringiu as cidades; limpar restaurou as cinco cidades |

O build ainda mostra o aviso preexistente de `metadataBase` ausente, fora do escopo desta área.

Os testes unitários cobrem somas Água/Esgoto, metragem, cidade, vigente/desempate, duplicação de updates, categorias, projetos inativos, percentuais, estados vazios/parciais, validação e todos os perfis. O SQL local testa RLS/grants, bloqueio de escrita, view invoker, autoria, datas, negativos/NaN, auditoria, preservação do histórico e rollback do cadastro atômico. PGlite verifica PostgreSQL, mas não substitui homologação com Auth e PostgREST reais.

Para repetir o teste SQL isolado:

```sh
npm install --prefix tmp/db-verification --no-save --no-package-lock @electric-sql/pglite@0.3.14
node scripts/test-engineering-local.mjs
```

## 7. Resultado do dry-run e pendências

`npx supabase db push --dry-run` foi tentado e retornou `LegacyProjectNotLinkedError`: falta vínculo local.

Uma segunda tentativa informou explicitamente o ref fornecido, sem vínculo persistente ou atualização de segredos:

```sh
npx supabase db push --dry-run --skip-vault --project-ref urydcysiqhixxlvkjyyo
```

Resultado: `LegacyPlatformAuthRequiredError`, por ausência de autenticação/token da CLI. **O dry-run remoto não foi concluído.** Nenhuma migration ou segredo foi aplicado remotamente.

Pendências para uma próxima etapa autorizada:

1. Autenticar a CLI e repetir o dry-run contra o projeto correto, verificando divergências reais de schema e histórico de migrations.
2. Homologar login, leitura, cadastro, atualização e histórico com Auth/PostgREST e usuários dos quatro perfis em ambiente de teste. A prévia atual valida layout e filtros com estados vazios; não foi realizado envio autenticado pelo navegador.
3. Caso seja necessário mostrar nomes no histórico em vez do UUID do responsável, definir uma projeção segura de nomes. Não foi ampliada a política de leitura de `profiles`, que hoje protege os demais perfis.

Aplicação remota da migration, publicação e decisões sobre integração futura meta → engenharia → execução permanecem fora desta etapa. Não se deve apresentar os dados da nova área como carregados antes da migration e da configuração de acesso.

## 8. Git ao finalizar

Nenhum arquivo foi staged. Sem commit, push ou merge. Sem alterações em Vercel, produção ou dados oficiais.

`git status --short --branch`:

```text
## feat/engenharia
 M app/globals.css
 M app/page.tsx
 M components/AppShell.tsx
 M eslint.config.mjs
 M lib/authorization.ts
?? app/engenharia/
?? components/EngineeringPanel.tsx
?? components/MainNavigation.tsx
?? docs/engenharia-implementacao.md
?? lib/engineering.test.ts
?? lib/engineering.ts
?? scripts/test-engineering-local.mjs
?? supabase/migrations/20260911183427_add_engineering_projects.sql
?? supabase/tests/engineering_rls.sql
```

`git diff --stat` (Git não inclui arquivos novos não rastreados nesse comando):

```text
 app/globals.css         | 3 +++
 app/page.tsx            | 3 ++-
 components/AppShell.tsx | 3 ++-
 eslint.config.mjs       | 2 +-
 lib/authorization.ts    | 1 +
 5 files changed, 9 insertions(+), 3 deletions(-)
```

Além desse diff, há 10 arquivos novos listados pelo status, incluindo página/CSS, componentes, domínio/testes, migration, teste SQL, executor local e este relatório.

Referências consultadas: documentação instalada do Next.js; [RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) e [clientes SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client). A implementação mantém grants e policies e usa view invoker conforme essas orientações.
