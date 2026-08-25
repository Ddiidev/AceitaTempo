(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  if (globalObj.AceitaTempoAffiliate) {
    return;
  }

  const LOMADEE_LINK_TIMEOUT_MS = 4000;

  const AFFILIATE_STORES = [
    {
      siteId: 'amazon',
      name: 'Amazon',
      params: { tag: 'aceitatempo-20' },
      active: true,
    },
    {
      siteId: 'aliexpress',
      name: 'AliExpress',
      params: { aff_fbid: 'aceitatempo' },
      active: false,
    },
    // Mercado Livre nao tem parametro de URL de auto-atribuicao (o `af_id`
    // que existia aqui nunca gerou comissao de verdade). O programa de
    // afiliados deles so gera link via painel manual, sem API oficial
    // equivalente a Lomadee.
    {
      siteId: 'mercado-livre',
      name: 'Mercado Livre',
      active: false,
    },
    {
      siteId: 'instant-gaming',
      name: 'Instant Gaming',
      params: { igr: 'aceitatempo' },
      active: true,
      storeUrl: 'https://www.instant-gaming.com/br/',
    },
    // Lojas abaixo nao tem parametro de afiliado simples: o link e gerado
    // sob demanda pelo proxy AceitaTempoAPI (guarda a chave da Lomadee no
    // servidor, ver https://github.com/Ddiidev/AceitaTempoAPI).
    {
      siteId: 'shopee',
      name: 'Shopee',
      lomadee: true,
      active: true,
    },
    {
      siteId: 'shein',
      name: 'SHEIN',
      lomadee: true,
      active: true,
    },
    {
      siteId: 'terabyte',
      name: 'Terabyte',
      lomadee: true,
      active: true,
    },
    // Casas Bahia e Americanas ainda nao estao aprovadas na conta Lomadee
    // usada pelo proxy (verificado 2026-08-25). Adicionar aqui com
    // lomadee: true assim que aparecerem em GET /affiliate/brands.
  ];

  const AFFILIATE_STORE_IDS = AFFILIATE_STORES.map((store) => store.siteId);
  const ACTIVE_AFFILIATE_STORE_IDS = AFFILIATE_STORES.filter((store) => store.active !== false).map((store) => store.siteId);

  function getAffiliateStore(siteId) {
    return AFFILIATE_STORES.find((store) => store.siteId === siteId) || null;
  }

  function hasAffiliate(siteId) {
    const store = getAffiliateStore(siteId);
    return Boolean(store) && store.active !== false;
  }

  function buildAffiliateUrl(href, siteId) {
    const store = getAffiliateStore(siteId);
    if (!store || !store.params) {
      return href;
    }

    try {
      const url = new URL(href);
      Object.entries(store.params).forEach(([key, value]) => {
        if (!url.searchParams.has(key)) {
          url.searchParams.set(key, value);
        }
      });
      return url.toString();
    } catch {
      return href;
    }
  }

  function requestLomadeeLink(siteId) {
    return new Promise((resolve) => {
      if (!globalObj.chrome?.runtime?.sendMessage) {
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      const timer = globalObj.setTimeout(() => finish(null), LOMADEE_LINK_TIMEOUT_MS);

      try {
        globalObj.chrome.runtime.sendMessage(
          { type: 'aceitaTempo:getLomadeeLink', store: siteId },
          (response) => {
            globalObj.clearTimeout(timer);
            finish(response?.ok ? response.url : null);
          }
        );
      } catch {
        globalObj.clearTimeout(timer);
        finish(null);
      }
    });
  }

  async function getAffiliateRedirectUrl(href, siteId) {
    const store = getAffiliateStore(siteId);
    if (!store) {
      return href;
    }

    if (store.lomadee) {
      const url = await requestLomadeeLink(siteId);
      return url || href;
    }

    return buildAffiliateUrl(href, siteId);
  }

  globalObj.AceitaTempoAffiliate = {
    AFFILIATE_STORES,
    AFFILIATE_STORE_IDS,
    ACTIVE_AFFILIATE_STORE_IDS,
    getAffiliateStore,
    hasAffiliate,
    buildAffiliateUrl,
    getAffiliateRedirectUrl,
  };
})();
