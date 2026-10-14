# Fase 7 — Prévia de cadastro de Obras Localizadas

Substitui apenas o componente da seção Obras Localizadas, preservando EngineeringPanel, Obras Lineares e dados existentes.

- Formulário editável e filtros para reservatório, booster e EEE.
- Não persiste no banco, servidor ou localStorage. Perde alterações ao atualizar a página.
- Referências iniciais são planejamento, não aprovações.
- Nenhuma migration aplicada. Banco e produção preservados.
- Para instalar: `unzip -o SBON17B_FASE7_FORMULARIOS_PREVIA.zip && npm run typecheck`.
- Antes de habilitar gravação: revisar esquema do banco, RLS, validação server-side, autorização do perfil, vínculo entre contrato/mancha e histórico imutável. Não executar SQL rascunho da Fase 6.
