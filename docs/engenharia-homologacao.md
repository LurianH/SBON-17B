# Revisão para homologação — Engenharia

Revisão local em 11/09/2026, branch `feat/engenharia`. Nenhuma migration, dado ou configuração remota foi alterado. Nenhuma ferramenta foi instalada nesta revisão. Código e migration mantidos sem alterações.

## Conclusão

A migration é incremental em relação ao schema versionado: cria três tabelas, índices, policies, triggers, uma view e funções novas. Insere somente GENERAL/Geral e STATIC/Estática na nova tabela de categorias. Não executa UPDATE, DELETE, DROP, TRUNCATE ou mudança de colunas em tabelas existentes. Os ALTER TABLE habilitam RLS somente nas tabelas novas. Os grants/revokes também se limitam aos objetos novos.

Não há operação de perda ou transformação de dados existentes no SQL revisado. Isso não equivale a garantia de risco zero: falta comparar com o schema remoto, verificar objetos com nomes conflitantes e confirmar o histórico real de migrations. DDL e FKs podem adquirir locks breves, mesmo sem reescrever dados antigos.

## Migration nova e ordem

Única migration nova de Engenharia:

`20260911183427_add_engineering_projects.sql`

SHA-256 do arquivo revisado: `781DF1DBC07C7388F2C1875B2D3F7DE421477C3299BF0280A199DAC2F668A24B`.

A ordem completa do repositório é:

1. `202608290001_initial_sbon17b.sql`
2. `20260829205457_harden_phase2_auth_rls.sql`
3. `20260830124435_add_fk_indexes_phase3.sql`
4. `20260830175030_normalize_annual_target_details.sql`
5. `20260830182938_add_segmented_progress_and_financial_snapshots.sql`
6. `20260830183308_increase_weekly_network_precision.sql`
7. **`20260911183427_add_engineering_projects.sql` — nova**

Os itens 1–6 são histórico existente, não uma autorização para reaplicá-los. Se já estiverem registrados no remoto, somente o item 7 deverá aparecer como pendente. Se algum anterior aparecer pendente, interromper para investigar; não usar `--include-all`, `migration repair` ou reaplicar SQL antigo automaticamente. Sem autenticação não é possível afirmar quais versões estão efetivamente registradas no remoto.

Dependências diretas: `contracts`, `auth.users`, `profiles` com os quatro perfis e `active`, enum `target_segment_type`, schema `private`, funções `current_app_role`, `capture_audit` e `touch_updated_at`, além da estrutura existente de `audit_logs`. A view com `security_invoker` exige PostgreSQL 15 ou superior.

## Revisão de segurança e compatibilidade

| Área | Resultado e limitações |
| --- | --- |
| Categorias | Tabela própria; não modifica categorias, enums ou metas existentes. Os quatro perfis têm somente leitura. Inclusão/alteração de categorias não está disponível no app nem concedida ao ADMIN do app. Alterações futuras por administração SQL não têm trigger de auditoria nessa tabela; definir auditoria antes de disponibilizar essa manutenção. |
| Auditoria | Reutiliza `private.capture_audit()` sem redefini-la. Cadastro e snapshots novos geram logs; registros antigos permanecem intactos. Falha no trigger impede o salvamento na mesma transação. Leitura geral de `audit_logs` permanece ADMIN/GESTOR; EDITOR/DIRETORIA não recebem ampliação de acesso. |
| Histórico | Snapshots sem UPDATE/DELETE para os perfis do app, inclusive ADMIN. Estado vigente por referência, instante e UUID. Criação do cadastro e primeiro snapshot atômica via RPC invoker. |
| Identificação | Nome/cidade/segmento/categoria do projeto são imutáveis para usuários do app. “Editar” significa inserir novo status/valores; alteração de `active` é permitida no banco a ADMIN/EDITOR. Correções da identificação exigem um fluxo futuro definido. |
| RLS | Usa perfil ativo consultado no banco, não `user_metadata`. View e RPC com SECURITY INVOKER. Anon sem grants. Permissões de escrita limitadas a ADMIN/EDITOR. |
| Contratos | Leitura autorizada por perfil é global aos contratos, seguindo o padrão existente; não há associação usuário–contrato. A página filtra SBON 17B, mas a RLS não faz isolamento por contrato. Se o banco for usado por equipes que devam ver contratos distintos, esse isolamento precisa ser definido antes de liberar. |
| Usuários existentes | Nenhum usuário, senha, perfil ou role é alterado. As FKs usam os IDs atuais de `auth.users`. Depois que um usuário criar registros de Engenharia, essas FKs poderão impedir sua exclusão física; desativação do perfil continua compatível. |
| Valores | Integer e numeric(14,3), com constraints; negativos e numeric NaN bloqueados. NULL permanece ausência. Metragem acima de três casas pode ser arredondada pelo PostgreSQL em chamadas diretas; o formulário rejeita esse excesso. |
| Reaplicação | CREATE TABLE/FUNCTION/VIEW não é idempotente. Objetos preexistentes com os mesmos nomes causam falha. Confirmar ausência e histórico da CLI antes de aplicar. Não substituir isso por IF NOT EXISTS, que poderia ocultar divergência. |

