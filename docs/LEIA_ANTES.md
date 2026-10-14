# Integração complementar — não executar SQL ainda

Este pacote acrescenta ao serviço remoto existente duas consultas e a inserção de um novo snapshot via RPC. O flag `LOCALIZED_DATABASE_ENABLED` permanece **false**.

Pré-requisitos para ativação futura: migration revisada, RPC inicial, RPC de atualização, ensaios reais de RLS e autorização explícita do responsável pelo banco de produção.

Na branch de desenvolvimento: `unzip -o SBON17B_COMPLEMENTO_HISTORICO.zip && npm run typecheck`

**Não executa alterações no banco.** Não há botão Salvar conectado ainda.
