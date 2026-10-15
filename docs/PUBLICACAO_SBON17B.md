# SBON 17B — entrega e publicação preparada

## Estado da entrega

Continuação da branch `feat/dashboard-gerencial-sbon17b` no repositório `LurianH/SBON-17B`, a partir de `d79aec58751d53f03ed452ea6262b9e3b5dac263`. Foram aproveitados os formulários, o Plano de Ataque, o vínculo de projetos e as RPCs previamente desenvolvidas.

O código está implementado e validado localmente. **A migration não foi aplicada ao Supabase e a versão não foi publicada.** Nenhuma conta, serviço pago, nova prévia, dado de produção ou configuração remota da Vercel foi criada/alterada.

O commit de conclusão foi criado localmente. O envio à branch remota também está pendente: Git sem credencial de gravação e API GitHub respondeu `403 Resource not accessible by integration`. A integração GitHub atual está conectada como `cardoso-higor`; é necessário acesso de gravação efetivo a `LurianH/SBON-17B`.

O Supabase conectado nesta sessão não permite acessar `urydcysiqhixxlvkjyyo`; a Vercel conectada não retorna o projeto SBON. Portanto, inspeção do schema real, aplicação, validação de Auth real e publicação dependem do acesso às contas responsáveis e da autorização expressa para a implantação. Credenciais devem ser configuradas diretamente nas conexões/ambientes, sem envio de senhas ou tokens no chat.

## Alterações concluídas

- Migration aditiva única: `supabase/migrations/20261014170959_localized_works_permanent_history.sql`.
- Três tabelas: frentes do Plano de Ataque, estruturas e snapshots permanentes. Os dois códigos iguais de Conchas permanecem em frentes distintas.
- Cadastro e primeiro snapshot atômicos, inclusive proteção contra cadastro direto sem snapshot inicial.
- Formulários existentes conectados à consulta central, criação e atualização via RPC. A identificação remota usa o UUID realmente carregado do banco, sem presumir que UUID de arquivo/rascunho é registro remoto.
- Consulta do estado atual paginada e histórico permanente paginado com referência, autoria do servidor, datas, projetos, execução, orçamento e dados técnicos.
- ADMIN/EDITOR ativos gravam; GESTOR/DIRETORIA ativos consultam. Modo Diretoria bloqueia edição. Identificação e snapshots não podem ser sobrescritos/apagados, inclusive por alterações futuras de grants.
- O projeto da Engenharia é associado explicitamente quando conhecido e compatível. Sem projeto disponível, o cadastro fica associado à frente canônica; não se criam projetos fictícios nem se inferem aprovações.
- Rascunhos locais v1 e exportação/importação anteriores preservados. Eles não são enviados automaticamente ao banco nem substituídos pela consulta central.
- O painel principal corresponde ao Vitalux original da branch `main`. Código, arquivo de dados e formulários de Obras Lineares de Água permanecem iguais ao ponto de partida.
- `vercel.json` impede deployments automáticos apenas de `feat/dashboard-gerencial-sbon17b`; não interfere na configuração da branch principal. Fonte: https://vercel.com/docs/project-configuration/git-configuration

## Validação executada

| Verificação | Resultado |
| --- | --- |
| Node.js | 22.23.3, compatível com `engines: 22.x` |
| Testes Vitest | 149 testes aprovados em 16 arquivos |
| TypeScript | Aprovado |
| ESLint | Aprovado, sem erros/avisos |
| Next.js 16.3.3 | Build de produção aprovado, integração habilitada apenas na variável local do build |
| PostgreSQL isolado | Migrations, constraints, RLS, grants, views, autoria, transação atômica e histórico aprovados |
| Preservação | Linhas, schema e policies de todas as tabelas preexistentes iguais antes/depois da nova migration |
| Água existente | Fixture com economias, PEAD DE63/DE110, metragem decimal e histórico preservada integralmente |
| Preflight | Consultas executadas em transação READ ONLY |
| Publicação / testes com Auth real | Pendentes de acesso e autorização; não executados |

Os dados usados nos testes SQL são sintéticos, ficam exclusivamente no PostgreSQL isolado e são revertidos. Não executar `supabase/tests/*.sql` em produção. A única dependência acrescentada é PGlite `0.3.14`, para testes locais; as versões anteriores do lockfile foram mantidas.

