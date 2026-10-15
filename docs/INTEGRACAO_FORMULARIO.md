# Integração de Obras Localizadas

O componente existente `LocalizedWorksEngineering` recebe o perfil, o contrato, os projetos de Engenharia e os cadastros carregados pelo servidor. O serviço `lib/localized-works-remote.ts` valida o payload, confirma usuário/perfil ativo e chama as RPCs com RLS.

- Cadastro: `create_sbon17b_localized_work` grava estrutura e primeiro snapshot na mesma transação. Uma falha desfaz ambos.
- Atualização: `add_sbon17b_localized_work_update` acrescenta um snapshot, preservando todos os anteriores.
- Leitura: `engineering_localized_work_current` usa `security_invoker` e o snapshot mais recente por data de referência, instante do servidor e UUID. Consultas do cadastro e histórico são paginadas.
- Permissões: ADMIN/EDITOR escrevem; GESTOR/DIRETORIA consultam. Perfil inativo, sem profile e anon não acessam. O Modo Diretoria também bloqueia controles de edição.
- Identificação: frente canônica, contrato, município e sistema são validados no banco. Associação a projeto real é opcional conforme o último modelo revisado; quando informada exige projeto ativo e compatível. Não se inventam projetos/UUIDs. IDs de mancha repetidos mantêm `row_key` distinto.
- Cadastro remoto não mistura as referências locais de planejamento com registros oficiais. Rascunhos v1 permanecem armazenados; a consulta central não sobrescreve nem envia esses dados automaticamente.
- Falha de consulta não é apresentada como cadastro vazio nem habilita escrita. Se a gravação concluir e a releitura falhar, a mensagem informa que o registro já foi salvo.

Ativação e publicação: [PUBLICACAO_SBON17B.md](PUBLICACAO_SBON17B.md). O flag continua desligado por padrão até autorização de implantação; não existe mais uma constante fixa que obrigue a alterar o código para ativar.
