# Fase 17 — contrato de dados para integração com Supabase

Entrega real: `lib/localized-works-db-mapper.ts` e seis testes.

Recebe um registro validado pelo Plano de Ataque e a referência de um projeto real
do banco. Só prepara os campos para futuras inserções em `engineering_localized_works`
e `engineering_localized_work_updates`. Bloqueia contrato, cidade, sistema ou projeto
inativo incompatíveis. Não importa cliente Supabase; a gravação continua bloqueada.

**Não resolve ainda:** uma linha do Plano de Ataque não é automaticamente um
`engineering_project_id`. Precisamos associar a frente a um projeto existente
ou criar cadastro canônico de manchas. Não se pode gravar apenas com texto livre.

Instalação: `unzip -o SBON17B_FASE17_MAPEAMENTO_BANCO.zip && npm run typecheck && npx vitest run lib/localized-works-db-mapper.test.ts`

Nenhum SQL. Nenhuma migração. Nenhum impacto na tela original.
