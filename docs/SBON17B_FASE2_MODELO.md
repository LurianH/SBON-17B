# SBON 17B — Fase 2: cadastro de manchas e quantitativos

**Estado:** modelo de validação em TypeScript, sem persistência. Nenhuma migration é incluída nesta entrega.

## O que entra nesta fase
- Identificação do projeto por ID da mancha, município e sistema (Água ou Esgoto).
- Trechos de rede individualizados por material, diâmetro, etapa e metragem. Metragem ausente continua `null` e não equivale a zero.
- Obras localizadas (EEE, booster, reservatório, EEAB, EEAT e outras) por projeto, com quantidade, CV e capacidade quando aplicáveis.
- Registro explícito de obra localizada **sem orçamento**, sem inventar valor estimado ou aprovado.
- Validação preliminar das medições por subcontratada, sistema e competência, impedindo medição superior à extensão validada dentro do mesmo lançamento.
- Verificação de que trechos, estruturas e medições pertencem ao mesmo sistema da mancha.

## Integração posterior com Supabase
As tabelas e políticas RLS precisam ser projetadas e revisadas sobre o schema existente antes de uma migration. Nunca vincular um dado financeiro apenas por título ou município; usar identificador do projeto e identificador do item contratual. Para a Estática, o controle de medições será histórico e por competência; revisões precisam manter rastreabilidade e não duplicar a extensão física.

## Verificação
`npx vitest run lib/management-metrics.test.ts lib/management-catalog.test.ts`
`npm run typecheck`

**Não** executar `supabase db push`, merge em `main` ou deploy com este pacote.
