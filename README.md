# AceitaTempo

Extensao Chrome que converte preco em custo de tempo de trabalho.

## Publicacao

O projeto inclui materiais prontos para a Chrome Web Store:

- `assets/icon.svg` e `assets/logo.svg` como base de marca
- `icons/` com os PNGs da extensao
- `docs/` com as paginas de privacidade e suporte para GitHub Pages
- `store/` com textos de listing, checklist e screenshots

### Gerar assets

```bash
npm run build:branding
npm run build:store-assets
```

Ou tudo de uma vez:

```bash
npm run build:assets
```

### Empacotar para upload

```bash
npm run package:zip
```

O pacote final sai em `dist/aceita-tempo.zip`.

### URLs publicas

- Politica de privacidade: `https://ddiidev.github.io/AceitaTempo/privacy-policy.html`
- Suporte: `https://ddiidev.github.io/AceitaTempo/support.html`

## O que faz

- Permite configurar salario mensal e horas trabalhadas por mes, ou informar diretamente o valor por hora.
- Suporta salario em `BRL` ou `USD`.
- Converte precos em `BRL` e `USD` para tempo de trabalho equivalente.
- Atualiza a taxa `USD -> BRL` automaticamente e aceita taxa manual.
- Exibe o calculo ao lado do preco em grandes e-commerces e usa fallback generico.
- Exibe um badge curto `~tempo` ao lado do preco e mostra os detalhes no hover.
- Para itens caros, mostra o tempo em dias, meses e anos em vez de apenas horas.
- Opcionalmente, pode substituir o preco pelas horas de trabalho no lugar do valor.
- Em carrinho/checkout, a extensao tenta calcular o total do pedido em vez de cada item separado.
- UI multilanguage com `pt-BR` e `en`.

## Cobertura

A extensao foi desenhada para funcionar explicitamente em marketplaces grandes, incluindo:

- Amazon
- Mercado Livre
- Magazine Luiza
- eBay
- AliExpress
- Steam
- GOG
- Epic Games
- Shopee
- SHEIN
- Armazem Paraiba
- Americanas
- Casas Bahia
- KaBuM!
- Netshoes
- Walmart
- Target
- Etsy
- Temu
- Best Buy

Tambem existe um detector generico para cobrir outros sites com estruturas parecidas.

## Como instalar

1. Abra `chrome://extensions`.
2. Ative `Developer mode`.
3. Clique em `Load unpacked`.
4. Selecione a pasta [`AceitaTempo`](e:\GitHub\AceitaTempo).

## Como usar

1. Abra as opcoes da extensao.
2. Configure:
   - tipo de salario: mensal ou por hora
   - salario mensal e horas por mes (modo mensal), ou valor por hora (modo por hora)
   - moeda do salario
   - modo de cambio automatico ou manual
   - opcionalmente, ative a substituicao do preco pelas horas de trabalho
3. Visite paginas de produto ou listagem em sites suportados.
4. A extensao adiciona um badge ao lado do preco com o tempo de trabalho estimado, ou substitui o preco pelas horas quando a opcao estiver ativa.
5. Ao passar o mouse no badge, a extensao mostra detalhes de preco, cambio e valor/hora.
6. Em carrinho/checkout, ela tenta destacar o total da compra.

## Smoke test

Para rodar a validacao com Playwright:

1. Instale as dependencias com `npm install`.
2. Rode `npm run smoke:sites`.
3. Rode `npm run smoke:cart` para validar o modo de carrinho.
4. Rode `npm run smoke:aliexpress` e `npm run smoke:games` para cobrir fixtures especificas.

As evidencias sao salvas em `playwright-artifacts/`.

## Chrome Web Store

Antes de publicar:

- gere os assets com `npm run build:assets`
- confirme os screenshots em `store/screenshots/`
- confirme os promo tiles em `store/promotional/`
- publique o conteudo da pasta `docs/` no GitHub Pages
- siga a checklist em `store/publish-checklist.md`

## Observacoes

- O calculo usa `salario / horas-mes` para encontrar o valor da hora.
- Em modo automatico, a taxa de cambio fica em cache e e atualizada periodicamente.
- O detector tenta evitar elementos promocionais, campos de formulario e conteudo nao relacionado a compra, mas o DOM de marketplaces muda com frequencia.
- Alguns marketplaces podem responder com login, captcha ou anti-bot durante a automacao.
