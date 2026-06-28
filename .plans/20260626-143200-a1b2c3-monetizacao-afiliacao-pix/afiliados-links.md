# Referência — Programas de Afiliados (AceitaTempo)

> Tags ativas no código (`src/affiliate.js`). Cadastre-se em cada programa para obter suas tags/IDs.
> Lojas sem programa público (Steam, GOG, Epic) não recebem toast de afiliado.

## Lojas ativas no código

| Loja          | Programa                 | Tag/ID no código        | Status                  |
| ------------- | ----------------------- | ----------------------- | ----------------------- |
| Amazon        | Amazon Associates       | `tag=aceitatempo-20`    | ✅ Ativa                |
| AliExpress    | AliExpress Affiliate    | `aff_fbid=aceitatempo`  | ⏳ Aguardando tag real  |
| Shopee        | Shopee Affiliate        | `af_siteid=aceitatempo` | ⏳ Aguardando tag real  |
| Mercado Livre | Mercado Livre Afiliados | `af_id=aceitatempo`     | ✅ Ativa                |

## Lojas pendentes (TODO)

| Loja                    | Programa           | Cadastro                                   | Notas                                                                                  |
| ----------------------- | ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Casas Bahia / Americanas | Lomadee           | <https://www.lomadee.com/>                 | Conta criada. Requer integração com API da Lomadee para gerar deep links dinamicamente. |
| Magazine Luiza          | Magalu Parceiros  | <https://magalu.parceiromagalu.com.br/>    | Removida do código por enquanto (sem tag real). Reativar quando houver ID.              |
| Temu                    | Temu Affiliate     | <https://affiliate.temu.com/>             | Removida do código por enquanto (sem tag real). Reativar quando houver ID.             |
| SHEIN                   | SHEIN Affiliate    | <https://sheinaffiliate.axon.com/>         | Removida do código por enquanto (sem tag real). Reativar quando houver ID.             |
| eBay                    | eBay Partner Network | <https://partnernetwork.ebay.com/>        | Removida do código (sem cadastro concluído).                                           |

## Lojas sem afiliado (não injetam toast)

- Steam, GOG, Epic Games — sem programa público.

## Notas TOS

- Amazon Associates exige clique real do usuário (não auto-redirecionamento sem clique) → toast com botão resolve.
- Disclosure obrigatória na onboarding page + toggle opt-out por loja.
- Lomadee (Casas Bahia / Americanas): o fluxo exige chamada de API para gerar o deep link antes de redirecionar. Implementar quando houver advertiserId e sourceId.
