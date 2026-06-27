# Execution Plan: Monetização não-intrusiva (Afiliação + Pix) — AceitaTempo

## Metadata

- Plan ID: 20260626-143200-a1b2c3
- Created at: 2026-06-26
- Request summary: Adicionar monetização via afiliação transparente (toast não-intrusivo em páginas de produto), onboarding pós-instalação, gestão de provedores nas settings com switch "Tudo" + mini QR Pix, doação via QR Code (qualquer valor) com email fallback.
- Mode: PLAN only
- Implementation allowed: No

## 1. Objective

Permitir que o AceitaTempo gere receita de forma transparente e não-intrusiva:

1. **Afiliação**: injetar tag de afiliado na URL do produto quando o usuário opta por apoiar, via toast sutil em página de produto (não no clique de compra, para respeitar TOS Amazon e maximizar contabilização via cookie setado antes do carrinho).
2. **Onboarding**: página própria `onboarding.html` aberta na primeira instalação, explicando a extensão e a afiliação transparente, com QR Pix grande no rodapé.
3. **Settings de afiliados**: seção nova em `options.html` com switch master "Tudo" (+ mini QR ao lado, hover mostra tooltip com QR maior + email) e lista de provedores com afiliado, cada um com switch individual.
4. **Doação Pix**: QR Code (qualquer valor, estático) exposto em onboarding (grande) e em settings (mini + tooltip com email `contato@devtu.qzz.io`).

## 2. Scope

### In scope

- [ ] Onboarding page (`onboarding.html` + `onboarding.css` + `onboarding.js`) aberta na 1ª instalação.
- [ ] Módulo de afiliados (`src/affiliate.js`) com mapeamento siteId → tag/parâmetro de afiliado.
- [ ] Toast não-intrusivo no content script, disparado após 4s em página de produto E após ≥1 hover em badge/tooltip AceitaTempo.
- [ ] Redirecionamento via clique real do usuário no botão do toast (respeita TOS Amazon).
- [ ] Seção "Apoiar o projeto / Afiliados" em `options.html`/`options.js`/`options.css`.
- [ ] Mini QR ao lado do switch "Tudo", com hover tooltip (QR maior + email).
- [ ] QR Pix grande na onboarding page.
- [ ] Keys de storage dedicadas (`affiliateEnabled`, `affiliateDisabledStores`).
- [ ] Throttling do toast via `sessionStorage` (uma vez por produto/sessão por aba).
- [ ] i18n em `_locales/pt_BR` e `_locales/en`.
- [ ] Atualizar `manifest.json` (onboarding flag, web_accessible_resources se necessário).
- [ ] Atualizar `background.js` (`onInstalled` abre onboarding na 1ª vez).
- [ ] Documentar links de programas de afiliados (já em [`afiliados-links.md`](./afiliados-links.md)).

### Out of scope

- Anúncios dentro da extensão (descartado pelo usuário em favor de afiliação + Pix).
- Patreon (mencionado mas não incluído neste plano; pode ser add depois como link externo simples).
- Auto-redirecionamento sem clique (viola TOS Amazon).
- Programa de afiliados para Steam/GOG/Epic (não existem).
- Dashboard dedicado (UI vive em options; não há página de dashboard separada).
- Interceptar carrinho/checkout (tarde demais para contabilização; evita ser intrusivo).
- Reescrever `href` no DOM (Opção B) — descartada neste plano em favor do toast + clique real.

## 3. Methodical Analysis

### User request interpretation

O usuário quer monetizar o AceitaTempo de modo não-intrusivo. Escolheu afiliação transparente como via principal: quando o usuário está numa página de produto, após demonstrar intenção (hover no badge do AceitaTempo) e um delay curto, um toast sutil oferece redirecionar a mesma página com a tag de afiliado do projeto (clique real do usuário, sem custo extra). Gestão de opt-out por provedor nas settings, com switch master "Tudo" e mini QR Pix ao lado. Onboarding apenas explica (sem configuração). Doação via QR Pix (qualquer valor) com email fallback.

### Current context inspected

