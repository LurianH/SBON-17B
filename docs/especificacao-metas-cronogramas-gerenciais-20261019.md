# SBON 17B — Metas e cronogramas (especificação aprovada em 19/10/2026)

## Escopo
Alterar somente o bloco **Metas do contrato** do painel gerencial `app/page.tsx` e acrescentar na tela de Engenharia um quadro compacto de metas anuais. Preservar os cartões **Entrega da Engenharia**, **Execução Real**, **Estruturas Cadastradas** e **Distribuição das Manchas**, sem alterar suas consultas, fórmulas ou layout. Preservar o bloco existente de status por sistema, alterando apenas rótulos indevidos de "projetos" para "manchas" quando o registro corresponde a mancha GIS. Remover **Origem do desvio** da área gerencial marcada pelo usuário, liberando largura para metas.

## Regras funcionais
1. **Execução**: metas do CONTRATO de economias por ano e município (2026: 1.709; 2027: 8.124; 2028: 4.588; total 14.421). A linha do tempo contratual alcança 2028 e **não** termina em maio/2027. Nunca rotular economias como quilômetros; reportar metragem de Água/Esgoto em métrica independente.
2. **Engenharia**: prazo de conclusão do cronograma de elaboração/liberação dos projetos/manchas até **31/05/2027**, enfatizado na segunda linha do tempo. Não presumir que todas as 122 manchas exigem aprovação: considerar cancelamentos e o escopo contratual com denominador explicitado.
3. **Aderência gerencial**: para cada ano, somar economias associadas às manchas planejadas/em ataque daquele ano, com chave única por mancha + sistema + ano. Dividir pelo recorte de economias da meta anual desse sistema/município/ano, somente quando os dados forem completos e compatíveis; caso contrário, exibir "Aguardando enquadramento" em vez de fabricar aderência ou risco.
4. **Andamento das manchas**: mostrar quantidade em elaboração, em revisão, liberadas (sem objeção e sem objeção com ressalvas) e a iniciar; filtro por ano, município e sistema. Quantidades de manchas nunca são comparadas numericamente com economias sem vínculo por projeto.
5. **Execução física**: usar valores existentes, segregados por sistema somente quando a origem é conhecida; não inferir economias executadas pela extensão. Os 165 m de KM 162 já estão contabilizados no 0,17 km do cartão de execução.
6. **Metas por ano**: quadro na área de Engenharia com 2026/2027/2028, município, categoria (formal/rural, quando disponível), Água/Esgoto e total; exibir recorte da fonte oficial, não valores inventados. Preservar filtros e acessos existentes.
7. **Dados faltantes**: apresentar "—" ou "Aguardando cadastro", nunca 0% quando o denominador/numeração é desconhecido. Não repetir as metas de projeto por trecho de rede.
8. **Fonte de verdade**: reutilizar estrutura existente Supabase/readers, evitando migrations sem necessidade e sem escrita em tabelas de produção.

## Layout
- Área superior inalterada: Valor do Contrato, Faturado no Ano, Meta do Ano, Projeção Anual.
- Cartão metas expandido com pequena coluna Água/Esgoto e duas faixas horizontais alinhadas:
  - Linha 1: Execução contratual 2026–2028, metas e realizado.
  - Linha 2: Engenharia / manchas, com marco **mai/2027**.
- Abaixo: "Leitura do cronograma e do ataque de manchas" comparando cobertura em economias da carteira de manchas por ano, sinalização de risco apenas se fundada em dados; ao lado, metas anuais.
- Preservar status por sistema e quatro cartões inferiores originais.
- Em Engenharia, acrescentar módulo independente de metas por ano sem reformular o restante.

## Aceitação
- Nenhum valor factual do painel sofre alteração pela implantação do layout.
- Nenhuma métrica de produção em metros é chamada de economia ou usada para calculá-la.
- Linha de prazo maio/2027 aparece apenas na Engenharia; metas da execução continuam até 2028.
- Filtros por sistema, município e ano; sem somar novamente projetos repetidos por diâmetro/trecho.
- Risco/aderência desconhecidos aparecem como pendentes.
- Testar responsividade, permissões, carregamento com ausência de dados, cálculo de recortes, preservação de indicadores e builds.
- Não publicar nem executar migrations/updates em produção sem autorização.
