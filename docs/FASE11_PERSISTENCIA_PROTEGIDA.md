# Fase 11 — Validação de registros e barreira de gravação

Os novos arquivos são **isolados**: não substituem nem reconfiguram o dashboard, a Engenharia, ou o Supabase.

## O que foi implementado
- Entrada tipada de obras localizadas com validação Zod.
- Vinculação da estrutura por `rowKey` do Plano de Ataque 2026, e não por ID textual. Resolve a duplicidade `271_AR_0001N` sem inventar novos códigos.
- Checagem da compatibilidade de sistema: EEE em Esgoto, Booster e Reservatório em Água.
- Campos financeiros omitidos para impedir qualquer valor fictício.
- Barreira explícita: `saveLocalizedWorkRemotely` retorna `blocked` e não usa cliente Supabase.
- Sete testes unitários cobrindo segurança e validação.

## Como instalar e testar
`unzip -o SBON17B_FASE11_PERSISTENCIA_PROTEGIDA.zip && npm run typecheck && npx vitest run lib/localized-works-persistence.test.ts`

## Situação do projeto
Esta é **a fundação do serviço**, não um cadastro persistente funcionando. Ainda falta uma migration aprovada, regras RLS verificadas, service server-side e sua integração no formulário. Não executar SQL nem habilitar escrita no banco de produção.
