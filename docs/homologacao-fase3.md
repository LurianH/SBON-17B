# Homologação — Fase 3

Estes registros são controlados e devem ser substituídos ou removidos antes da entrada em produção.

## Registros de homologação

- Contrato `SBON 17B`: valor provisório de R$ 78.500.000,00.
- Meta de 2026: 15.000 economias.
- Faturamentos de janeiro a agosto de 2026: R$ 4.500.000,00; R$ 4.800.000,00; R$ 5.100.000,00; R$ 5.300.000,00; R$ 5.500.000,00; R$ 5.600.000,00; R$ 5.700.000,00; R$ 5.800.000,00.
- Avanços semanais de 03, 10, 17 e 24 de agosto de 2026, com os valores definidos no roteiro da Fase 3.
- Plano `HOMOLOGAÇÃO — Recuperação do avanço físico`, atualmente em andamento.
- Logs de auditoria gerados pela carga, pelos lançamentos via interface e pelos testes temporários da matriz RLS.

## Contas

- Os oito perfis reais não são dados descartáveis e não devem ser removidos junto com a homologação.
- `higorcardoso.eng@gmail.com` permanece sem profile apenas para o teste de bloqueio. Antes da produção, decidir se a conta será removida ou receberá um papel válido.

## Procedimento de limpeza futura

Não executar durante a Fase 3.

1. Confirmar por escrito os valores oficiais do contrato e da meta.
2. Exportar os registros e os logs de auditoria para retenção.
3. Inativar ou substituir os faturamentos ativos de 01/2026 a 08/2026.
4. Inativar ou substituir os avanços de 03/08/2026 a 24/08/2026.
5. Concluir ou remover o plano identificado pelo prefixo `HOMOLOGAÇÃO —` conforme a política de retenção definida.
6. Atualizar o valor contratual e a meta sem usar `float`; os campos permanecem `numeric`/inteiro.
7. Reexecutar a matriz RLS, as projeções, o YTD, a auditoria e o build antes da publicação.

Prefira inativação ou substituição auditável a exclusões diretas. Qualquer limpeza deve ser preparada como operação separada, revisada e confirmada antes da execução.
