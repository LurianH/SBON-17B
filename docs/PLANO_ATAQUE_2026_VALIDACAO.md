# Plano de Ataque 2026 — importação inicial

16 frentes informadas em 13/10/2026; 699 economias previstas: 379 Água (12 frentes) e 320 Esgoto (4 frentes). **Não são economias aprovadas**, nem alteram meta 2026 do contrato. Os valores são locais à prévia e ainda não editáveis.

## Ponto pendente
Na imagem, `271_AR_0001N` aparece para **Estrada CH 12,5** e **Aflitos**, ambas em Conchas. Mantidos os dois, identificados por chaves técnicas locais diferentes e sinalizados visualmente. A confirmação do ID deve preceder qualquer gravação definitiva.

## Limites
Nenhuma atualização de tabela Supabase, sem migração, sem alteração da rota `/` ou `main`. A importação é um *seed* em código para validação gerencial. Após confirmar os IDs, transformar em cadastro editável com migração, autorização e trilha de auditoria.
