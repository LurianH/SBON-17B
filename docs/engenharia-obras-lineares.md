# Engenharia — Água / Obras Lineares

## Modelo

O acompanhamento usa `engineering_projects` e seus snapshots imutáveis em `engineering_project_updates`; não cria um segundo histórico. Projetos da seção usam `segment_type = WATER`, `project_category = WATER_LINEAR` e `project_type = PE`.

Cada snapshot guarda `delivery_status` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), `approved_economies`, os comprimentos `pead_de63_length_m` e `pead_de110_length_m`, a extensão total em `approved_length_m`, `reference_date`, observação e o autor registrado pelo trigger existente. A extensão total deve ser igual à soma dos dois diâmetros. A conclusão da entrega não preenche status/data do executivo: a planilha não informa datas de conclusão nem concepção.

A alteração permite `concept_status` e `executive_status` nulos para representar dados que a fonte não fornece. Os formulários existentes continuam exigindo esses status para projetos gerais e estáticos. As policies/grants continuam nas tabelas existentes: ADMIN/EDITOR leem e escrevem; GESTOR/DIRETORIA leem. A RPC continua `SECURITY INVOKER`, e os snapshots seguem append-only.

## Fonte e data

Fonte: `Quadro_Resumo_Obras_de_Agua REV01.xlsx`, aba `Quadro resumo`. A propriedade `modified` do workbook é 18/09/2026 e é usada como data de referência inicial. O campo `Economias (un.)` da planilha alimenta `approved_economies` de forma independente do status de entrega. Isso faz esses valores entrarem na disponibilidade de Água usada por `Origem do desvio`. Metragens continuam em metros; nunca são convertidas em economias.

O hífen nas colunas de diâmetro é representado como zero, conforme a fórmula `SUM` da planilha. Observações ficam nulas porque não há observação preenchida na fonte. O cadastro e o snapshot inicial são criados juntos pela RPC; cargas parciais podem ser retomadas com segurança.

## Importação protegida

Os 13 registros estão em `data/engineering-water-linear.json`. `scripts/import-engineering-water-linear.mjs` autentica uma conta ativa ADMIN/EDITOR usando a chave publishable, consulta o contrato SBON 17B e verifica duplicidades pela identidade lógica sistema + município + nome. Uma identidade já importada é ignorada; colisão com projeto de outro tipo interrompe antes de qualquer escrita. A migration também adiciona índice único parcial para projetos `PE`.

O padrão é somente preview e não grava. Em uma futura carga autorizada, use `--apply`; o script chama a RPC existente com o JWT do usuário, nunca uma service key. O script não foi executado contra Supabase nesta implementação.

```powershell
node --env-file=.env.local scripts/import-engineering-water-linear.mjs
node --env-file=.env.local scripts/import-engineering-water-linear.mjs --apply
```

Configure `SBON_ENGINEERING_IMPORT_EMAIL` e `SBON_ENGINEERING_IMPORT_PASSWORD` somente no `.env.local` ignorado pelo Git. Não compartilhe credenciais no chat.

## Totais da fonte

- 13 projetos; 399 economias; 25.908,34 m (25,908 km).
- Finalizado: 6 projetos, 155 economias, 11.744,54 m.
- Em andamento: 5 projetos, 232 economias, 12.710,80 m.
- Não iniciado: 2 projetos, 12 economias, 1.453 m.
- Porangaba: 7 projetos, 313 economias, 15.761,15 m.
- Quadra: 2 projetos, 44 economias, 5.055,19 m.
- Tatuí: 2 projetos, 12 economias, 1.453 m.
- Conchas: 2 projetos, 30 economias, 3.639 m.