- [`manifest.json`](../../manifest.json): MV3, perms `storage/alarms/tabs`, host_perms só `open.er-api.com`. Content scripts em marketplaces + sociais. `options_page: options.html`.
- [`background.js`](../../background.js): `onInstalled` seta defaults + alarme cotação. Ponto para abrir onboarding.
- [`popup.html`](../../popup.html) / [`popup.js`](../../popup.js): popup compacto com calculadora; não será tocado (QR fica em onboarding/settings).
- [`options.html`](../../options.html): seções core/display/sites/social-awareness/advanced. Adicionar nova seção "Apoiadores / Afiliados".
- [`options.js`](../../options.js): `renderSiteToggles` (padrão para reusar), `disabledSiteNames` existente (NÃO reusar para afiliados).
- [`src/site-config.js`](../../src/site-config.js): `getSiteConfig` retorna `{kind:'commerce'|'social', siteId, name, hostPatterns}`. `siteId` via `toSiteId(name)`. Commerce sites têm `kind:'commerce'`.
- [`src/content.js`](../../src/content.js): `showTooltip(anchor, model)` em `mouseenter` (linhas 1412, 1616-1619, 1658-1661). State `state.tooltipAnchor`. Posso plugar flag `badgeHovered=true` em `showTooltip`. Página de produto detectável via `state.siteConfig?.kind === 'commerce'` + presença de scope/produto.
- [`_locales/pt_BR/messages.json`](../../_locales/pt_BR/messages.json) e [`_locales/en/messages.json`](../../_locales/en/messages.json): padrão de chaves `data-i18n`.
- [`pix-qrcode.png`](../../pix-qrcode.png): já existe na raiz do repo.

### Requirements

#### Functional requirements

- Onboarding abre automaticamente na 1ª instalação (flag `onboardingSeen`).
- Toast aparece em página de produto após 4s E ≥1 hover em badge AceitaTempo, uma vez por produto/sessão/aba.
- Botão do toast redireciona (clique real) para mesma URL + tag de afiliado do provedor.
- Switch "Tudo" liga/desliga afiliado global; lista de provedores ativa/desativa por siteId.
- Provedores sem afiliado (Steam/GOG/Epic) não aparecem na lista.
- Mini QR ao lado do "Tudo": hover → tooltip com QR maior + email `contato@devtu.qzz.io`.
- QR Pix grande na onboarding.
- Disclosure clara: afiliação é opcional, transparência, opt-out fácil.

#### Non-functional requirements

- Não intrusivo: toast sutil, descartável, uma vez por sessão.
- Respeitar TOS Amazon (clique real, disclosure).
- Latência baixa: toast só após intenção detectada.
- Privacidade: nenhuma nova permissão de host (afiliado é só reescrever URL no clique do usuário; sem tracking extra).
- Compatível Chrome e Firefox (manifest firefox espelhar).
- i18n pt_BR + en.
- Não quebrar comportamento existente (badges, tooltips, social awareness).

### Assumptions

- `pix-qrcode.png` é um QR Pix **estático** (sem valor embutido) → usuário digita valor ao pagar.
- Usuário cadastra tags de afiliado próprias em cada programa e preenche o mapeamento (placeholders `SEUTAG-20` etc. no plano; implementação usa constantes editáveis).
- Afiliação só em lojas com programa público (Amazon, AliExpress, Shopee, ML, eBay, Magalu, Temu, SHEIN, Americanas).
- `onboardingSeen=false` por default; setado true após abrir.

### Open questions

- Confirmação final do usuário sobre quais provedores incluir (assumido todos com programa).
- Tags reais de afiliado a injetar (placeholder até cadastro).

No blocking questions. Proceed with the assumptions above.

## 4. Pragmatic Approach

**Chosen approach:** Toast não-intrusivo em página de produto (trigger C: 4s + hover badge), redirecionamento por clique real do usuário, gestão em settings (não onboarding), onboarding só informativa, QR Pix em dois pontos.