Comandos locais reproduzíveis:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run test:db:local
npm run build
```

O build pode emitir o aviso preexistente de `metadataBase` para imagens sociais quando não há domínio configurado; não compromete compilação ou as integrações. O layout original foi preservado.

## Pré-requisitos para a liberação autorizada

1. Disponibilizar acesso ao Supabase responsável pelo projeto `urydcysiqhixxlvkjyyo` e ao projeto Vercel existente do repositório `LurianH/SBON-17B` / domínio `sbon-17b.vercel.app`. Confirmar IDs, equipe, branch de produção e commit antes de qualquer alteração.
2. Executar `sql/02_RELEASE_PRECHECK_READ_ONLY.sql`. Conferir PostgreSQL 15+, contrato SBON ativo, funções de perfil/auditoria, tipos de colunas e policies existentes. As três tabelas novas devem estar ausentes; se já houver objetos parciais, parar e comparar, sem apagar ou aplicar rascunhos.
3. Guardar os fingerprints retornados e o backup existente do banco. Conferir particularmente os campos já existentes de Água: `project_type`, `delivery_status`, `pead_de63_length_m`, `pead_de110_length_m`; a nova migration não cria nem modifica esses campos.
4. Receber autorização expressa para aplicar a migration consolidada, ativar a integração no ambiente de produção e publicar. Até esse momento, não executar merge, `db push`, `apply_migration`, deploy ou promoção.

## Sequência após autorização

1. Aplicar **somente** `20261014170959_localized_works_permanent_history.sql` em uma transação, pelo projeto correto. Não executar os rascunhos `sql/*NAO_EXECUTAR.sql`/`MIGRATION_REVISAR_NAO_EXECUTAR.sql` nem repetir migrations antigas. Conferir histórico de migrations antes de optar por CLI.
2. Repetir o preflight e comparar os fingerprints de todas as tabelas anteriores: devem continuar iguais. Inspecionar RLS/grants/triggers/views novos e executar advisors de segurança/performance. Não alterar policies antigas para contornar erros.
3. Usar contas já existentes e configuradas localmente em `.env.test.local` para `npm run verify:localized:read-only`. Esse script verifica login/perfil, leitura dos quatro perfis e bloqueio de leitura anônima; não insere, atualiza ou apaga dados. O script antigo `test:supabase` contém gravações/limpezas e **não deve ser usado nesta liberação**.
4. No projeto Vercel existente, confirmar as variáveis abaixo. O flag público é avaliado no build e exige recompilação; não é uma permissão, que continua sendo imposta por RLS no banco.
5. Publicar o commit revisado no projeto existente após a migration e suas verificações. Se o projeto usa deploy automático de `main`, o merge já é uma publicação de produção e faz parte da autorização; não executar antes dela. Não criar novo projeto, serviço, branch Supabase paga ou prévia Vercel.
6. Verificar a URL existente, login dos quatro perfis, Vitalux original, quantitativos de Água e histórico. Confirmar a persistência recarregando e acessando de outro dispositivo; usar apenas uma atualização real previamente validada, sem cadastros fictícios em produção.

| Variável Vercel | Valor / orientação |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto SBON existente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública já utilizada pelo aplicativo |
| `NEXT_PUBLIC_SITE_URL` | `https://sbon-17b.vercel.app`, após confirmação do domínio existente |
| `NEXT_PUBLIC_SBON17B_LOCALIZED_WORKS_ENABLED` | `true` somente após a migration validada e autorização |
| Runtime / framework | Node 22.x / Next.js; build `npm run build`; instalação `npm ci` |

Nenhuma `service_role`, chave `sb_secret_...`, senha ou token deve ser enviada ao cliente ou commitada. As permissões originais de `/historico` e `audit_logs` permanecem intactas; GESTOR/DIRETORIA consultam o histórico das estruturas pela área de Engenharia.

## Reversão sem perda de dados

Se houver problema na liberação, restaurar a versão anterior do aplicativo e/ou desabilitar o flag com novo build, mediante a autorização de implantação. Manter as novas tabelas e seus snapshots. Não executar DROP, DELETE ou rollback destrutivo da migration depois que houver cadastros reais; o Vitalux anterior não depende dos objetos novos.
