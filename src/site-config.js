(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  if (globalObj.AceitaTempoSiteConfig) {
    return;
  }

  function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().replace(/^www\./, '');
  }

  function rx(patterns) {
    return patterns.map((pattern) => (pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')));
  }

  const SHARED_SELECTORS = [
    '[itemprop="price"]',
    '[data-testid*="price" i]',
    '[data-test*="price" i]',
    '[data-qa*="price" i]',
    '[aria-label*="price" i]',
    '[aria-label*="preco" i]',
    '[aria-label*="preço" i]',
    '[class*="price" i]',
    '[class*="money" i]',
    '[class*="amount" i]',
    '[class*="valor" i]',
  ];

  const SHARED_EXCLUSIONS = [
    'script',
    'style',
    'noscript',
    'template',
    'input',
    'textarea',
    'select',
    'option',
    'button',
    'svg',
    'canvas',
    'video',
    'audio',
    'iframe',
    'math',
  ];

  const PRODUCT_SCOPE_SELECTORS = [
    '[data-asin]',
    '[data-component-type="s-search-result"]',
    '[data-testid*="product" i]',
    '[data-testid*="offer" i]',
    '[data-sqe="item"]',
    '[role="listitem"]',
    'article',
    'li',
    '[class*="product" i]',
    '[class*="card" i]',
    '[class*="offer" i]',
    '[class*="shelf" i]',
    '[class*="box" i]',
  ];

  const RAW_SITE_CONFIGS = [
    {
      name: 'Amazon',
      hostPatterns: rx([
        '(^|\\.)amazon\\.(com|com\\.br|ca|co\\.uk|de|es|fr|it|in|com\\.mx|com\\.au)$',
        '(^|\\.)amzn\\.(to|com)$',
      ]),
      selectors: [
        'span.a-price .a-offscreen',
        'span.a-price:not(.a-text-price):not([data-a-strike="true"])',
        '#corePrice_feature_div span.a-price .a-offscreen',
        '#corePrice_feature_div span.a-price:not(.a-text-price):not([data-a-strike="true"])',
        '#corePriceDisplay_desktop_feature_div span.a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div span.a-price:not(.a-text-price):not([data-a-strike="true"])',
        '.apex-core-price-identifier span.a-price .a-offscreen',
        '.apex-core-price-identifier span.a-price:not(.a-text-price):not([data-a-strike="true"])',
        '.apexPriceToPay .a-offscreen',
        '.apexPriceToPay span.a-price:not(.a-text-price):not([data-a-strike="true"])',
        '.apex-pricetopay-value .a-offscreen',
        '.apex-pricetopay-value',
        '.reinventPricePriceToPayMargin .a-offscreen',
        '.reinventPricePriceToPayMargin span.a-price:not(.a-text-price):not([data-a-strike="true"])',
        '.s-result-item .a-price .a-offscreen',
        '.s-result-item span.a-price:not(.a-text-price):not([data-a-strike="true"])',
      ],
      scopeSelectors: [
        '#corePrice_feature_div',
        '#corePriceDisplay_desktop_feature_div',
        '#apex_desktop',
        '.apex-core-price-identifier',
        '.apex-pricetopay-value',
        '.priceToPay',
        '.apexPriceToPay',
        '.reinventPricePriceToPayMargin',
        '#desktop_buybox',
        '#ppd',
        '#dp-container',
        '.s-result-item',
        // Newer Amazon pages use CSS-Module hashed classes; a[data-asin] is stable
        'a[data-asin]',
        '[class*="_cDEzb_container" i]',
        '[class*="_cDEzb_price" i]',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Temu',
      hostPatterns: rx(['(^|\\.)temu\\.com$']),
      selectors: [
        // Visually-hidden srOnly span holds the clean concatenated price (e.g. R$769,57)
        '[data-type="price"] [class*="srOnly" i]',
        '[data-type="price"] [class*="price" i]',
        '[data-priority-list]',
        '[data-type="price"]',
        // Search-result cards: goodsPrice wrapper (hash suffix varies per deploy)
        '[class*="goodsPrice" i]',
        '[class*="CountPrice" i]',
        '[class*="afterCouponPrice" i]',
      ],
      preferTextWalker: true,
      scopeSelectors: [
        '[data-type="price"]',
        '[class*="priceWrap" i]',
        '[class*="saleInfo" i]',
        // Search cards share a common item wrapper
        '[class*="item-" i][class*="Card" i]',
        '[class*="goods-" i]',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Mercado Livre',
      hostPatterns: rx([
        '(^|\\.)mercadolivre\\.com\\.br$',
        '(^|\\.)mercadolibre\\.(com|com\\.ar|com\\.mx|com\\.co|cl|com\\.pe|com\\.uy)$',
      ]),
      selectors: [
        '.andes-money-amount',
        '[class*="price-tag-amount" i]',
        '[data-testid="price-part"]',
        '.ui-search-price__second-line',
        '[class*="poly-price" i]',
      ],
      scopeSelectors: ['.ui-search-result', '.poly-card', ...PRODUCT_SCOPE_SELECTORS],
    },
    {
      name: 'Magazine Luiza',
      hostPatterns: rx(['(^|\\.)magazineluiza\\.com\\.br$']),
      selectors: [
        '[data-testid*="price" i]',
        'p[data-testid*="price" i]',
        'span[data-testid*="price" i]',
        'div[data-testid*="price" i] p',
        '[class*="price-template" i]',
        '[class*="price-template" i] p',
        '[class*="sales-price" i]',
        '[class*="finalPrice" i]',
        '[class*="finalPrice" i] p',
        '[class*="offerPrice" i]',
        'p[class*="price" i]',
      ],
      preferTextWalker: true,
      scopeSelectors: [
        '[data-testid*="product-card" i]',
        '[data-testid*="product" i]',
        '[class*="product-card" i]',
        '[class*="card" i]',
        '[class*="offer" i]',
        'article',
        'li',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'eBay',
      hostPatterns: rx(['(^|\\.)ebay\\.(com|com\\.br|co\\.uk|de|fr|it|es|ca|au)$']),
      selectors: ['[data-testid="x-price-primary"]', '.x-price-primary', '.s-item__price', '.display-price'],
      scopeSelectors: ['.s-item__wrapper', '[data-testid*="x-item" i]', '#LeftSummaryPanel', ...PRODUCT_SCOPE_SELECTORS],
    },
    {
      name: 'Epic Games',
      hostPatterns: rx(['(^|\\.)store\\.epicgames\\.com$']),
      selectors: [
        '[data-testid*="price" i]',
        '[data-testid*="offer-price" i]',
        '[class*="price" i]',
        '[class*="Price" i]',
      ],
      scopeSelectors: [
        '[data-testid*="offer-card" i]',
        '[data-testid*="product-card" i]',
        '[class*="offer-card" i]',
        '[class*="product-card" i]',
        'a[href*="/p/"]',
        'a[href*="/product/"]',
        'a[href*="/bundles/"]',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Steam',
      hostPatterns: rx(['(^|\\.)store\\.steampowered\\.com$']),
      selectors: [
        '.discount_final_price',
        '.discount_prices',
        '.discount_block',
        '.game_purchase_price',
        '.search_price',
        '.cart_item_price .price',
        '.total_value',
        '[class*="PriceDisplay" i]',
        '[class*="CartItem"] [class*="Price" i]',
        '.market_listing_price_with_fee',
      ],
      cardSelectors: [
        'a.store_capsule',
        '.home_area_spotlight',
        '.tab_item',
        '.sale_capsule',
        '.cluster_capsule',
        '[data-ds-itemkey]',
        '[data-ds-appid]',
        '.search_result_row',
        '[class*="CartItem" i]',
      ],
      cardRootSelectors: [
        'a.store_capsule',
        '.home_area_spotlight',
        '.tab_item',
        '.sale_capsule',
        '.cluster_capsule',
        '.search_result_row',
      ],
      primaryPriceRowSelectors: [
        '.discount_block',
        '.discount_prices',
        '.spotlight_price',
        '.game_purchase_price',
        '.search_price',
        '[class*="PriceDisplay" i]',
        '[class*="CartItem"] [class*="Price" i]',
      ],
      primaryPriceValueSelectors: [
        '.discount_prices .discount_final_price',
        '.discount_final_price',
        '.game_purchase_price.price',
        '.search_price',
        '[class*="PriceDisplay" i]',
      ],
      secondaryPriceSelectors: [
        '.discount_original_price',
        '.discount_pct',
        '[class*="Strike" i]',
      ],
      scopeSelectors: [
        'a.store_capsule',
        '.home_area_spotlight',
        '.tab_item',
        '.sale_capsule',
        '.cluster_capsule',
        '[data-ds-itemkey]',
        '[data-ds-appid]',
        '.search_result_row',
        '[class*="CartItem" i]',
        '[class*="PriceDisplay" i]',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'AliExpress',
      hostPatterns: rx(['(^|\\.)aliexpress\\.(com|us)$']),
      selectors: [
        '._23lt5 ._3Mpbo',
        '._23lt5',
        '.lw_kt',
        '.lw_el .lw_kt',
        '.search-card-item .lw_kt',
        '[class*="price-current" i] [style*="font-size"]',
        '[class*="price-current" i]',
        '[class*="snow-price" i]',
        '[class*="product-price-current" i]',
      ],
      cardSelectors: [
        '._3gA8_.card-out-wrapper',
        '._3gA8_',
        '.card-out-wrapper',
        '._9HTSH',
        '[class*="search-card-item" i]',
        '[class*="product-item" i]',
      ],
      cardRootSelectors: [
        '._3gA8_.card-out-wrapper',
        '._3gA8_',
        '.card-out-wrapper',
      ],
      primaryPriceRowSelectors: [
        '._23lt5',
        '.lw_el',
        '[class*="price-current" i]',
        '[class*="snow-price" i]',
        '[class*="product-price-current" i]',
      ],
      primaryPriceValueSelectors: [
        '._23lt5 ._3Mpbo',
        '._23lt5 [aria-label*="R$" i]',
        '._23lt5 [aria-label*="$" i]',
        '.lw_kt',
        '.lw_el .lw_kt',
        '[class*="price-current" i] [style*="font-size"]',
        '[class*="snow-price" i] [style*="font-size"]',
        '[class*="product-price-current" i] [style*="font-size"]',
        '[class*="price-current" i]',
        '[class*="snow-price" i]',
        '[class*="product-price-current" i]',
      ],
      secondaryPriceSelectors: [
        '._3DRNh',
        's',
        'strike',
        'del',
        '[style*="line-through"]',
      ],
      preferTextWalker: true,
      scopeSelectors: [
        '._3gA8_.card-out-wrapper',
        '._3gA8_',
        '.card-out-wrapper',
        '._9HTSH',
        '[class*="search-card-item" i]',
        '[class*="product-item" i]',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'GOG',
      hostPatterns: rx(['(^|\\.)gog\\.com$']),
      selectors: [
        '.product-tile__price-info',
        'price-value .final-value',
        'price-value .base-value',
        '.product-price__free',
      ],
      cardSelectors: [
        'a.product-tile',
        '.product-tile',
        'product-tile',
      ],
      cardRootSelectors: [
        'a.product-tile',
        '.product-tile',
      ],
      primaryPriceRowSelectors: [
        '.product-tile__price-info',
        'price-value',
        'product-price',
      ],
      primaryPriceValueSelectors: [
        'price-value .final-value',
        '.product-tile__price-info .final-value',
      ],
      secondaryPriceSelectors: [
        'price-discount',
        'price-value .base-value',
      ],
      scopeSelectors: [
        'a.product-tile',
        '.product-tile',
        'product-tile',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Shopee',
      hostPatterns: rx(['(^|\\.)shopee\\.(com|com\\.br|co\\.id|sg|vn|th|ph|my|tw)$']),
      selectors: [
        '[class*="price" i]',
        '[class*="current-price" i]',
        '[class*="product-price" i]',
        '[data-sqe="link"] [class*="price" i]',
        '[data-sqe="item"] [class*="price" i]',
      ],
      preferTextWalker: true,
      scopeSelectors: ['[data-sqe="item"]', '[class*="shop-search-result-view" i]', '[class*="item-card" i]', ...PRODUCT_SCOPE_SELECTORS],
    },
    {
      name: 'SHEIN',
      hostPatterns: rx(['(^|\\.)shein\\.(com|com\\.br|co\\.uk|de|fr|it|es|us)$']),
      selectors: ['[class*="goods-price" i]', '[class*="price-sale" i]', '[class*="product-intro__head-price" i]'],
      scopeSelectors: ['[class*="product-item" i]', '[class*="goods-item" i]', ...PRODUCT_SCOPE_SELECTORS],
    },
    {
      name: 'Armazem Paraiba',
      hostPatterns: rx(['(^|\\.)armazemparaiba\\.com\\.br$']),
      selectors: ['.price-box', '[class*="price-box" i]', '[class*="special-price" i]', '[class*="finalPrice" i]'],
      scopeSelectors: ['[class*="product-item" i]', '[class*="item-product" i]', ...PRODUCT_SCOPE_SELECTORS],
    },
    {
      name: 'Americanas',
      hostPatterns: rx(['(^|\\.)americanas\\.com\\.br$']),
      selectors: ['[class*="SalesPrice" i]', '[class*="BestPrice" i]', '[class*="Price" i]'],
      scopeSelectors: ['[class*="Product" i]', '[class*="product" i]', '[class*="card" i]', ...PRODUCT_SCOPE_SELECTORS],
    },
   {
     name: 'Casas Bahia',
     hostPatterns: rx(['(^|\\.)casasbahia\\.com\\.br$']),
     selectors: ['[class*="price" i]', '[class*="Price" i]', '[data-price]'],
     scopeSelectors: ['[class*="product" i]', '[class*="Product" i]', '[class*="card" i]', ...PRODUCT_SCOPE_SELECTORS],
   },
    {
      name: 'Pichau',
      hostPatterns: rx(['(^|\\.)pichau\\.com\\.br$']),
      selectors: [
        '[class*="price_vista" i]',
        '[class*="price_total" i]',
        '[class*="price_parcelado" i]',
        '[class*="strikeThrough" i]',
        '[class*="price_from" i]',
      ],
      preferTextWalker: true,
      scopeSelectors: [
        '.MuiCard-root',
        '[class*="product_item" i]',
        '[class*="cardContentWrapper" i]',
        '[class*="mainWrapper" i]',
        '[class*="sectionWrapper" i]',
        '[class*="sectionCompactHorizontal" i]',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Kabum',
      hostPatterns: rx(['(^|\\.)kabum\\.com\\.br$']),
      selectors: [
        'h4[class*="text-secondary" i]',
        'b[class*="text-black" i]',
        'span[class*="text-secondary" i]',
        'span.line-through',
        '[class*="finalPrice" i]',
      ],
      preferTextWalker: true,
      scopeSelectors: [
        'a[href*="/produto/"]',
        '.swiper-slide',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Terabyte',
      hostPatterns: rx(['(^|\\.)terabyteshop\\.com\\.br$']),
      selectors: [
        '#valVista',
        '.valVista',
        '#valParc',
        '.valParc',
        '#Parc',
        '.Parc',
        '.product-item__new-price',
        '.product-item__old-price',
        '.product-item__juros',
      ],
      scopeSelectors: [
        '.product-item',
        '.product-item__price-box',
        '.product-item__info',
        '.prec_parc',
        '.prod-destaque',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
    {
      name: 'Alibaba',
      hostPatterns: rx(['(^|\\.)alibaba\\.(com|com\\.br)$']),
      selectors: [
        // Layout A: ag-gruarantee-block carousel
        '.product-price',
        // Layout B: top-deals-floor carousel
        '.final-price',
        '[class*="price-wrapper" i] .final-price',
        '[class*="price-wrapper" i] [class*="price" i]',
        '[class*="product-price" i]',
        // Search results: search-card layout
        '.search-card-e-price-main',
        '[class*="search-card-e-price" i]',
        '[class*="gallery-offer-price" i]',
      ],
      preferTextWalker: true,
      scopeSelectors: [
        '.slick-slide',
        '.bottom_content',
        '[class*="price-wrapper" i]',
        '[class*="custom-wrapper" i]',
        // Search-card product containers
        '[class*="search-card-e-detail" i]',
        '[class*="search-card-item" i]',
        '.home-dot-element',
        ...PRODUCT_SCOPE_SELECTORS,
      ],
    },
  ];

  const SOCIAL_SITE_CONFIGS = [
    {
      name: 'Instagram',
      siteId: 'instagram',
      kind: 'social',
      hostPatterns: rx(['(^|\\.)instagram\\.com$']),
    },
    {
      name: 'YouTube (Shorts)',
      siteId: 'youtube-shorts',
      kind: 'social',
      hostPatterns: rx(['(^|\\.)youtube\\.com$']),
      matchesLocation: ({ pathname }) => /^\/shorts(?:\/|$)/i.test(String(pathname || '')),
    },
    {
      name: 'YouTube',
      siteId: 'youtube',
      kind: 'social',
      hostPatterns: rx(['(^|\\.)youtube\\.com$']),
      matchesLocation: ({ pathname }) => !/^\/shorts(?:\/|$)/i.test(String(pathname || '')),
    },
    {
      name: 'TikTok',
      siteId: 'tiktok',
      kind: 'social',
      hostPatterns: rx(['(^|\\.)tiktok\\.com$']),
    },
  ];

  function toSiteId(name) {
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const SITE_CONFIGS = [
    ...RAW_SITE_CONFIGS.map((config) => ({
      kind: 'commerce',
      siteId: toSiteId(config.name),
      ...config,
    })),
    ...SOCIAL_SITE_CONFIGS,
  ];

  function normalizeLocationInput(input) {
    if (typeof input === 'string') {
      return {
        hostname: input,
        pathname: '',
        href: '',
      };
    }

    return {
      hostname: input?.hostname || '',
      pathname: input?.pathname || '',
      href: input?.href || '',
    };
  }

  function getSiteConfig(input) {
    const locationLike = normalizeLocationInput(input);
    const normalizedHostname = normalizeHostname(locationLike.hostname);

    return SITE_CONFIGS.find((config) => {
      if (!config.hostPatterns.some((pattern) => pattern.test(normalizedHostname))) {
        return false;
      }

      if (typeof config.matchesLocation === 'function') {
        return config.matchesLocation(locationLike);
      }

      return true;
    }) || null;
  }

  globalObj.AceitaTempoSiteConfig = {
    sharedSelectors: SHARED_SELECTORS,
    sharedExclusions: SHARED_EXCLUSIONS,
    productScopeSelectors: PRODUCT_SCOPE_SELECTORS,
    siteConfigs: SITE_CONFIGS,
    getSiteConfigs: () => SITE_CONFIGS.slice(),
    getSiteConfig,
    normalizeHostname,
  };
})();
