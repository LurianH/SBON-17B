# Continuidade da Engenharia no Codespaces

Branch de trabalho: `feat/engenharia`. Nenhuma aplicação de migration ou publicação acompanha este commit.

A documentação de implementação e homologação registra etapas anteriores. O estado mais recente informado pelo responsável é: preflight remoto aprovado, event triggers revisados, ensaio BEGIN/ROLLBACK aprovado e objetos novos ausentes após rollback. A migration oficial permanece com 36 statements e corresponde ao bloco SQL homologado. Ela ainda não foi aplicada definitivamente nesta etapa.

## Ambiente

Utilizar Node 22, conforme `package.json`, e instalar as dependências com `npm ci`.

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Credenciais não acompanham o repositório. Configurar somente no ambiente local, quando autorizado, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Os templates `.env.example` e `.env.test.example` já existentes são referências. Nunca versionar `.env.local`, tokens ou senhas. Não usar service_role no aplicativo.

## Scripts de preparação e testes isolados

O SQL entregue ao usuário permanece em `docs/sql`. Para regenerar o arquivo 02 a partir da migration real e produzir o inventário temporário:

```sh
node scripts/prepare-engineering-editor-files.mjs
```

O gerador não acessa banco. Alterações de terminadores de linha entre Windows/Linux podem mudar SHA-256; comparar sempre os bytes da migration do checkout com o bloco incorporado. Não substituir um arquivo homologado sem revisar a comparação.

Os verificadores opcionais usam PGlite isolado em `tmp/`, sem conexão com Supabase. A dependência temporária não faz parte do build nem é versionada:

```sh
npm install --prefix tmp/db-verification --no-save --no-package-lock @electric-sql/pglite@0.3.14
node scripts/check-engineering-editor-syntax.mjs
node scripts/test-engineering-editor-local.mjs
node scripts/test-engineering-local.mjs
```

Executar o gerador antes do verificador de sintaxe, pois ele produz `tmp/engineering-editor-inventory.json`. O primeiro verificador analisa SQL sem executá-lo. Os outros dois executam somente no PostgreSQL isolado de testes; o teste de RLS usa fixtures locais e faz rollback.

## Próxima etapa, sujeita a autorização

Autenticar a CLI no ambiente escolhido e conferir o histórico/dry-run. A migration nova é `supabase/migrations/20260911183427_add_engineering_projects.sql`, posterior a `20260830183308_increase_weekly_network_precision.sql`.

Não aplicar migration, inserir dados remotos, fazer merge em main ou publicar na Vercel apenas por seguir este documento. Essas ações exigem autorização expressa separada. O commit solicitado nesta etapa serve somente para continuar o desenvolvimento pela branch no GitHub Codespaces.
