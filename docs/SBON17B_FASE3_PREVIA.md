# SBON 17B — Fase 3: interface de prévia gerencial

Rota: `/gerencial-preview`, protegida por login e perfil de Engenharia.

- Consolidado primeiro; filtro Água/Esgoto; filtro município.
- Seções Visão executiva, Municípios, Estática e Obras localizadas.
- Utiliza funções puras da Fase 1 e nenhum dado fictício.
- Sem gravação no Supabase, sem migration, sem mudança nas rotas ou menus existentes.
- Valores indisponíveis aparecem como `Aguardando dados`.
- Próxima fase: adaptadores de leitura, persistência com RLS, formulários, medição contratual e homologação antes de publicação.

Verificações recomendadas: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Não publicar automaticamente a rota de prévia em produção; trabalhar apenas na branch de desenvolvimento e validar antes de merge.
