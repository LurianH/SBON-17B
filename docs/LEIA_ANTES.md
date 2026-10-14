# Fase 16 — Migration proposta, NÃO EXECUTAR

Este pacote é código de revisão, **não foi testado em um clone de banco** e não deve ser aplicado na produção sem autorização expressa. Não há branch de homologação gratuita configurada.

O diagnóstico do Supabase confirmou `engineering_projects` (12 colunas), `engineering_project_updates` (15 colunas) e ausência das duas novas tabelas.

## Proteções incluídas
- Somente tabelas novas; não modifica cadastros e históricos de Obras Lineares de Água.
- FK obrigatória para `engineering_projects`, com verificação de contrato ativo SBON 17B, município e sistema.
- Histórico append-only (sem UPDATE/DELETE para perfis e bloqueio por trigger).
- RLS com checagem de perfil e associação ao contrato SBON 17B.
- Valores orçamentários só permitidos após status `APPROVED`.
- Não preenche nem estima valores financeiros.

## Pendências obrigatórias antes de aplicar
1. **Manchas**: `mancha_id` ainda é texto informativo, não é chave estrangeira de cadastro canônico. Precisamos relacionar o Plano de Ataque a IDs únicos de projeto/mancha, inclusive corrigir IDs repetidos.
2. **Compatibilidade**: conferir `contracts.active`, `engineering_projects.active`, tipos de colunas, função `private.current_app_role()` e permissões reais do ambiente.
3. **Papel dos usuários**: verificar se perfis `ADMIN/EDITOR/GESTOR/DIRETORIA` são globais ou restritos a contratos; se forem globais, restringir acessos adicionalmente.
4. **Histórico**: definir correções administrativas e política de retenção para lançamentos incorretos sem alterar snapshots.
5. **Validação**: executar testes locais de migration/RLS e testes transacionais em ambiente isolado, se disponível sem custo.
6. **Operação**: backup, janela, plano de rollback e autorização explícita antes de usar o banco de produção.
7. **Interface**: implementar efetiva leitura/escrita no cliente, que permanece bloqueada. Sem conexão funcional após a migration, os formulários continuam rascunhos locais.

Este SQL é uma proposta intermediária para inspeção, não uma certificação de segurança.
