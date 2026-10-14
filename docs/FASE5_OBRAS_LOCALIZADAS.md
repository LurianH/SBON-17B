# Fase 5: obras localizadas em Engenharia

Adiciona componente visual à rota /engenharia mantendo todos os filtros, formulários e gráficos existentes. Não modifica a home `/`, nem o banco Supabase.

Campos de acompanhamento: tipo da obra, potência CV, capacidade m³, vazão, HMT, status de projeto, orçamento e medição. **Não implementa ainda persistência de cadastro**: precisa de migration, RLS e formulário de registro/histórico para informações por obra e mancha antes de produção.

Instalação na raiz do Codespaces: `unzip -o SBON17B_FASE5_OBRAS_LOCALIZADAS.zip && python3 scripts/integrar_obras_localizadas.py && npm run typecheck`.

Booster Alto da Serra: 0,4 L/s e 28 mca oriundos das premissas discutidas; CV não informado. Capacidade do reservatório Vidas Novas/Núcleo Santino não fixada nesta prévia.
