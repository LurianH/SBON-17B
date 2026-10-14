# SBON 17B — Implantação controlada (sem executar ainda)

Esta proposta substitui as migrations de rascunho das fases 6, 8 e 16; nunca executá-las juntas.

O modelo passa a ter **três novas tabelas**, sem alterar `engineering_projects`, `engineering_project_updates` ou `contracts`:

1. `engineering_attack_plan_2026`: 16 frentes, cada uma com `row_key` único; mantém o código duplicado de Conchas em duas linhas distintas.
2. `engineering_localized_works`: cadastro de estrutura com FK à frente e ao projeto real da Engenharia.
3. `engineering_localized_work_updates`: histórico imutável por inserção, com situação dos projetos e características técnicas.

## Bloqueios antes da aplicação

- O projeto de Engenharia (`engineering_project_id`) deve existir **no mesmo município e sistema** da frente, e no contrato SBON 17B. Algumas frentes do plano ainda não têm esse projeto; não inventar UUIDs.
- Conferir a estrutura das policies e grants, que não estão totalmente visíveis nas capturas anteriores.
- Obter backup do banco, autorização explícita e confirmar que as tabelas ainda não existem.
- Aplicar no Supabase apenas depois de revisar o SQL; usar uma única transação.
- A interface atual **ainda não salva remotamente**. Precisará integrar os registros canônicos e as operações na camada de dados depois da migração.
- Proposta sem implantação real executada nem teste contra o servidor Supabase. Não considerar pronta para publicar.

**Instalação no Codespaces, apenas para revisão**:
`unzip -o SBON17B_IMPLANTACAO_CONTROLADA.zip`

Não contratar branch paga. Banco de produção permanece inalterado enquanto não autorizado.