**Why preferred:**
- Menor friction com Chrome Store (sem novas permissões, disclosure clara).
- Respeita TOS Amazon (clique real, sem auto-redirect).
- Maximiza contabilização (cookie setado antes do carrinho).
- Não acopla com feature core (`disabledSiteNames` intocado).
- Reusa infra existente (`site-config.js` siteId, `showTooltip` hover handler, `renderSiteToggles` pattern).

**Alternatives considered:**
- Rewrite `href` no DOM (B): detectável, pode quebrar tracking interno, Amazon pode invalidar. Descartada.
- `webNavigation.onBeforeNavigate` (C): exige permissão extra, review rigoroso. Descartada.
- Trigger no clique "Comprar": tarde demais para cookie. Descartada.
- Reusar `disabledSiteNames`: acoplamento com feature core. Descartada.

## 5. Affected Areas

- [`manifest.json`](../../manifest.json): adicionar `onboarding.html` (não precisa listar; páginas da extensão acessíveis direto), ajustar `web_accessible_resources` se usar `pix-qrcode.png` fora de páginas da extensão (não necessário aqui). Possível bump version.
- [`manifest.firefox.json`](../../manifest.firefox.json): espelhar mudanças.
- [`background.js`](../../background.js): `onInstalled` abre `onboarding.html` se `onboardingSeen!==true`; setar flag.
- [`onboarding.html`](../../onboarding.html) (novo): disclosure + QR grande.
- [`onboarding.css`](../../onboarding.css) (novo): estilos.
- [`onboarding.js`](../../onboarding.js) (novo): seta flag, botão "Entendi" abre options.
- [`src/affiliate.js`](../../src/affiliate.js) (novo): mapa siteId→afiliado params, função `buildAffiliateUrl(href, siteId)`, lista `AFFILIATE_STORES` (só com afiliado).
- [`src/content.js`](../../src/content.js): importar `affiliate.js` no manifest content_scripts; flag `badgeHovered` em `showTooltip`; novo módulo de toast (criar elemento, lógica de trigger, redirecionamento).
- [`options.html`](../../options.html): nova seção "Apoiar o projeto / Afiliados" com switch "Tudo" + mini QR + lista provedores.
- [`options.js`](../../options.js): render toggles de afiliados, persistir `affiliateEnabled`/`affiliateDisabledStores`, switch master.
- [`options.css`](../../options.css): estilos da nova seção + tooltip do mini QR.
- [`_locales/pt_BR/messages.json`](../../_locales/pt_BR/messages.json): novas chaves.
- [`_locales/en/messages.json`](../../_locales/en/messages.json): novas chaves.
- [`src/site-config.js`](../../src/site-config.js): adicionar flag `hasAffiliate: true/false` em cada config commerce (ou derivar de lista em `affiliate.js`). Preferência: lista em `affiliate.js` (menos mudança).

## 6. Execution Checklist

### Phase 1 — Preparation

- [ ] Confirmar com usuário lista final de provedores com afiliado (Amazon, AliExpress, Shopee, ML, eBay, Magalu, Temu, SHEIN, Americanas).
- [ ] Obter tags reais de afiliado (ou usar placeholders editáveis) e preencher `src/affiliate.js`.
- [ ] Validar que `pix-qrcode.png` é QR Pix estático (sem valor).

### Phase 2 — Implementation Steps

