# Fase 18 — Vínculo com projetos existentes (sem escrita)

Este módulo recebe uma lista de projetos reais já carregados pelo painel de Engenharia e devolve os vínculos com as 16 frentes do Plano de Ataque 2026. Não usa acesso remoto nem modifica o banco.

Regras:
- Mesma identificação textual da frente (ou alias documentado), município, sistema, contrato e projeto ativo.
- Zero correspondências = `MISSING`; mais de uma = `AMBIGUOUS`. Ambos exigem conferência manual.
- Código da mancha isolado não basta para vincular: Conchas tem duas frentes com mesmo código.
- Projetos do plano não cadastrados na Engenharia não são criados automaticamente. A aprovação também não é inferida.

A Fase 18 oferece **lógica de vinculação e testes**, ainda não um cadastro central com gravação. Para usar com Supabase será preciso obter IDs de projetos existentes e confirmar a associação à frente antes de gravar.

Comando: `unzip -o SBON17B_FASE18_VINCULO_PROJETOS.zip && npm run typecheck && npx vitest run lib/engineering-project-links.test.ts`

Nenhum SQL ou nova infraestrutura. Preserva o dashboard Vitalux.
