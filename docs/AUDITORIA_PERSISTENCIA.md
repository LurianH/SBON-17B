# Fase 15 — Revisão técnica real da persistência

**Status:** implantação NÃO autorizada, sem mudanças no Supabase nem Vercel.

## Achados nos arquivos Fases 6 e 8

1. A fase 6 explicitamente prevê que as relações contrato/projeto/mancha deveriam
   ser verificadas; logo não pode ser executada como migration final.
2. O SQL da fase 8 adiciona um trigger que confere contrato/município/sistema
   apenas quando `engineering_project_id` está preenchido; contudo esse campo
   está *nullable*. Pode ser cadastrado um registro apenas com `mancha_id`
   arbitrário, porque esse ID é texto sem FK.
3. A política RLS da fase 8 testa papéis globais (ADMIN, EDITOR, GESTOR,
   DIRETORIA) sem conferir associação do usuário ao contrato. Se o sistema
   contiver outros contratos e os papéis não forem globais, existe risco de
   leitura/escrita entre contratos.
4. O formulário local e a estrutura do banco não estão suficientemente
   alinhados: falta chave de referência inequívoca para as manchas. Uma
   mesma mancha pode aparecer em mais de uma frente na lista original
   (Conchas). Deve-se usar ID de linha única + projeto/contrato para FK,
   não somente o código `mancha_id`.
5. O histórico impede UPDATE/DELETE por usuários autenticados, mas ainda é
   necessário conferir a existência de outras permissões e políticas
   permissivas que poderiam furar a regra.
6. A aprovação de orçamento deve ser vinculada a documento/etapa contratual.
   `approved_budget_brl` só pode existir com status APPROVED; não preencher
   valores financeiros sem aprovação.
7. O programa está com rascunho em `localStorage` (F14). Esse mecanismo não
   constitui histórico auditável, nem sincronização multiusuário.

## Plano sem custo adicional

- Continuar preparando o código e testes localmente no Codespace.
- Executar exclusivamente o SQL de **precheck somente leitura** em produção
  se e quando houver autorização, para verificar esquema e políticas.
- Definir estrutura consistente de manchas + vínculo de contrato.
- Gerar migration reversível e testes de RLS/segregação.
- Somente com autorização explícita, backup e janela de manutenção,
  aplicar migration no banco existente.
- Depois habilitar o botão de gravação no servidor, com histórico imutável.
- Não criar branch paga Supabase.

## Arquivos do pacote

`sql/01_PRECHECK_SOMENTE_LEITURA.sql` — queries exclusivamente SELECT.

Nenhuma SQL DDL/DML executável de mudança foi incluída nesta fase,
para evitar confusão com os rascunhos inseguros.