- [ ] Criar `src/affiliate.js` com `AFFILIATE_STORES` (siteId + builder de query params por loja) e `buildAffiliateUrl(href, siteId)` (Pseudocode: parse URL, append `?tag=...`/`&aff_fbid=...` conforme loja, return nova href).
- [ ] Adicionar `src/affiliate.js` ao array `content_scripts.js` em [`manifest.json`](../../manifest.json) e [`manifest.firefox.json`](../../manifest.firefox.json).
- [ ] Criar `onboarding.html` + `onboarding.css` + `onboarding.js` (disclosure afiliação + QR grande + botão "Entendi" → abre options).
- [ ] Atualizar [`background.js`](../../background.js): em `onInstalled`, se `onboardingSeen!==true`, `chrome.tabs.create({url:'onboarding.html'})` e setar flag `onboardingSeen=true`.
- [ ] Em [`src/content.js`](../../src/content.js): setar `state.badgeHovered=true` dentro de `showTooltip` (linha ~1412); criar função `maybeShowAffiliateToast()` com timer 4s após detectar página de produto (kind commerce + produto encontrado) + checagem `badgeHovered` + throttle via `sessionStorage` chave `aceitaTempo_affiliate_toast_<siteId>_<productId>`.
- [ ] Implementar elemento toast no content script (canto inferior direito,.dismissível, com botão "Apoiar com link de afiliado" + texto disclosure itálico pequeno + link "desativar para esta loja" que abre options).
- [ ] Botão do toast: `chrome.runtime.sendMessage` ou `window.location.assign(buildAffiliateUrl(location.href, siteId))` (clique real).
- [ ] Adicionar seção "Apoiar o projeto / Afiliados" em [`options.html`](../../options.html): switch "Tudo" + span mini QR (img `pix-qrcode.png`) ao lado + tooltip hover (QR maior + email) + container `#affiliateToggles`.
- [ ] Em [`options.js`](../../options.js): `renderAffiliateToggles(affiliateDisabledStores)` (padrão similar a `renderSiteToggles`), persistir em `affiliateDisabledStores`, switch master `affiliateEnabled`, abrir options via link do toast.
- [ ] Estilos em [`options.css`](../../options.css): nova seção + tooltip mini QR (`.affiliate-qr-tooltip`).
- [ ] Adicionar chaves i18n em [`_locales/pt_BR/messages.json`](../../_locales/pt_BR/messages.json) e [`_locales/en/messages.json`](../../_locales/en/messages.json): onboarding*, affiliateToast*, affiliateSettings*, pixDonate*.
- [ ] Adicionar defaults em `DEFAULT_SETTINGS` de [`background.js`](../../background.js) e [`popup.js`](../../popup.js): `affiliateEnabled:true`, `affiliateDisabledStores:[]`, `onboardingSeen:false` (storage separado, não settings).

### Phase 3 — Tests and Validation

- [ ] Carregar extensão unpacked em Chrome; verificar onboarding abre na 1ª instalação.
- [ ] Reinstalar/refresh: onboarding não reabre (flag setada).
- [ ] Abrir página de produto Amazon; hover em badge AceitaTempo; aguardar 4s; verificar toast aparece; descartar; recarregar → não reaparece (sessionStorage).
- [ ] Clicar botão do toast → URL recarrega com `?tag=...`; verificar sem erro.
- [ ] Desativar Amazon nas settings → toast não aparece mais em Amazon.
- [ ] Desativar "Tudo" → toast não aparece em nenhuma loja.
- [ ] Hover no mini QR nas settings → tooltip mostra QR maior + email.
- [ ] Rodar `npm run smoke:sites` e `npm run smoke:cart` → sem regressão em badges/tooltips.
- [ ] Verificar Firefox (manifest.firefox.json) carrega sem erro.
- [ ] Validar i18n: alternar locale Chrome para en → textos traduzidos.

### Phase 4 — Review

- [ ] Confirmar disclosure visível (onboarding + toast + settings).
- [ ] Confirmar nenhum tracking novo / nova permissão host.
- [ ] Confirmar `disabledSiteNames` (core) intocado.
- [ ] Atualizar [`AGENTS.md`](../../AGENTS.md) com nova feature (seção Features).
- [ ] Salvar contexto no Engram (conforme AGENTS.md).

## 7. Validation Plan

### Automated validation

- [ ] `npm run smoke:sites` — badges/tooltips em marketplaces sem regressão.
- [ ] `npm run smoke:cart` — carrinho sem regressão.
- [ ] `npm run smoke:games` — Steam/GOG/Epic sem regressão (e sem toast, esperado).
- [ ] Verificar `GetDiagnostics` em arquivos JS novos/editados.

### Manual validation

- [ ] Fluxo completo: instalar → onboarding → settings desativar provedor → página produto → toast → redirecionamento.
- [ ] Mini QR hover tooltip.
- [ ] Throttle sessionStorage.

### Regression checks

