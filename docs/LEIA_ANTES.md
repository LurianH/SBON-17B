# SBON 17B — versão preparada para implantação

A referência atual é [PUBLICACAO_SBON17B.md](PUBLICACAO_SBON17B.md). O código continua a branch `feat/dashboard-gerencial-sbon17b` desde `d79aec5`, sem criar novas prévias.

A migration consolidada é `supabase/migrations/20261014170959_localized_works_permanent_history.sql`. **Não execute os rascunhos de `sql/` junto com ela.** Os documentos de fases anteriores registram etapas históricas e não descrevem o estado atual.

Reservatórios, boosters e EEEs possuem cadastro atômico, consulta central e histórico permanente. A configuração `NEXT_PUBLIC_SBON17B_LOCALIZED_WORKS_ENABLED=false` mantém a ativação pendente em qualquer ambiente não homologado. Não habilite em produção antes da autorização do responsável e da aplicação/validação da migration.

O painel Vitalux original e os dados de Obras Lineares de Água são preservados. Nenhum serviço adicional, migration remota, alteração de produção ou publicação é executado por esta entrega de código.
