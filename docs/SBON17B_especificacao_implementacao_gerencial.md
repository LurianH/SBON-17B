# SBON 17B — Especificação de implementação do painel gerencial

## Decisão funcional aprovada
Preservar o primeiro layout executivo. Primeiro abrir o **Consolidado Gerencial**; separar Água e Esgoto em cada seção; preservar as abas e indicadores de performance existentes; adicionar Engenharia por Município, Estática, Medição Contratual, Cadastro/Atualização e Histórico. Não substituir o dashboard atual por uma interface inteiramente nova.

## Fontes e limites
- Fonte atual da aplicação: repositório `LurianH/SBON-17B`, branch `main`. Fazer implementação em nova branch de recurso, sem modificar `main` diretamente.
- Supabase correto: projeto `urydcysiqhixxlvkjyyo`. Nunca conectar a projeto de outro cliente.
- Planilha `17B_SPO e CPUs.xlsx`: aba `Planilha de Preços`, colunas `Lote`, `Quantidade`, `Código Produto`, `Descrição Produto`, `Complemento`, `Observação Cliente`, `Unidade`, `Custo Unitário`, `Custo Total`, `Recusado`; aba `CPU's` contém composições. Importar códigos, descrições, unidades e custos como catálogo de referência, NÃO como medição por mancha.
- Respeitar diferenças entre extensão original, projetada, aprovada, executada, validada, medida e paga; evitar somas de medição de fornecimento + assentamento como extensão física dupla.
- Obras localizadas sem orçamento: cadastrar, exibir e contar fisicamente. Valor financeiro = NULL (não zero). Não criar orçamento preliminar automaticamente.

## Navegação e componentes
1. Consolidado Gerencial (página inicial da Engenharia): KPIs globais com Água / Esgoto discriminados; evolução por município; progresso de concepção/executivo; obras lineares e localizadas; destaque Estática; resumo de medições; pendências.
2. Engenharia por Município: Porangaba, Quadra, Tatuí, Conchas, Pereiras, por segmento; expandir até ficha da mancha; cadastro com ID da mancha e NT; etapas de concepção, executivo e aprovação SABESP; economias quando aplicáveis.
3. Estática: km contratados, atribuídos, entregues, validados, medidos, pagos; R$/km (separar Água e Esgoto e faixas por vigência, quando existirem); saldos e divergências; agrupamento município/mancha/mês.
4. Medição Contratual: catálogo SPO/CPU; associação dos itens à mancha e/ou estrutura; EEE (unidade, CV, faixa aplicável), booster (unidade, CV), reservatório (unidade, m³), redes (m, diâmetro, material, método); quantitativos previstos, aprovados, executados, medidos e valores medidos.
5. Cadastro e Atualização: formulários editáveis por ADMIN/EDITOR; histórico imutável de atualizações e validações; GESTOR/DIRETORIA somente leitura.
6. Histórico: trilha de auditoria por mancha, estrutura, medição e usuário.

## Esquema recomendado (migrations novas; sem aplicação automática)
### 1. Identificação de manchas
Aproveitar `engineering_projects` com campos opcionais `stain_id`/`mancha_id` (identificador externo textual), `technical_notice_id`, e fonte/referência. Checar registros existentes e colisões antes de criar `UNIQUE` parcial. Não fazer migração que obrigue `NOT NULL` retroativamente sem backfill validado. A categoria não determina o sistema: preservar `segment_type` WATER/SEWER.

### 2. Redes lineares
Criar `engineering_network_segments`: id, project_id, rede_tipo, material, diameter_mm, method, original_length_m, designed_length_m, approved_length_m, executed_length_m, validated_length_m, notes, active. Para valores que variam ao longo do tempo usar snapshots append-only em tabela filha com `reference_date`, `created_at`, `created_by` (em vez de sobrescrever histórico). Manter compatibilidade com `pead_de63_length_m` e `pead_de110_length_m` já existentes; NÃO duplicar metros no agregado.

