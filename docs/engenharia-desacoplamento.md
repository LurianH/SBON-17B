# Desacoplamento da Atualização Semanal

Preparação local na branch `feat/engenharia`. A migration nova ainda não foi aplicada remotamente.

## Banco e preservação

Migration: `supabase/migrations/20260914124220_decouple_weekly_progress_engineering.sql`.

```sql
-- Preserve legacy engineering values; new weekly entries record execution only.
-- Existing CHECK (value >= 0) constraints allow NULL and remain unchanged.
alter table public.weekly_progress
  alter column economies_available drop not null,
  alter column network_approved_m drop not null;
```

Uma instrução ALTER TABLE, com duas alterações de nulabilidade. Sem UPDATE, DELETE,
DROP COLUMN, alteração de defaults, inserções ou mudanças em migrations anteriores.
Os dois checks `>= 0` permitem NULL e continuam rejeitando números negativos.
Isso segue a semântica de [CHECK do PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html).
O ALTER TABLE é transacional, mas exige lock ACCESS EXCLUSIVE em weekly_progress:
a futura aplicação deve ocorrer em transação curta e com limite de espera por lock.
Não executar o frontend novo contra o schema antigo: os inserts sem os campos
legados dependem desta migration. A aplicação remota requer autorização separada.

O teste PGlite cria fixtures sintéticas antes da migration e compara todas as
linhas das tabelas públicas antes/depois, incluindo auditoria. Também confirma
que EDITOR insere execução sem Engenharia, que o histórico permanece legível e
que os checks existentes não mudam. Nada é conectado ao Supabase real.

## Formulários

Atualização Semanal envia reference_date, economies_executed e network_executed_m,
além de contract_id para vinculação. O schema de escrita descarta chaves legadas
mesmo se fornecidas; não há comparação de executado com disponível/aprovado.
Na Engenharia, cadastro usa “Cadastrar projeto” e atualização usa “Salvar atualização”.
As datas de aprovação/finalização têm max ligado à data de referência; a validação
de domínio e as constraints existentes continuam a validar essas datas.

## Fonte do Dashboard

`lib/dashboard-data.ts` chama `loadDashboardEngineering` de `lib/dashboard-engineering.ts`.
São lidos engineering_projects e engineering_current_updates, filtrados por
contract_id e active=true, em páginas de 500 registros. A view existente escolhe
um snapshot por projeto, ordenando reference_date DESC, created_at DESC, id DESC.
O agrupamento associa esse snapshot ao segmento do projeto. Não lê a tabela de
histórico engineering_project_updates nem weekly_progress_details para os totais.

- waterEconomies/sewerEconomies: approved_economies por WATER/SEWER.
- waterNetwork/sewerNetwork: approved_length_m por WATER/SEWER.
- available: soma de approved_economies dos projetos ativos.
- networkApproved: soma de approved_length_m dos projetos ativos.
- engineeringDate: maior referência entre os snapshots vigentes, independente da execução.

Sem projetos, snapshot ou valor informado, a métrica é NULL. Zero explícito é zero.
Para não apresentar subtotal como total completo, qualquer valor faltante deixa
o total daquela métrica NULL; os segmentos completos continuam visíveis.
Falhas de leitura também deixam Engenharia aguardando atualização, sem fallback legado.

## Unidades e Origem do desvio

A fórmula encontrada recebe meta, disponível e executado em economias. As metas
armazenadas no código usam target_economies para ambos os segmentos; nenhuma meta
foi alterada. A entrada disponível passa a ser approved_economies, nunca approved_length_m.

Quando Água tem economias e Esgoto somente metros, não existe conversão autorizada:
available e Origem do desvio ficam neutros/aguardando definição, enquanto as
metragens permanecem visíveis no card de rede. Também se bloqueia a origem quando
um segmento com meta não tem economias de Engenharia. A execução semanal não é
segmentada, então não é possível separar uma origem válida só para Água nesse caso.
O cálculo existente permanece quando todos os valores em economias são compatíveis.
Não se criou fórmula de desvio em metros nem se modificaram metas, faturamento ou
projeção de execução. A análise histórica mantém a leitura legada, com tratamento
de NULL para não exibir zero artificial nem projetar séries incompletas.

## Validação e revisão

Executar `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
Com o PGlite local já instalado em tmp/db-verification:
`node scripts/test-weekly-decoupling-local.mjs` e `node scripts/test-engineering-local.mjs`.
Os testes unitários cobrem formulário renderizado, payload, fontes do Dashboard,
vigência, inativos, segmentos, zeros/ausência, paginação e leitura histórica.
Os testes SQL cobrem a migration incremental e regressão de RLS/auditoria da Engenharia.

Antes de liberar: revisar o diff e autorizar separadamente homologação/aplicação
da migration; conferir o novo formulário e os totais com dados reais após a aplicação.
Nenhum commit, push, merge, deploy ou comando de banco remoto faz parte desta preparação.
