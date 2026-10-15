# Fase 10 — integração segura do Plano de Ataque com Obras Localizadas

- Recupera **apenas** o componente `LocalizedWorksEngineering.tsx` da Fase 7 com melhorias de validação.
- Não altera `EngineeringWaterLinearSection`, banco de dados, políticas RLS, rotas ou ambiente de produção.
- Agora o campo `ID da mancha` oferece exclusivamente as frentes do Plano de Ataque 2026 filtradas por município e sistema (EEE = Esgoto; Booster/Reservatório = Água).
- O Booster Alto da Serra utiliza `553_AR_0002N` conforme relação encaminhada; Booster São João usa `553_AF_292`.
- A reservação Vidas Novas / Núcleo Santino continua sem mancha pré-definida porque envolve duas referências; deve ser confirmada.
- A duplicidade do ID `271_AR_0001N` entre Estrada CH 12,5 e Aflitos é bloqueada para cadastro definitivo, até esclarecimento.
- Não cria persistência falsa: o botão continua `Aplicar na prévia`; as alterações desaparecem ao recarregar.

**Pré-requisito:** `lib/attack-plan-2026.ts` extraído da Fase 4.
**Instalação:** `unzip -o SBON17B_FASE10_VINCULOS.zip && npm run typecheck`.
**Verificação:** acesse `/engenharia` e edite uma estrutura.
**Não executar migrations** e não publicar em produção antes da aprovação.
