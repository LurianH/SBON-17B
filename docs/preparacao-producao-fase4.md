# Preparação para produção — Fase 4

## Identidade definitiva

- O usuário Auth existente `higorcardoso.eng@gmail.com` foi preservado.
- O profile UUID `be2dd14d-e4e7-4fc5-8be5-666e0eb49148` foi criado como `ADMIN`, `active = true`.
- Nenhum usuário Auth novo foi criado.
- O cenário `SEM_PROFILE` foi concluído na Fase 3. Uma repetição futura deve usar conta técnica temporária.

## Limpeza controlada

O script `scripts/cleanup-homologation.mjs` executa dry-run por padrão e exige a confirmação literal `REMOVER_HOMOLOGACAO_SBON17B` para alterar dados. Antes da execução, ele valida o conjunto completo e interrompe se houver qualquer registro ou valor divergente.

Foram removidos exclusivamente:

- uma meta de 2026 com 15.000 economias;
- oito faturamentos marcados como homologação, de janeiro a agosto de 2026;
- quatro avanços semanais de agosto de 2026;
- o plano `HOMOLOGAÇÃO — Recuperação do avanço físico`.

Não havia ciclos de projeção persistidos. O contrato UUID `7e4acf88-6637-446b-93fc-8245c17aab6e` foi preservado com `code = name = SBON 17B`, `active = true` e `contract_value = NULL`.

Os audit logs foram preservados conforme a orientação de retenção da Fase 3. Os triggers registraram também as exclusões e a limpeza do valor contratual. A partir da produção, esses logs não devem ser limpos como dados descartáveis.

## Estado vazio

O painel não usa zero para representar ausência de informação. Os estados finais incluem `Aguardando definição`, `Aguardando atualização`, `Aguardando primeira atualização`, `Projeção em formação`, `Aguardando dados` e `Sem ações em aberto`.

## Supabase Auth

- Cadastro público: desabilitado.
- Site URL atual: `http://localhost:3000`; não alterada nesta fase.
- Redirect URLs: nenhuma URL final adicionada antes da publicação.
- Proteção contra senhas vazadas: indisponível no plano Free e mantida sem upgrade.

Após o primeiro deploy, definir a Site URL para a URL canônica da aplicação e adicionar somente os Redirect URLs realmente usados. O fluxo atual usa e-mail/senha e não depende de callback OAuth.

## Preparação de publicação

- Framework/build: Vinext sobre Vite, comando `npm run build`.
- Branch de produção recomendada: `main`.
- Variáveis necessárias: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SITE_URL` não é necessário no fluxo atual.
- Não configurar service role, secret key ou credenciais de teste no ambiente publicado.
- O domínio provisório será atribuído somente na próxima fase de publicação.

Nenhum deploy foi executado na Fase 4.
