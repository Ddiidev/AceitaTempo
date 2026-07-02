# AceitaTempo: checklist de publicacao Chrome Web Store

## Pacote
- `manifest.json` em `version: "1.0.3"`.
- `dist/aceita-tempo-chrome.zip` gerado por `npm run package:chrome:zip`.
- ZIP sem arquivos de teste, planos, docs, `dist` aninhado ou artefatos locais.

## Compatibilidade Firefox
- `manifest.firefox.json` em `version: "1.0.3"` e sem host Stripe nesta release.
- `dist/aceita-tempo-firefox.zip` gerado por `npm run package:firefox:zip`.
- Onboarding usa `browser.*` no Firefox e `chrome.*` no Chromium, com fallback de storage sync/local.
- Primeiro install deve abrir `onboarding.html` uma vez e marcar `onboardingSeen`.

## Afiliacao e transparencia
- Listing declara links afiliados ativos em Amazon, Mercado Livre e Instant Gaming.
- Listing declara que AliExpress e Shopee estao desativados nesta versao.
- Politica de privacidade declara Pix, links afiliados e acao explicita do usuario antes de abrir link de apoio.
- Onboarding e opcoes continuam mostrando controle para desativar apoio por afiliado.

## Permissoes
- `storage`: salva salario, horas, moeda, preferencias por site, afiliacao e sessoes sociais locais.
- `alarms`: atualiza/cacheia cambio automatico periodicamente.
- `tabs`: popup consulta aba ativa e pede status da sessao social exibida na pagina atual.
- `host_permissions` `https://open.er-api.com/*`: busca taxa USD/BRL quando cambio automatico esta ativo.
- Content script roda apenas nos marketplaces, lojas digitais e redes sociais suportadas pelo manifesto.

## Privacidade
- Dashboard da Chrome Web Store deve declarar que nao ha venda de dados.
- Declarar que processamento de precos acontece localmente no navegador.
- Declarar que a unica requisicao externa propria do produto e o cambio em `open.er-api.com`.
- Declarar que check-ins sociais sao opcionais, desligados por padrao e armazenados localmente.

## Assets e listing
- Usar `store/listing-pt-BR.md` como texto principal.
- Anexar `icons/icon-128.png`.
- Anexar `store/screenshots/01-options.png`, `02-product.png`, `03-checkout.png`.
- Anexar `store/promotional/small-promo-440x280.png` e `marquee-1400x560.png`.
- URLs:
  - Suporte: `https://ddiidev.github.io/AceitaTempo/support.html`
  - Privacidade: `https://ddiidev.github.io/AceitaTempo/privacy-policy.html`

## Validacao antes do upload
- `npm run smoke:sites`
- `npm run smoke:cart`
- `npm run smoke:games`
- `npm run smoke:social`
- `npm run smoke:firefox-onboarding`
- `npm run smoke:amazon`
- `npm run smoke:period`
- `npm run smoke:aliexpress`
- `npm run smoke:temu`
- `npm run smoke:alibaba`
- `npm run build:assets`
- `npm run normalize:store-screenshots`
- `npm run package:chrome:zip`
- `npm run package:firefox:zip`
