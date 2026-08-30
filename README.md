# SBON 17B — Painel Executivo Vitalux

Aplicação responsiva em Next.js/React/TypeScript com Supabase para acompanhamento financeiro, engenharia, execução, projeções e desvios.

## Instalação

1. Use Node.js 22.13+ e rode `npm install`.
2. No painel Supabase, abra **Connect** (ou Settings → API Keys), copie a Project URL e a Publishable Key `sb_publishable_...`.
3. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Não é necessária service role para o aplicativo.
4. No Supabase, desabilite cadastro público.
5. Execute `npx supabase login`, `npx supabase link --project-ref <PROJECT_REF>`, valide com `npx supabase db push --dry-run` e aplique com `npx supabase db push`.
6. Crie usuários administrativamente e associe cada `auth.users.id` a `profiles`.
7. Rode `npm run dev`.

O `supabase/seed.sql` é opcional e exclusivo para desenvolvimento/homologação. Ele só cria movimentos se já existir um profile ativo. Sem credenciais, os demonstrativos aparecem apenas com `NODE_ENV=development`; com Supabase configurado, banco vazio apresenta “Aguardando definição”, “Aguardando atualização” e “Projeção em formação”, sem zeros artificiais.

## Qualidade

`npm test`, `npm run lint`, `npm run typecheck` e `npm run build`.

Para o teste real de Auth/RLS, configure contas existentes de ADMIN principal, Higor ADMIN, EDITOR, GESTOR e DIRETORIA em `.env.test.local` e execute `npm run test:supabase`. O script valida login, leitura, bloqueios de escrita e auditoria. O cenário `SEM_PROFILE` foi concluído na Fase 3; uma repetição futura deve usar uma conta técnica temporária, nunca uma conta real.

## Vercel

Importe o repositório, defina `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, publique com `npm run build` e adicione a URL final às URLs permitidas do Supabase Auth. Nunca exponha uma service role ou chave `sb_secret_...`.

## Segurança

A migration ativa RLS, grants e RBAC. ADMIN administra; EDITOR altera progresso, financeiro e ações; GESTOR e DIRETORIA leem. Índices parciais evitam duplicidade ativa e triggers registram alterações relevantes em `audit_logs`.
