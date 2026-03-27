(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  const PriceUtils = globalObj.AceitaTempoPriceUtils;
  const SiteConfig = globalObj.AceitaTempoSiteConfig;

  if (!PriceUtils || !SiteConfig) {
    return;
  }

  const BADGE_ATTR = 'data-aceita-tempo-badge';
  const TARGET_ATTR = 'data-aceita-tempo-target';
  const SCOPE_ATTR = 'data-aceita-tempo-scope';
  const TOOLTIP_ATTR = 'data-aceita-tempo-tooltip';
  const HIDDEN_ATTR = 'data-aceita-tempo-hidden';
  const STYLE_ID = 'aceita-tempo-style';
  const TOOLTIP_ID = 'aceita-tempo-tooltip';
  const STORAGE_KEYS = [
    'salaryAmount',
    'monthlyHours',
    'salaryCurrency',
    'wageMode',
    'hourlyRate',
    'extendedTimeDisplay',
    'extendedTimeDayMode',
    'replacePricesWithHours',
    'exchangeRateMode',
    'exchangeRateUsdToBrl',
    'manualUsdToBrlRate',
    'manualExchangeRate',
    'exchangeRate',
    'enableExternalSites',
    'disableExternalSites',
    'disabledSiteNames',
  ];
  const GENERIC_SCOPE_SELECTORS = SiteConfig.productScopeSelectors || [];
  const NOISE_TEXT_PATTERN = /(shipping|delivery|coupon|save\s+\d+%|frete|cupom|parcelad|sem juros|bought|reviews?|avalia|termina em|off\b|pix\b)/i;
  const SECONDARY_HINT_PATTERN = /(a-text-price|old-price|original-price|list-price|price-old|price-original|strike|strikethrough|crossed|compare-at|regular-price)/i;
  const SECONDARY_TEXT_PATTERN = /^(list price|old price|was\b|de:\s|por de\b|preco anterior|preço anterior)\b/i;
  const LETTER_PATTERN = /[A-Za-zÀ-ÿ]/;
  const CART_PAGE_PATTERN = /(cart|basket|bag|checkout|payment|carrinho|pagamento|finalizar|order-summary|summary)/i;
  const TOTAL_CONTEXT_PATTERN = /(grand total|order total|final total|total final|subtotal|total da compra|valor total|resumo do pedido|resumo da compra|payment summary|order summary|amount due|a pagar|to pay|checkout total)/i;
  const TOTAL_NOISE_PATTERN = /(shipping|frete|delivery|tax|vat|coupon|discount|desconto|promo|gift|points|parcel|installment|juros|pix)/i;
  const ALIEXPRESS_PROMO_TEXT_PATTERN = /(poupe|save|novo usu[aá]rio|new user|combos? de ofertas?|bundle deals?|top vendas?|top selling|sold|vendido|choice|promo|superofertas?|discount|desconto|coupon|cupom|off\b)/i;

  const state = {
    settings: null,
    siteConfig: null,
    locale: /^pt/i.test((document.documentElement && document.documentElement.lang) || navigator.language || '') ? 'pt-BR' : 'en-US',
    scopeSeq: 0,
    scheduled: false,
    observer: null,
    tooltipElement: null,
    tooltipAnchor: null,
    tooltipRafId: null,
  };

  function storageArea() {
    try {
      return chrome.storage?.sync ?? chrome.storage?.local ?? null;
    } catch {
      return null;
    }
  }

  function readSettings() {
    const area = storageArea();
    if (!area) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      try {
        area.get(STORAGE_KEYS, (items) => resolve(items || {}));
      } catch {
        resolve({});
      }
    });
  }

  function isTruthySetting(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function normalizeSettings(raw) {
    const disabledSiteNames = Array.isArray(raw.disabledSiteNames)
      ? raw.disabledSiteNames
      : Array.isArray(raw.disabledSites)
        ? raw.disabledSites
        : [];

    return {
      salaryAmount: Number(raw.salaryAmount ?? raw.salaryMonthly ?? raw.salary_value ?? raw.salary) || 0,
      monthlyHours: Number(raw.monthlyHours ?? raw.hoursMonthly ?? raw.hours_value ?? raw.hours) || 0,
      salaryCurrency: String(raw.salaryCurrency ?? 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL',
      wageMode: String(raw.wageMode ?? 'monthly').toLowerCase() === 'hourly' ? 'hourly' : 'monthly',
      hourlyRate: Math.max(0, Number(raw.hourlyRate) || 0),
      extendedTimeDisplay: isTruthySetting(raw.extendedTimeDisplay ?? true),
      extendedTimeDayMode: String(raw.extendedTimeDayMode ?? 'calendar').toLowerCase() === 'working' ? 'working' : 'calendar',
      replacePricesWithHours: isTruthySetting(raw.replacePricesWithHours ?? raw.replacePrices ?? raw.substituteValuesWithHours),
      exchangeRateMode: String(raw.exchangeRateMode ?? raw.exchangeMode ?? 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto',
      exchangeRateUsdToBrl: Number(raw.exchangeRateUsdToBrl ?? raw.exchangeRate ?? raw.exchange_rate) || 0,
      manualUsdToBrlRate: Number(raw.manualUsdToBrlRate ?? raw.manualExchangeRate) || 0,
      enableExternalSites: isTruthySetting(raw.enableExternalSites ?? raw.enableExternal ?? raw.allowExternalSites),
      disabledSiteNames: disabledSiteNames.map((value) => String(value)).filter(Boolean),
    };
  }

  function isSiteDisabled(hostname) {
    const siteName = state.siteConfig?.name;
    if (!state.settings?.enableExternalSites && !state.siteConfig) {
      return true;
    }

    return Boolean(siteName && state.settings?.disabledSiteNames?.includes(siteName));
  }

  function shouldSkipCurrentPage() {
    return isSiteDisabled(location.hostname);
  }

  function getLocale() {
    return String((document.documentElement && document.documentElement.lang) || navigator.language || state.locale || 'en-US');
  }

  function usesStructuredPriceConfig() {
    return Boolean(
      state.siteConfig?.cardSelectors?.length &&
      state.siteConfig?.primaryPriceRowSelectors?.length &&
      state.siteConfig?.primaryPriceValueSelectors?.length
    );
  }

  function preferredCurrencyForHost(hostname) {
    return String(hostname || '').toLowerCase().includes('.br') ? 'BRL' : 'USD';
  }

  function isCartOrCheckoutPage() {
    const urlText = `${location.href} ${location.pathname} ${location.search} ${location.hash}`.toLowerCase();
    if (CART_PAGE_PATTERN.test(urlText)) {
      return true;
    }

    const bodyText = PriceUtils.normalizeWhitespace(document.body?.innerText || '').toLowerCase();
    return /(resumo do pedido|subtotal|total do pedido|finalizar compra|order summary|proceed to checkout|payment summary|amount due|checkout summary)/i.test(bodyText);
  }

  function getNearbyText(element) {
    const parts = [
      element?.innerText || '',
      element?.parentElement?.innerText || '',
      element?.previousElementSibling?.innerText || '',
      element?.nextElementSibling?.innerText || '',
    ];

    return PriceUtils.normalizeWhitespace(parts.join(' '));
  }

  function isTotalContext(element, text) {
    const hintText = getElementHintText(element);
    const nearbyText = getNearbyText(element);
    const combined = `${hintText} ${text || ''} ${nearbyText}`.toLowerCase();

    if (!combined || !TOTAL_CONTEXT_PATTERN.test(combined)) {
      return false;
    }

    if (TOTAL_NOISE_PATTERN.test(hintText) && !/(total|subtotal|resumo|order|checkout|payment|amount due|a pagar|to pay)/.test(combined)) {
      return false;
    }

    return true;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [${BADGE_ATTR}="1"] {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
        margin-inline-start: 0.38em;
        padding: 0.14em 0.5em;
        border-radius: 999px;
        box-sizing: border-box;
        font: 700 0.75em/1.25 Aptos, "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
        letter-spacing: 0;
        color: #14532d;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(21, 128, 61, 0.18);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        white-space: nowrap;
        cursor: help;
      }

      [${BADGE_ATTR}="1"][data-compact="1"] {
        padding-block: 0.06em;
        padding-inline: 0.45em;
        line-height: 1;
      }

      [${BADGE_ATTR}="1"][data-inline="1"] {
        display: inline;
        margin-inline-start: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        color: inherit;
        cursor: help;
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-weight: 700;
        letter-spacing: -0.02em;
        white-space: nowrap;
      }

      [${HIDDEN_ATTR}="1"] {
        display: none !important;
      }

      #${TOOLTIP_ID} {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        display: block;
        max-width: min(340px, calc(100vw - 24px));
        padding: 20px 22px;
        border-radius: 24px;
        border: 1px solid rgba(30, 26, 23, 0.12);
        background: rgba(255, 255, 255, 0.82);
        color: #1e1a17;
        box-shadow: 0 18px 50px rgba(53, 38, 25, 0.12);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        font: 600 13px/1.45 Aptos, "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
        letter-spacing: 0;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transform: translate3d(0, 6px, 0) scale(0.985);
        transform-origin: center top;
        transition:
          opacity 120ms ease,
          transform 120ms ease,
          visibility 120ms ease;
        contain: layout style paint;
        box-sizing: border-box;
      }

      #${TOOLTIP_ID}[data-visible="1"] {
        opacity: 1;
        visibility: visible;
        transform: translate3d(0, 0, 0) scale(1);
      }

      #${TOOLTIP_ID},
      #${TOOLTIP_ID} * {
        box-sizing: border-box;
      }

      #${TOOLTIP_ID} .aceita-tempo-tooltip__eyebrow {
        margin: 0 0 8px;
        color: #0f766e;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      #${TOOLTIP_ID} .aceita-tempo-tooltip__title {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-size: 16px;
        line-height: 1.08;
        letter-spacing: -0.03em;
      }

      #${TOOLTIP_ID} .aceita-tempo-tooltip__body {
        margin: 8px 0 0;
        color: #1e1a17;
        font-size: 13px;
        line-height: 1.45;
      }

      #${TOOLTIP_ID} .aceita-tempo-tooltip__meta {
        margin: 8px 0 0;
        color: #6b625a;
        font-size: 12px;
        line-height: 1.35;
      }

      #${TOOLTIP_ID} .aceita-tempo-tooltip__conversion {
        margin: 6px 0 0;
        color: #115e59;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function isVisible(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function isExcludedElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    const exclusionSelector = SiteConfig.sharedExclusions.join(',');
    return Boolean(
      element.closest(exclusionSelector) ||
      element.closest('[contenteditable="true"]') ||
      element.closest(`[${BADGE_ATTR}="1"]`)
    );
  }

  function getElementText(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    return PriceUtils.normalizePriceText(element.innerText || element.textContent || '');
  }

  function getElementHintText(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const attrs = [
      element.className || '',
      element.id || '',
      Object.keys(element.dataset || {}).join(' '),
      element.getAttribute('data-testid') || '',
      element.getAttribute('data-test') || '',
      element.getAttribute('data-qa') || '',
      element.getAttribute('itemprop') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('data-a-strike') || '',
    ];

    return attrs.join(' ').toLowerCase();
  }

  function hasPriceLikeHint(element) {
    return /price|money|amount|valor|preco|preço|sale|promo|offer/.test(getElementHintText(element));
  }

  function getFontSizeScore(element) {
    const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize || '0');
    return Math.min(4, Math.max(0, fontSize / 8));
  }

  function elementMatchesAny(element, selectors) {
    if (!element || !selectors?.length) {
      return false;
    }

    return selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch {
        return false;
      }
    });
  }

  function queryElementsBySelectors(scope, selectors) {
    if (!scope || !selectors?.length) {
      return [];
    }

    const elements = new Set();

    selectors.forEach((selector) => {
      try {
        scope.querySelectorAll(selector).forEach((element) => elements.add(element));
      } catch {
        // ignore bad selectors
      }
    });

    return [...elements];
  }

  function findFirstDescendantBySelectors(scope, selectors) {
    if (!scope || !selectors?.length) {
      return null;
    }

    for (const selector of selectors) {
      try {
        const match = scope.querySelector(selector);
        if (match) {
          return match;
        }
      } catch {
        // ignore bad selectors
      }
    }

    return null;
  }

  function hasStrikeThrough(element) {
    const style = window.getComputedStyle(element);
    const textDecoration = `${style.textDecoration || ''} ${style.textDecorationLine || ''}`.toLowerCase();
    return textDecoration.includes('line-through');
  }

  function isSecondaryPriceCandidate(element, text) {
    const hintText = getElementHintText(element);
    const normalizedText = PriceUtils.normalizeWhitespace(text || '');

    return Boolean(
      SECONDARY_HINT_PATTERN.test(hintText) ||
      (normalizedText.length <= 36 && SECONDARY_TEXT_PATTERN.test(normalizedText)) ||
      String(element.getAttribute('data-a-strike') || '').toLowerCase() === 'true' ||
      hasStrikeThrough(element) ||
      element.closest('.a-text-price,[data-a-strike="true"],s,strike,del')
    );
  }

  function stripPriceText(text) {
    return PriceUtils.normalizeWhitespace(
      String(text || '')
        .replace(/(?:R\$|US\$|USD|BRL|\$)/gi, ' ')
        .replace(/[0-9.,]/g, ' ')
        .replace(/[~\-–—/|+():]/g, ' ')
    );
  }

  function getCompactPriceMatch(text, preferredCurrency) {
    const normalizedText = PriceUtils.normalizePriceText(text);
    const matches = PriceUtils.extractAllPriceMatches(normalizedText, preferredCurrency);
    if (!matches.length || normalizedText.length > 56) {
      return null;
    }

    const stripped = PriceUtils.stripPriceContextWords(stripPriceText(normalizedText));
    if (LETTER_PATTERN.test(stripped)) {
      return null;
    }

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length === 2) {
      const [firstMatch, secondMatch] = matches;
      if (
        firstMatch.currency === secondMatch.currency &&
        Math.abs(firstMatch.amount - secondMatch.amount) < 0.001 &&
        /^[\s0-9R$USDBRL.,\-–—/]+$/i.test(normalizedText)
      ) {
        return firstMatch;
      }
    }

    if (
      matches.length === 3 &&
      matches.every((match) => match.currency === matches[0].currency) &&
      matches.every((match) => Math.abs(match.amount - matches[0].amount) < 0.001) &&
      /^[\s0-9R$USDBRL.,\-–—/]+$/i.test(normalizedText)
    ) {
      return matches[0];
    }

    return null;
  }

  function getAmazonPriceFallbackText(element, preferredCurrency) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const wholeText = PriceUtils.normalizeWhitespace(
      element.querySelector?.('.a-price-whole')?.textContent ||
      element.parentElement?.querySelector?.('.a-price-whole')?.textContent ||
      ''
    ).replace(/[^\d]/g, '');
    const fractionText = PriceUtils.normalizeWhitespace(
      element.querySelector?.('.a-price-fraction')?.textContent ||
      element.parentElement?.querySelector?.('.a-price-fraction')?.textContent ||
      ''
    ).replace(/[^\d]/g, '');
    const symbolText = PriceUtils.normalizeWhitespace(
      element.querySelector?.('.a-price-symbol')?.textContent ||
      element.parentElement?.querySelector?.('.a-price-symbol')?.textContent ||
      (preferredCurrency === 'BRL' ? 'R$' : 'US$')
    );

    if (wholeText && fractionText) {
      const decimalSeparator = preferredCurrency === 'USD' ? '.' : ',';
      return `${symbolText}${wholeText}${decimalSeparator}${fractionText}`;
    }

    const offscreenText =
      element.querySelector?.('.a-offscreen')?.textContent ||
      element.parentElement?.querySelector?.('.a-offscreen')?.textContent ||
      element.getAttribute?.('aria-label') ||
      element.parentElement?.getAttribute?.('aria-label') ||
      '';

    return PriceUtils.normalizeWhitespace(offscreenText);
  }

  function getAmazonAnchorElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return element;
    }

    try {
      const closestPriceWrapper = element.closest('span.a-price, .apex-pricetopay-value, .priceToPay, .reinventPricePriceToPayMargin');
      if (closestPriceWrapper) {
        return closestPriceWrapper;
      }

      return findFirstDescendantBySelectors(element, [
        'span.a-price',
        '.apex-pricetopay-value',
        '.priceToPay',
        '.reinventPricePriceToPayMargin',
      ]) || element;
    } catch {
      return element;
    }
  }

  function isAmazonPriceContext(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    try {
      return Boolean(
        element.closest('span.a-price, .apex-pricetopay-value, .priceToPay, .reinventPricePriceToPayMargin') ||
        findFirstDescendantBySelectors(element, [
          'span.a-price',
          '.apex-pricetopay-value',
          '.priceToPay',
          '.reinventPricePriceToPayMargin',
        ])
      );
    } catch {
      return false;
    }
  }

  function scoreAnchor(element, parsedPrice, text, fromSiteSelector, level) {
    let score = 0;

    score += getFontSizeScore(element);
    score += parsedPrice.explicitCurrency ? 2 : 0;
    score += fromSiteSelector ? 4 : 0;
    score += hasPriceLikeHint(element) ? 2 : 0;
    score += text.length <= 18 ? 3 : text.length <= 32 ? 2 : 0;
    score += element.childElementCount <= 2 ? 2 : element.childElementCount <= 4 ? 1 : -2;
    score -= level * 2;
    score -= NOISE_TEXT_PATTERN.test(text) ? 6 : 0;
    score -= isSecondaryPriceCandidate(element, text) ? 12 : 0;

    return score;
  }

  function resolveBestAnchor(element, preferredCurrency) {
    let current = element;
    let level = 0;
    let best = null;

    while (current && current !== document.body && level < 4) {
      const candidateElement = state.siteConfig?.name === 'Amazon'
        ? getAmazonAnchorElement(current)
        : current;

      if (!isVisible(candidateElement) || isExcludedElement(candidateElement)) {
        current = current.parentElement;
        level += 1;
        continue;
      }

      const text = getElementText(candidateElement) || getElementText(current);
      if (!text || text.length > 72 || isSecondaryPriceCandidate(candidateElement, text)) {
        current = current.parentElement;
        level += 1;
        continue;
      }

      const parsedPrice = getCompactPriceMatch(text, preferredCurrency);
      const amazonFallback = !parsedPrice && state.siteConfig?.name === 'Amazon' && isAmazonPriceContext(candidateElement)
        ? getAmazonPriceFallbackText(candidateElement, preferredCurrency) || getAmazonPriceFallbackText(current, preferredCurrency)
        : '';
      const amazonParsedPrice = amazonFallback ? getCompactPriceMatch(amazonFallback, preferredCurrency) : null;
      if (parsedPrice || amazonParsedPrice) {
        const resolvedPrice = parsedPrice || amazonParsedPrice;
        const resolvedText = parsedPrice ? text : amazonFallback || text;
        const score = scoreAnchor(
          candidateElement,
          resolvedPrice,
          resolvedText,
          elementMatchesAny(candidateElement, state.siteConfig?.selectors || []),
          level
        );

        if (
          !best ||
          score > best.score ||
          (score === best.score && level < best.level) ||
          (score === best.score && level === best.level && resolvedText.length < best.text.length)
        ) {
          best = { element: candidateElement, parsedPrice: resolvedPrice, text: resolvedText, score, level };
        }

        if (best.level === 0 && best.score >= 10) {
          return best;
        }
      }

      current = current.parentElement;
      level += 1;
    }

    return best;
  }

  function getTotalCandidateSelectors() {
    const siteSelectors = state.siteConfig?.totalSelectors || [];
    const fallbackSelectors = [
      '[data-testid*="total" i]',
      '[data-testid*="subtotal" i]',
      '[data-testid*="summary" i]',
      '[data-testid*="checkout" i]',
      '[class*="total" i]',
      '[class*="subtotal" i]',
      '[class*="summary" i]',
      '[class*="checkout" i]',
      '[class*="payment" i]',
      '[id*="total" i]',
      '[id*="subtotal" i]',
      '[id*="summary" i]',
      '[id*="checkout" i]',
      '[id*="payment" i]',
    ];

    return [...new Set([...siteSelectors, ...fallbackSelectors])];
  }

  function getTotalScopeElement(element) {
    const selectors = state.siteConfig?.totalScopeSelectors?.length
      ? state.siteConfig.totalScopeSelectors
      : [
        '[data-testid*="summary" i]',
        '[data-testid*="checkout" i]',
        '[class*="summary" i]',
        '[class*="checkout" i]',
        '[class*="payment" i]',
        '[class*="cart" i]',
        '[class*="order" i]',
        '[class*="total" i]',
        '[id*="summary" i]',
        '[id*="checkout" i]',
        '[id*="payment" i]',
      ];

    let current = element;
    let level = 0;

    while (current && current !== document.body && level < 8) {
      if (elementMatchesAny(current, selectors)) {
        return current;
      }

      current = current.parentElement;
      level += 1;
    }

    return element.parentElement || element;
  }

  function collectTotalCandidateElements(preferredCurrency) {
    const scope = document.body;
    if (!scope) {
      return [];
    }

    const candidates = new Set();

    getTotalCandidateSelectors().forEach((selector) => {
      try {
        scope.querySelectorAll(selector).forEach((element) => candidates.add(element));
      } catch {
        // ignore bad selectors
      }
    });

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) {
          return NodeFilter.FILTER_SKIP;
        }

        if (isExcludedElement(node) || !isVisible(node)) {
          return NodeFilter.FILTER_SKIP;
        }

        const text = getElementText(node);
        if (!text || text.length > 120) {
          return NodeFilter.FILTER_SKIP;
        }

        if (!/(R\$|US\$|USD|BRL|\$)/i.test(text)) {
          return NodeFilter.FILTER_SKIP;
        }

        if (!isTotalContext(node, text)) {
          return NodeFilter.FILTER_SKIP;
        }

        return getCompactPriceMatch(text, preferredCurrency) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    let count = 0;
    while (walker.nextNode() && count < 240) {
      candidates.add(walker.currentNode);
      count += 1;
    }

    return [...candidates];
  }

  function scoreTotalAnchor(element, parsedPrice, text, level) {
    const nearbyText = getNearbyText(element).toLowerCase();
    let score = 0;

    score += getFontSizeScore(element);
    score += parsedPrice.explicitCurrency ? 3 : 0;
    score += /grand total|order total|final total|total final|total da compra|valor total|a pagar|to pay|amount due|checkout total/.test(nearbyText) ? 6 : 0;
    score += /subtotal/.test(nearbyText) ? 3 : 0;
    score += /summary|checkout|payment|order|cart|bag|basket|resumo/.test(nearbyText) ? 2 : 0;
    score += text.length <= 24 ? 2 : text.length <= 40 ? 1 : 0;
    score += element.childElementCount <= 2 ? 2 : element.childElementCount <= 4 ? 1 : 0;
    score -= level * 2;
    score -= TOTAL_NOISE_PATTERN.test(nearbyText) ? 8 : 0;

    return score;
  }

  function resolveBestTotalAnchor(element, preferredCurrency) {
    let current = element;
    let level = 0;
    let best = null;

    while (current && current !== document.body && level < 6) {
      if (!isVisible(current) || isExcludedElement(current)) {
        current = current.parentElement;
        level += 1;
        continue;
      }

      const text = getElementText(current);
      if (!text || text.length > 160) {
        current = current.parentElement;
        level += 1;
        continue;
      }

      if (!isTotalContext(current, text)) {
        current = current.parentElement;
        level += 1;
        continue;
      }

      const parsedPrice = getCompactPriceMatch(text, preferredCurrency);
      if (parsedPrice) {
        const score = scoreTotalAnchor(current, parsedPrice, text, level);

        if (!best || score > best.score || (score === best.score && text.length < best.text.length)) {
          best = { element: current, parsedPrice, text, score, level };
        }
      }

      current = current.parentElement;
      level += 1;
    }

    return best;
  }

  function addCandidatesFromSelectors(targetSet, selectors, scope) {
    selectors.forEach((selector) => {
      try {
        scope.querySelectorAll(selector).forEach((element) => targetSet.add(element));
      } catch {
        // ignore bad selectors
      }
    });
  }

  function countResolvedCandidates(elements, preferredCurrency) {
    let count = 0;

    for (const element of elements) {
      if (resolveBestAnchor(element, preferredCurrency)) {
        count += 1;
        if (count >= 20) {
          break;
        }
      }
    }

    return count;
  }

  function addLeafWalkerCandidates(targetSet, scope, preferredCurrency) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) {
          return NodeFilter.FILTER_SKIP;
        }

        if (isExcludedElement(node) || !isVisible(node)) {
          return NodeFilter.FILTER_SKIP;
        }

        const text = getElementText(node);
        if (!text || text.length > 56) {
          return NodeFilter.FILTER_SKIP;
        }

        if (!/(R\$|US\$|USD|BRL|\$)/i.test(text) && !hasPriceLikeHint(node)) {
          return NodeFilter.FILTER_SKIP;
        }

        if (node.childElementCount > 4 && !hasPriceLikeHint(node)) {
          return NodeFilter.FILTER_SKIP;
        }

        return getCompactPriceMatch(text, preferredCurrency) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    let count = 0;
    while (walker.nextNode() && count < 240) {
      targetSet.add(walker.currentNode);
      count += 1;
    }
  }

  function collectCandidateElements(preferredCurrency) {
    const scope = document.body;
    if (!scope) {
      return [];
    }

    const candidates = new Set();
    const siteSelectors = state.siteConfig?.selectors || [];

    if (siteSelectors.length) {
      addCandidatesFromSelectors(candidates, siteSelectors, scope);
    }

    addCandidatesFromSelectors(candidates, SiteConfig.sharedSelectors, scope);

    addLeafWalkerCandidates(candidates, scope, preferredCurrency);

    return [...candidates];
  }

  function getScopeElement(element, preferredCurrency) {
    const selectors = state.siteConfig?.scopeSelectors?.length
      ? state.siteConfig.scopeSelectors
      : GENERIC_SCOPE_SELECTORS;

    let current = element;
    let level = 0;

    while (current && current !== document.body && level < 8) {
      if (elementMatchesAny(current, selectors)) {
        return current;
      }

      current = current.parentElement;
      level += 1;
    }

    current = element.parentElement;
    level = 0;
    while (current && current !== document.body && level < 4) {
      const text = getElementText(current);
      const priceMatches = PriceUtils.extractAllPriceMatches(text, preferredCurrency).length;

      if (text && text.length < 320 && priceMatches >= 1 && priceMatches <= 2 && current.childElementCount <= 12) {
        return current;
      }

      current = current.parentElement;
      level += 1;
    }

    return element.parentElement || element;
  }

  function getScopeId(element) {
    if (!element) {
      return 'root';
    }

    if (!element.hasAttribute(SCOPE_ATTR)) {
      state.scopeSeq += 1;
      element.setAttribute(SCOPE_ATTR, `aceita-tempo-scope-${state.scopeSeq}`);
    }

    return element.getAttribute(SCOPE_ATTR);
  }

  function normalizeStructuredCardElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const cardRootSelectors = state.siteConfig?.cardRootSelectors || state.siteConfig?.cardSelectors || [];
    if (!cardRootSelectors.length) {
      return element;
    }

    if (elementMatchesAny(element, cardRootSelectors)) {
      return element;
    }

    return findFirstDescendantBySelectors(element, cardRootSelectors) || element;
  }

  function isStructuredSecondaryElement(element, text = '') {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    if (elementMatchesAny(element, state.siteConfig?.secondaryPriceSelectors || [])) {
      return true;
    }

    if (hasStrikeThrough(element)) {
      return true;
    }

    const normalizedText = PriceUtils.normalizeWhitespace(
      text ||
      getElementText(element) ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      ''
    );

    if (!normalizedText) {
      return false;
    }

    const promoPattern = state.siteConfig?.structuredPromoPattern || ALIEXPRESS_PROMO_TEXT_PATTERN;
    return Boolean(
      promoPattern.test(normalizedText) &&
      !/^\s*(?:R\$|US\$|USD|\$)\s*\d/i.test(normalizedText)
    );
  }

  function getStructuredPriceMatch(element, preferredCurrency) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const texts = [
      getElementText(element),
      PriceUtils.normalizePriceText(element.getAttribute('aria-label') || ''),
      PriceUtils.normalizePriceText(element.getAttribute('title') || ''),
      PriceUtils.normalizePriceText(element.parentElement?.getAttribute('aria-label') || ''),
      PriceUtils.normalizePriceText(element.parentElement?.getAttribute('title') || ''),
    ];

    for (const text of texts) {
      const parsedPrice = getCompactPriceMatch(text, preferredCurrency);
      if (parsedPrice) {
        return { parsedPrice, text };
      }
    }

    return null;
  }

  function getStructuredPrimaryRowElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const rowSelectors = state.siteConfig?.primaryPriceRowSelectors || [];
    if (!rowSelectors.length) {
      return element;
    }

    try {
      return element.closest(rowSelectors.join(',')) || element;
    } catch {
      return element;
    }
  }

  function getStructuredPrimaryTarget(candidate) {
    if (!candidate || candidate.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const valueSelectors = state.siteConfig?.primaryPriceValueSelectors || [];
    if (elementMatchesAny(candidate, valueSelectors)) {
      return candidate;
    }

    return findFirstDescendantBySelectors(candidate, valueSelectors) || candidate;
  }

  function scoreStructuredPrimaryTarget(target, rowElement, parsedPrice) {
    let score = 0;

    score += getFontSizeScore(target);
    score += parsedPrice.explicitCurrency ? 2 : 0;
    score += elementMatchesAny(target, state.siteConfig?.primaryPriceValueSelectors || []) ? 8 : 0;
    score += elementMatchesAny(rowElement, state.siteConfig?.primaryPriceRowSelectors || []) ? 4 : 0;
    score += rowElement === target ? 0 : 2;

    return score;
  }

  function resolveStructuredCardPrice(cardElement, preferredCurrency) {
    if (!cardElement) {
      return null;
    }

    if (!isVisible(cardElement)) {
      return null;
    }

    const rowCandidates = queryElementsBySelectors(cardElement, state.siteConfig?.primaryPriceRowSelectors || []);
    const valueCandidates = queryElementsBySelectors(cardElement, state.siteConfig?.primaryPriceValueSelectors || []);
    const candidates = [...new Set([...valueCandidates, ...rowCandidates])];
    let best = null;

    candidates.forEach((candidate) => {
      if (!candidate || isExcludedElement(candidate) || isStructuredSecondaryElement(candidate)) {
        return;
      }

      const target = getStructuredPrimaryTarget(candidate);
      if (!target || isExcludedElement(target) || isStructuredSecondaryElement(target)) {
        return;
      }

      const rowElement = getStructuredPrimaryRowElement(target) || candidate;
      const match = getStructuredPriceMatch(target, preferredCurrency) || getStructuredPriceMatch(rowElement, preferredCurrency);
      if (!match) {
        return;
      }

      const score = scoreStructuredPrimaryTarget(target, rowElement, match.parsedPrice);

      if (!best || score > best.score) {
        best = {
          element: target,
          parsedPrice: match.parsedPrice,
          text: match.text,
          score,
          scopeElement: cardElement,
        };
      }
    });

    return best;
  }

  function collectStructuredItemPrices(preferredCurrency) {
    if (!document.body) {
      return [];
    }

    const rawCards = queryElementsBySelectors(document.body, state.siteConfig?.cardSelectors || []);
    const cards = new Set();

    rawCards.forEach((rawCard) => {
      const normalizedCard = normalizeStructuredCardElement(rawCard);
      if (normalizedCard) {
        cards.add(normalizedCard);
      }
    });

    const winners = [];

    cards.forEach((card) => {
      const resolved = resolveStructuredCardPrice(card, preferredCurrency);
      if (resolved) {
        winners.push(resolved);
      }
    });

    return winners;
  }

  function getPreferredTextStyle(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return { fontSize: '', color: '', lineHeight: '', fontFamily: '' };
    }

    let bestNode = element;
    let bestSize = Number.parseFloat(window.getComputedStyle(element).fontSize || '0');

    element.querySelectorAll('*').forEach((node) => {
      const size = Number.parseFloat(window.getComputedStyle(node).fontSize || '0');
      if (size > bestSize) {
        bestNode = node;
        bestSize = size;
      }
    });

    const computedStyle = window.getComputedStyle(bestNode);
    return {
      fontSize: bestSize > 0 ? `${bestSize}px` : computedStyle.fontSize || '',
      color: computedStyle.color || '',
      lineHeight: computedStyle.lineHeight || '',
      fontFamily: computedStyle.fontFamily || '',
    };
  }

  function clearBadges() {
    hideTooltip();
    document.querySelectorAll(`[${BADGE_ATTR}="1"]`).forEach((badge) => badge.remove());
    document.querySelectorAll(`[${TARGET_ATTR}="1"]`).forEach((element) => element.removeAttribute(TARGET_ATTR));
  }

  function stopObserving() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }

  function setHiddenTargets(targets, enabled) {
    const nextTargets = new Set(targets);

    document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`).forEach((element) => {
      if (!enabled || !nextTargets.has(element)) {
        element.removeAttribute(HIDDEN_ATTR);
      }
    });

    if (!enabled) {
      return;
    }

    targets.forEach((element) => {
      element.setAttribute(HIDDEN_ATTR, '1');
    });
  }

  function getTooltipElement() {
    if (state.tooltipElement && document.contains(state.tooltipElement)) {
      return state.tooltipElement;
    }

    const tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.setAttribute(TOOLTIP_ATTR, '1');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');

    const mountPoint = document.body || document.documentElement;
    mountPoint.appendChild(tooltip);
    state.tooltipElement = tooltip;
    return tooltip;
  }

  function renderTooltipContent(model) {
    const tooltip = getTooltipElement();
    tooltip.replaceChildren();

    const appendTextBlock = (className, text) => {
      if (!text) {
        return;
      }

      const block = document.createElement('div');
      block.className = className;
      block.textContent = text;
      tooltip.appendChild(block);
    };

    appendTextBlock('aceita-tempo-tooltip__eyebrow', model?.eyebrow || '');
    appendTextBlock('aceita-tempo-tooltip__title', model?.title || '');
    appendTextBlock('aceita-tempo-tooltip__body', model?.body || '');
    appendTextBlock('aceita-tempo-tooltip__meta', model?.meta || '');
    appendTextBlock('aceita-tempo-tooltip__conversion', model?.conversion || '');
  }

  function hideTooltip() {
    const tooltip = state.tooltipElement;
    state.tooltipAnchor = null;

    if (state.tooltipRafId) {
      cancelAnimationFrame(state.tooltipRafId);
      state.tooltipRafId = null;
    }

    if (!tooltip) {
      return;
    }

    tooltip.removeAttribute('data-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function positionTooltip(anchor) {
    const tooltip = state.tooltipElement;
    if (!tooltip || !anchor || !document.contains(anchor)) {
      hideTooltip();
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const padding = 12;
    const gap = 12;
    const tooltipWidth = tooltip.offsetWidth || 240;
    const tooltipHeight = tooltip.offsetHeight || 120;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const maxLeft = Math.max(padding, viewportWidth - tooltipWidth - padding);
    const centeredLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    const left = Math.min(Math.max(centeredLeft, padding), maxLeft);

    const spaceAbove = rect.top - gap - tooltipHeight;
    const spaceBelow = viewportHeight - rect.bottom - gap - tooltipHeight;
    const placeAbove = spaceAbove >= padding || spaceAbove >= spaceBelow;
    let top = placeAbove ? rect.top - gap - tooltipHeight : rect.bottom + gap;

    if (placeAbove && top < padding) {
      top = padding;
    } else if (!placeAbove && top + tooltipHeight > viewportHeight - padding) {
      top = Math.max(padding, viewportHeight - tooltipHeight - padding);
    }

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showTooltip(anchor, model) {
    if (!anchor || !model) {
      hideTooltip();
      return;
    }

    if (state.tooltipRafId) {
      cancelAnimationFrame(state.tooltipRafId);
      state.tooltipRafId = null;
    }

    const tooltip = getTooltipElement();
    state.tooltipAnchor = anchor;
    tooltip.style.transition = 'none';
    tooltip.removeAttribute('data-visible');
    tooltip.setAttribute('aria-hidden', 'true');
    renderTooltipContent(model);

    tooltip.style.left = '-9999px';
    tooltip.style.top = '-9999px';
    state.tooltipRafId = requestAnimationFrame(() => {
      state.tooltipRafId = null;
      if (state.tooltipAnchor !== anchor) return;
      positionTooltip(anchor);
      tooltip.style.transition = '';
      void tooltip.offsetWidth;
      tooltip.setAttribute('aria-hidden', 'false');
      tooltip.setAttribute('data-visible', '1');
    });
  }

  function parseRgbColor(color) {
    const match = String(color || '').trim().match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
    if (!match) {
      return null;
    }

    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] === undefined ? 1 : Number(match[4]),
    };
  }

  function colorWithAlpha(color, alpha) {
    const parsed = parseRgbColor(color);
    if (!parsed) {
      return '';
    }

    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
  }

  function scaleFontSize(fontSize, scale = 0.4) {
    const size = Number.parseFloat(String(fontSize || '').replace(',', '.'));
    if (!Number.isFinite(size) || size <= 0) {
      return fontSize || '';
    }

    return `${Number((size * scale).toFixed(2)).toString()}px`;
  }

  function createBadge(label, tooltipModel, options = {}) {
    const badge = document.createElement('span');
    badge.setAttribute(BADGE_ATTR, '1');
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = label;
    badge.style.position = 'relative';
    badge.style.zIndex = '2';
    badge.style.pointerEvents = 'auto';
    badge.style.fontFamily = options.fontFamily || '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
    if (options.compact === true) {
      badge.setAttribute('data-compact', '1');
    }

    if (options.inline === true) {
      badge.setAttribute('data-inline', '1');

      const fontSize = scaleFontSize(options.fontSize, options.fontScale ?? 0.4);
      if (fontSize) {
      badge.style.fontSize = fontSize;
      }

      if (options.color) {
        badge.style.color = options.color;
      }

      if (options.lineHeight) {
        badge.style.lineHeight = options.lineHeight;
      }

      badge.style.fontWeight = '700';
      badge.style.display = 'inline-block';
      badge.style.textDecoration = 'none';
      badge.style.verticalAlign = 'baseline';
      if (options.compact === true) {
        badge.style.paddingBlock = '0.04em';
        badge.style.paddingInline = '0.42em';
        badge.style.lineHeight = '1';
      }
    } else {
      const fontSize = scaleFontSize(options.fontSize, options.fontScale ?? 0.4);
      if (fontSize) {
        badge.style.fontSize = fontSize;
      }

      if (options.lineHeight) {
        badge.style.lineHeight = options.lineHeight;
      }

      if (options.color) {
        badge.style.color = options.color;
        badge.style.backgroundColor = colorWithAlpha(options.color, 0.1) || 'transparent';
        badge.style.borderColor = colorWithAlpha(options.color, 0.22) || 'transparent';
        badge.style.borderStyle = 'solid';
        badge.style.borderWidth = '1px';
        badge.style.boxShadow = 'none';
      }
      if (options.compact === true) {
        badge.style.paddingBlock = '0.04em';
        badge.style.paddingInline = '0.42em';
        badge.style.lineHeight = '1';
      }
      if (options.dropBelow === true) {
        badge.style.display = 'block';
        badge.style.width = 'fit-content';
        badge.style.marginInlineStart = '0';
        badge.style.marginTop = '0.1em';
        badge.style.marginBottom = '0.4em';
        badge.style.clear = 'both';
      }
    }

    if (tooltipModel) {
      const enterHandler = () => showTooltip(badge, tooltipModel);
      const leaveHandler = hideTooltip;
      badge.addEventListener('pointerenter', enterHandler);
      badge.addEventListener('mouseenter', enterHandler);
      badge.addEventListener('pointerleave', leaveHandler);
      badge.addEventListener('mouseleave', leaveHandler);
      badge.addEventListener('pointercancel', hideTooltip);
      badge.addEventListener('focus', enterHandler);
      badge.addEventListener('blur', leaveHandler);
    }

    return badge;
  }

  function annotateTarget(target, label, tooltipModel) {
    target.setAttribute(TARGET_ATTR, '1');
    const replaceMode = Boolean(state.settings?.replacePricesWithHours);
    if (replaceMode) {
      target.setAttribute(HIDDEN_ATTR, '1');
    }

    const preferredTextStyle = getPreferredTextStyle(target);
    const badge = createBadge(label, tooltipModel, {
      inline: replaceMode,
      fontSize: preferredTextStyle.fontSize,
      color: preferredTextStyle.color,
      lineHeight: preferredTextStyle.lineHeight,
      fontFamily: preferredTextStyle.fontFamily,
      compact: true,
      fontScale: state.siteConfig ? 0.75 : 0.45,
      dropBelow: state.siteConfig?.name === 'Magazine Luiza',
    });

    if (tooltipModel) {
      const enterHandler = () => showTooltip(badge, tooltipModel);
      const leaveHandler = hideTooltip;
      target.addEventListener('pointerenter', enterHandler);
      target.addEventListener('mouseenter', enterHandler);
      target.addEventListener('pointerleave', leaveHandler);
      target.addEventListener('mouseleave', leaveHandler);
    }

    const dropBelow = state.siteConfig?.name === 'Magazine Luiza';
    const anchor = dropBelow && target.parentElement ? target.parentElement : target;
    anchor.insertAdjacentElement('afterend', badge);
  }

  function annotateResolvedPrice(resolved, locale, targetsToHide) {
    const workDuration = PriceUtils.calculateWorkDuration(
      resolved.parsedPrice.amount,
      resolved.parsedPrice.currency,
      state.settings
    );

    if (!workDuration) {
      return;
    }

    annotateTarget(
      resolved.element,
      PriceUtils.formatDurationShort(workDuration.minutes, state.settings),
      PriceUtils.buildTooltipCard(resolved.parsedPrice, workDuration, state.settings, locale)
    );

    if (state.settings.replacePricesWithHours) {
      targetsToHide.add(resolved.element);
    }
  }

  function scanItemPrices() {
    if (!document.body || !state.settings || state.settings.salaryAmount <= 0 || state.settings.monthlyHours <= 0) {
      clearBadges();
      return;
    }

    const preferredCurrency = preferredCurrencyForHost(location.hostname);
    const locale = getLocale();
    const replaceMode = Boolean(state.settings.replacePricesWithHours);
    const winners = new Map();
    const resolvedWinners = [];
    const targetsToHide = new Set();
    const structuredScopeElements = [];

    setHiddenTargets([], false);

    if (usesStructuredPriceConfig()) {
      const structuredWinners = collectStructuredItemPrices(preferredCurrency);

      if (structuredWinners.length) {
        structuredWinners.forEach((winner) => {
          resolvedWinners.push(winner);
          structuredScopeElements.push(winner.scopeElement || getScopeElement(winner.element, preferredCurrency));
        });
      }
    }

    collectCandidateElements(preferredCurrency).forEach((element) => {
      if (!isVisible(element) || isExcludedElement(element)) {
        return;
      }

      const resolved = resolveBestAnchor(element, preferredCurrency);
      if (!resolved || resolved.score < 4) {
        return;
      }

      const scopeId = getScopeId(getScopeElement(resolved.element, preferredCurrency));
      if (structuredScopeElements.some((scopeElement) => scopeElement && scopeElement.contains(resolved.element))) {
        return;
      }

      const currentWinner = winners.get(scopeId);

      if (!currentWinner || resolved.score > currentWinner.score || (
        resolved.score === currentWinner.score && resolved.text.length < currentWinner.text.length
      )) {
        winners.set(scopeId, resolved);
      }
    });

    clearBadges();

    resolvedWinners.forEach((winner) => annotateResolvedPrice(winner, locale, targetsToHide));
    winners.forEach((winner) => annotateResolvedPrice(winner, locale, targetsToHide));

    if (replaceMode) {
      setHiddenTargets(targetsToHide, true);
    }
  }

  function scanOrderTotals() {
    if (!document.body || !state.settings || state.settings.salaryAmount <= 0 || state.settings.monthlyHours <= 0) {
      clearBadges();
      return;
    }

    const preferredCurrency = preferredCurrencyForHost(location.hostname);
    const locale = getLocale();
    const replaceMode = Boolean(state.settings.replacePricesWithHours);
    let best = null;
    const targetsToHide = new Set();

    setHiddenTargets([], false);

    collectTotalCandidateElements(preferredCurrency).forEach((element) => {
      if (!isVisible(element) || isExcludedElement(element)) {
        return;
      }

      const resolved = resolveBestTotalAnchor(element, preferredCurrency);
      if (!resolved || resolved.score < 5) {
        return;
      }

      if (!best || resolved.score > best.score || (
        resolved.score === best.score && resolved.text.length < best.text.length
      )) {
      best = resolved;
      }
    });

    clearBadges();

    if (!best) {
      if (replaceMode) {
        setHiddenTargets(targetsToHide, true);
      }
      return;
    }

    const workDuration = PriceUtils.calculateWorkDuration(
      best.parsedPrice.amount,
      best.parsedPrice.currency,
      state.settings
    );

    if (!workDuration) {
      return;
    }

    annotateTarget(
      best.element,
      PriceUtils.formatDurationShort(workDuration.minutes, state.settings),
      PriceUtils.buildTooltipCard(best.parsedPrice, workDuration, state.settings, locale)
    );

    if (replaceMode) {
      targetsToHide.add(best.element);
      setHiddenTargets(targetsToHide, true);
    }
  }

  function scan() {
    if (shouldSkipCurrentPage()) {
      clearBadges();
      stopObserving();
      return;
    }

    if (isCartOrCheckoutPage()) {
      scanOrderTotals();
      return;
    }

    scanItemPrices();
  }

  function scheduleScan() {
    if (state.scheduled) {
      return;
    }

    state.scheduled = true;
    window.setTimeout(() => {
      state.scheduled = false;
      scan();
    }, 180);
  }

  function isOwnMutationNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    return Boolean(
      node.matches?.(`[${BADGE_ATTR}="1"], [${TOOLTIP_ATTR}="1"]`) ||
      node.querySelector?.(`[${BADGE_ATTR}="1"], [${TOOLTIP_ATTR}="1"]`)
    );
  }

  function mutationNeedsScan(mutation) {
    if (mutation.target?.nodeType === Node.ELEMENT_NODE) {
      const targetElement = mutation.target;
      if (targetElement.closest?.(`[${BADGE_ATTR}="1"], [${TOOLTIP_ATTR}="1"]`)) {
        return false;
      }
    }

    if (mutation.type === 'characterData') {
      const parent = mutation.target?.parentElement;
      return Boolean(parent && !parent.closest(`[${BADGE_ATTR}="1"], [${TOOLTIP_ATTR}="1"]`));
    }

    if (mutation.type === 'attributes') {
      if (mutation.attributeName?.startsWith('data-aceita-tempo-')) {
        return false;
      }
      const targetElement = mutation.target;
      return Boolean(targetElement && !targetElement.closest?.(`[${BADGE_ATTR}="1"], [${TOOLTIP_ATTR}="1"]`));
    }

    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return nodes.some((node) => !isOwnMutationNode(node));
  }

  function observe() {
    if (state.observer || !document.body) {
      return;
    }

    state.observer = new MutationObserver((mutations) => {
      if (mutations.some(mutationNeedsScan)) {
        scheduleScan();
      }
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    window.addEventListener('scroll', () => {
      hideTooltip();
      scheduleScan();
    }, { passive: true });
    window.addEventListener('resize', () => {
      hideTooltip();
      scheduleScan();
    }, { passive: true });
  }

  function refreshSettingsAndScan() {
    return readSettings()
      .then((raw) => {
        state.settings = normalizeSettings(raw);
        state.locale = getLocale();
        state.siteConfig = SiteConfig.getSiteConfig(location.hostname);
        if (shouldSkipCurrentPage()) {
          clearBadges();
          stopObserving();
          return;
        }
        ensureStyle();
        scan();
        observe();
      })
      .catch(() => {
        state.settings = normalizeSettings({});
        state.locale = getLocale();
        state.siteConfig = SiteConfig.getSiteConfig(location.hostname);
        if (shouldSkipCurrentPage()) {
          clearBadges();
          stopObserving();
          return;
        }
        ensureStyle();
        scan();
        observe();
      });
  }

  function onStorageChange(changes, areaName) {
    if (areaName !== 'sync' && areaName !== 'local') {
      return;
    }

    if (Object.keys(changes || {}).some((key) => STORAGE_KEYS.includes(key))) {
      refreshSettingsAndScan();
    }
  }

  function boot() {
    try {
      chrome.storage?.onChanged?.addListener(onStorageChange);
    } catch {
      // ignore
    }

    refreshSettingsAndScan();
    window.setTimeout(scheduleScan, 1200);
    window.setTimeout(scheduleScan, 3000);
    window.setTimeout(scheduleScan, 5000);
    window.setTimeout(scheduleScan, 8000);
    window.setTimeout(scheduleScan, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
