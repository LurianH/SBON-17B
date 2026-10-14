# Fase 14 — Rascunho local (sem custos)

O cadastro de Obras Localizadas ganha autosalvamento **local neste navegador** após
a ação *Aplicar na prévia*. Os dados são restaurados ao recarregar a página no mesmo
navegador. A exportação/importação JSON da Fase 13 continua disponível.

**Atenção**: não é gravação no Supabase e não é compartilhado com outros usuários ou
computadores; limpar o armazenamento do navegador poderá eliminar registros. Faça
backup JSON antes de mudar de dispositivo. O histórico continua sendo apenas desta sessão.

Instalação: `unzip -o SBON17B_FASE14_RASCUNHO_LOCAL.zip && npm run typecheck`
Teste manual: edite uma referência na rota `/engenharia`, clique *Aplicar na prévia*,
recarregue a página e confirme que o rascunho reaparece. Depois exporte o JSON.

Não execute SQL ou migração. Não publique na Vercel até testar.
