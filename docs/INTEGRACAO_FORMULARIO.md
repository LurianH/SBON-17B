# Integração de Obras Localizadas — etapa de código

Este pacote conecta o submit ao serviço existente `lib/localized-works-remote.ts`,
com payload compatível com as funções SQL de cadastro e atualização.

**Bloqueio mantido:** `LOCALIZED_DATABASE_ENABLED=false` no serviço. Enquanto
as tabelas/RLS/RPC não estiverem implantadas e testadas, a UI continuará
utilizando o rascunho do navegador. Não modifique a constante para true.

**Atenção:** a interface remota ainda requer implementação do carregamento
inicial dos registros existentes (incluindo UUID) e confirmação dos papéis
de usuários. Não está pronta para produção.

Instalação: `unzip -o SBON17B_INTEGRACAO_FORMULARIO_TRAVADA.zip && npm run typecheck`
Não executar SQL, não fazer merge e não publicar nesta etapa.
