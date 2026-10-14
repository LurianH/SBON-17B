# SBON 17B — implantação controlada

A implementação final e o roteiro de liberação estão em [PUBLICACAO_SBON17B.md](PUBLICACAO_SBON17B.md). Este documento substitui as instruções de pacotes/ZIPs anteriores.

Aplicar somente a migration consolidada `20261014170959_localized_works_permanent_history.sql`, depois de conferir o schema real e receber autorização explícita. Ela cria três tabelas de obras localizadas, funções, triggers, índices, RLS e a view de estado atual. Nenhuma tabela, policy ou linha existente do painel Vitalux/Engenharia é alterada pela migration.

A frente do Plano de Ataque é obrigatória. O vínculo a um projeto real da Engenharia é opcional, como previsto no último SQL em revisão; quando informado, contrato, município, sistema e atividade devem coincidir. Essa opção permite cadastrar a estrutura da frente sem inventar ou inserir um projeto na Engenharia. A interface oferece projetos compatíveis para associação explícita.

Somente ADMIN/EDITOR ativos gravam. GESTOR/DIRETORIA ativos consultam cadastro e histórico na Engenharia. As permissões originais da rota `/historico` e de `audit_logs` continuam intactas.

Não criar infraestrutura paga, novas prévias nem aplicar migration/publicar sem autorização. O deploy automático da branch de trabalho está desabilitado no `vercel.json`; a configuração da branch principal e os recursos remotos existentes não foram modificados.