### 3. Obras localizadas
Criar `engineering_localized_works`: id, project_id, type (`EEE`,`BOOSTER`,`RESERVOIR`,`EEAB`,`EEAT`,`OTHER`), name, quantity, cv (nullable), capacity_m3 (nullable), flow_lps (nullable), hmt_mca (nullable), budget_status (`NOT_BUDGETED`,`BUDGETED`,`UNDER_CONTRACT_REVIEW`,`APPROVED`), contract_item_id (nullable), notes, active. Vincular itens de fornecimento, montagem e execução a uma estrutura por associação própria; total físico de unidades não será soma das linhas de preços. Permitir várias obras por mancha.

### 4. Catálogo contratual
`contract_price_items`: contract_id, source_version, item_code textual, description, unit, unit_cost numeric, source_tab, effective_date, UNIQUE(contract_id,source_version,item_code). Importação da planilha de preços com revisão, sem alterar valores existentes sem versão nova. Não carregar as CPUs completas como preço adicional para itens que já tenham custo unitário da planilha, sob risco de dupla contagem.

### 5. Medições da Estática e do contrato
`contractor_assignments`: contractor, project_id, segment_type, allocated_length_m, unit_rate_per_km, rate_effective_at, contract_reference.
`measurement_entries`: contractor_id opcional, project_id, work_id nullable, item_id nullable, reference_month, quantity, unit, physical_length_m opcional, stage (`SUBMITTED`,`VALIDATED`,`MEASURED`,`PAID`), amount nullable, document_ref, created_by, created_at. Não inferir pagamento de item medido. Validar unidade e exclusividade das etapas. Medição histórica imutável, com estorno/correção referenciada, para evitar perda de rastreabilidade.

### RLS e auditoria
Seguir políticas existentes da Engenharia: leituras para ADMIN, EDITOR, GESTOR, DIRETORIA; escrita ADMIN/EDITOR autenticados; registro de usuário por `auth.uid()` e triggers; grants mínimos; `security_invoker` em views; filtros por contract_id em todas as consultas; não expor tokens ou service_role.

## Cálculos gerenciais
- Extensão física por projeto/segmento = soma dos trechos físicos únicos por mancha (em milímetros inteiros para arredondamento estável). Evitar somar quantidade de itens `FORN` e `FORM` como comprimentos independentes.
- Saldo Estática em km = extensão validada não medida, com conferência contra os lançamentos; saldo de contrato = contratado menos medido; valor medido em R$ = quantidade medida * taxa contratual aplicável, quando conhecida. `NULL` se taxa/quantidade ausente.
- Obras localizadas sem orçamento contam nas unidades e na fila de orçamento, nunca no somatório de valores contratados/medidos.
- EEE e booster: CV controla potência/faixa dos itens; somente os itens compatíveis e efetivamente medidos alimentam R$. Conferir enquadramento com contrato antes de automatizar seleção de faixa.
- Agregado executivo: Água e Esgoto em colunas distintas, total de metros somável, economias nunca convertidas em metros; sinalizar parciais / valores desconhecidos.

## Etapas de implementação e critérios de aceite
### Fase A — Modelo e plano de migração
Mapear páginas/componentes existentes, escrever SQL em nova migration, criar testes de constraints e RLS, importar somente catálogo da SPO e conferir valores originais. Não executar migration no Supabase remoto ainda.
### Fase B — Formulários
Cadastro/edição do ID da mancha e obras localizadas; redes por material/diâmetro/método; controle de Estática; formulário de lançamentos contratuais. Não sobrescrever updates históricos.
### Fase C — Dashboard
Reaproveitar identidade visual e cards existentes; implementar Consolidado primeiro; coluna Água/Esgoto, municípios, obra localizada orçada/não orçada, Estática e medição. Cartões incompletos devem indicar `Aguardando atualização` / `Parcial`, nunca números inventados.
### Fase D — Homologação
Testes automatizados, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, avaliação de migrations por dry-run e verificação das abas no preview. Conferência de dados históricos existentes. Migração remota e merge para main somente após validação explícita.

## Dados a solicitar posteriormente
Lista por mancha (ID, município, sistema, rede por diâmetro, estruturas associadas); contrato da Estática com R$/km e critérios de aceite; associação dos itens SPO/CPU a cada obra; identificação das obras localizadas sem orçamento e CV/capacidade de cada uma. Ausência de dados não deve impedir cadastro inicial.
