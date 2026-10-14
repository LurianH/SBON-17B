# Fase 12 — integração de formulário e validação centralizada

- Usa `prepareLocalizedWork` da Fase 11 em cada envio, verificando formato e vínculo da mancha.
- Adiciona histórico **temporário da sessão**, distinguindo-o de um histórico persistido no Supabase.
- Mantém `LOCALIZED_WORKS_REMOTE_WRITE_ENABLED=false`; nenhuma chamada de escrita à API é feita.
- Preserva todos os componentes de Obras Lineares de Água e o design Vitalux.
- Não altera SQL, migrations ou políticas RLS.
- Dependências: Fases 4, 7, 10 e 11 já extraídas no Codespace.

Aplicar: `unzip -o SBON17B_FASE12_INTEGRACAO_SEGURA.zip && npm run typecheck && npx vitest run lib/localized-works-persistence.test.ts`

Visualizar: `/engenharia`, clique em `Editar`, `Aplicar na prévia`, `Histórico da prévia`.

Atenção: **ainda não é persistência definitiva**. Próximo passo: auditoria de RLS e migration sob autorização, após criação de estratégia de teste sem custo; sem forçar execução no banco de produção.