- [ ] Badges continuam aparecendo em lojas com afiliado desativado (afiliado ≠ core).
- [ ] Social awareness intocado.
- [ ] Câmbio automático funciona.

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Chrome Store rejeita por afiliação sem disclosure | High | Onboarding com disclosure clara + opt-out fácil + botão desativar no toast. |
| Amazon invalida comissão por auto-redirect | Medium | Toast exige clique real do usuário no botão. |
| Toast enjoativo → uninstall | Medium | Trigger C (só após hover + 4s), throttle sessionStorage uma vez/produto/sessão, opt-out granular. |
| Tag de afiliado quebra URL de SPAs (history API) | Medium | `buildAffiliateUrl` robusto (preserva query/fragment); testar por loja. |
| Provedor muda formato de afiliado | Low | Mapa isolado em `src/affiliate.js` fácil de atualizar. |
| `pix-qrcode.png` com valor embutido | Medium | Confirmar é estático; se não, regerar. |
| Firefox AMO review rigorosa para afiliados | Medium | Disclosure agressiva + opt-out granular por loja. |

## 9. Dependencies

### Internal dependencies

- `src/site-config.js` (siteId, kind commerce).
- `src/content.js` (showTooltip, state, observer).
- `options.js` (renderSiteToggles pattern).
- `background.js` (onInstalled, DEFAULT_SETTINGS).

### External dependencies

- Programas de afiliados (cadastro manual do usuário) — ver [`afiliados-links.md`](./afiliados-links.md).
- `pix-qrcode.png` existente.

## 10. Implementation Notes for the Next Agent

- **Não reusar `disabledSiteNames`** para afiliados. Usar `affiliateEnabled` + `affiliateDisabledStores`.
- Throttle do toast: `sessionStorage.setItem('aceitaTempo_affiliate_toast_<siteId>_<productId>', '1')`. Chave de produto: hash curto do `href` ou ASIN/ID detectado.
- Trigger C: flag `state.badgeHovered` setada uma vez em `showTooltip`; toast só dispara se `badgeHovered && Date.now()-produtoDetectedAt >= 4000`.
- `buildAffiliateUrl`: switch por `siteId` para formato de params (Amazon `tag`, AliExpress `aff_fbid`, Shopee `af_siteid`, ML `af_id`, eBay `mkcid/mkevt`, Magalu `partner_id`, Temu `aff_fbid`, SHEIN shortlink, Americanas via Awin/Lomadee deep link).
- Onboarding **sem** configuração de provedores; só disclosure + QR + botão "Entendi → abrir settings".
- Mini QR nas settings ao lado do switch "Tudo": usar `<img src="../pix-qrcode.png">` (path relativo desde options.html na raiz).
- i18n: todas strings via `chrome.i18n.getMessage` / `data-i18n`.
- Atualizar `manifest.firefox.json` espelhando `manifest.json`.
- Não adicionar novas host_permissions (afiliado não fetch nada novo).
- Seguir AGENTS.md: salvar contexto no Engram, atualizar AGENTS.md, sem co-author Codex em commits.

## 11. Completion Criteria

The implementation can be considered complete when:

- [ ] Onboarding abre na 1ª instalação e não reabre depois.
- [ ] Toast aparece em página de produto após 4s + hover, uma vez por produto/sessão, com botão de redirecionamento (clique real) e opt-out.
- [ ] Settings têm seção de afiliados com switch "Tudo" + mini QR (hover tooltip) + lista de provedores.
- [ ] Provedores sem afiliado não aparecem na lista.
- [ ] QR Pix visível em onboarding (grande) e settings (mini + email).
- [ ] Disclosure clara em onboarding, toast e settings.
- [ ] i18n pt_BR + en.
- [ ] Sem regressão em smoke tests.
- [ ] Chrome e Firefox carregam sem erro.

## 12. Self-Validation

Before finalizing this plan, verify:

- [x] The plan does not implement anything.
- [x] All tasks are actionable.
- [x] All tasks are ordered.
- [x] Each task has a validation path.
- [x] Risks and assumptions are documented.
- [x] File references are included where useful.
- [x] The plan is stored only under `.plans/20260626-143200-a1b2c3-monetizacao-afiliacao-pix/`.