| Perfil ativo | Leitura de Engenharia | Criar projeto / inserir snapshot | Atualizar/excluir snapshot antigo |
| --- | --- | --- | --- |
| ADMIN | Sim | Sim | Não |
| EDITOR | Sim | Sim | Não |
| GESTOR | Sim | Não | Não |
| DIRETORIA | Sim | Não | Não |
| Inativo, sem perfil ou anon | Não | Não | Não |

## Autenticação manual

A CLI já está instalada, mas não autenticada. No PowerShell, execute exatamente:

```powershell
& 'C:\Users\Lurian Taina\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe' login
```

Conclua o fluxo interativo com a conta Supabase que possui acesso ao projeto `urydcysiqhixxlvkjyyo`. Se a CLI solicitar um token, forneça-o apenas no terminal local ou no fluxo oficial indicado, não nesta conversa. Login da CLI é separado do login de usuário no aplicativo e não aplica migrations. Não é necessário instalar nem executar npx para esse passo.

Depois de autenticar, avise nesta conversa. A próxima ação será leitura do histórico/schema e dry-run, sem aplicação. Não foi tentado acesso alternativo para contornar a autenticação.

## Dry-run desta revisão

Foi executado com a CLI existente:

```text
supabase db push --dry-run --skip-vault --project-ref urydcysiqhixxlvkjyyo
```

Resultado: **não concluído**, código `LegacyPlatformAuthRequiredError`, mensagem `Access token not provided`. Não houve conexão autenticada nem validação do schema remoto. `--skip-vault` evita a atualização de segredos prevista no fluxo da CLI.

Após o login, repetir a simulação. Além dela, confirmar por consultas somente de leitura: versões aplicadas, PostgreSQL >=15, dependências e assinaturas, grants/helpers ativos, ausência dos objetos novos e contrato SBON 17B ativo. Um dry-run mostra migrations pendentes; não demonstra por si só que o SQL executa ou que a RLS funciona no serviço real.

Foi repetida, sem instalação, a validação local `scripts/test-engineering-local.mjs` com Node 22 e PGlite já disponíveis: todas as sete migrations passaram, assim como constraints, atomicidade, autoria, histórico, auditoria, grants e RLS. Fixtures locais revertidas. Isso não substitui Auth/PostgREST reais.

## Checklist antes da liberação

- [ ] Login manual da CLI concluído e acesso ao projeto correto confirmado.
- [ ] Histórico remoto confrontado com a ordem acima; lista exata de pendências confirmada.
- [ ] Schema, versão, helpers, catálogo e contrato verificados por leitura; riscos acima resolvidos ou aceitos.
- [ ] Dry-run aprovado, sem migrations inesperadas e sem mudanças em Vault.
- [ ] Destino de homologação real definido. Autenticar não autoriza escrita. Se o ref fornecido for produção, não criar fixtures nele sem autorização expressa; preferir Supabase de homologação já disponibilizado pelo usuário.
- [ ] Autorização expressa para aplicar a migration no destino escolhido e para os registros de teste, com plano de recuperação definido.
- [ ] Aplicação validada nesse destino; tabelas/view/RPC disponíveis pela Data API e schema cache atualizado.
- [ ] App local configurado para o destino correto com URL e publishable key; sem service_role. Reinício local quando necessário.
- [ ] Login e leitura com usuários reais ativos ADMIN, EDITOR, GESTOR e DIRETORIA, sem alterar perfis de produção.
- [ ] ADMIN/EDITOR: cadastro, primeiro snapshot e erro de duplicidade; falha no snapshot não deixa cadastro órfão.
- [ ] Atualização cria snapshot novo; valores anteriores continuam no histórico; correção retroativa não altera referência mais nova.
- [ ] Concepção/executivo, datas, categoria Geral/Estática, valores zero/ausentes, negativos/NaN e precisão verificados.
- [ ] Totais de Água/Esgoto/cidade e percentuais conferidos contra registros reais de homologação; sem somar múltiplos snapshots do mesmo projeto.
- [ ] Filtros isolados/combinados e limpar filtros; detalhes, histórico e paginação; estados vazio/erro.
- [ ] Auditoria confirma autor, instante, entidade e payload de cada operação; não depende de acesso de EDITOR ao audit_logs.
- [ ] GESTOR/DIRETORIA: sem edição na UI; INSERT/RPC e alteração de active negados via API direta com suas sessões. Anon, usuário sem perfil e inativo bloqueados.
- [ ] UPDATE/DELETE de snapshots negados inclusive para ADMIN; view não contorna RLS; autoria/timestamp não podem ser falsificados pelo cliente.
- [ ] Modo Diretoria sem histórico operacional e botões de edição; layout e formulários em desktop/tablet/mobile.
- [ ] Duas sessões editando o mesmo projeto testadas para conferir ordenação, snapshots completos e atualização do painel.
- [ ] Dashboard, metas anuais, avanços semanais, usuários e dados oficiais preservados; divergência com indicadores legados documentada, pois não há sincronização automática.
- [ ] Evidências de homologação aprovadas e autorização separada para commit, push, deploy e eventual aplicação em produção.

O arquivo `supabase/tests/engineering_rls.sql` contém fixtures sintéticas e manipulação de roles para PostgreSQL isolado. **Não executá-lo no Supabase de produção.** A homologação via API deve usar usuários de teste autorizados no ambiente escolhido.
