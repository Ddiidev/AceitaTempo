(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  if (globalObj.AceitaTempoAffiliate) {
    return;
  }

  const AFFILIATE_STORES = [
    {
      siteId: 'amazon',
      name: 'Amazon',
      params: { tag: 'aceitatempo-20' },
    },
    {
      siteId: 'aliexpress',
      name: 'AliExpress',
      params: { aff_fbid: 'aceitatempo' },
    },
    {
      siteId: 'shopee',
      name: 'Shopee',
      params: { af_siteid: 'aceitatempo' },
    },
    {
      siteId: 'mercado-livre',
      name: 'Mercado Livre',
      params: { af_id: 'aceitatempo' },
    },
    {
      siteId: 'ebay',
      name: 'eBay',
      params: { mkcid: '1', mkevt: '1', mkrid: '711-53200-19255-0' },
    },
    {
      siteId: 'magazine-luiza',
      name: 'Magazine Luiza',
      params: { partner_id: 'aceitatempo' },
    },
    {
      siteId: 'temu',
      name: 'Temu',
      params: { aff_fbid: 'aceitatempo' },
    },
    {
      siteId: 'shein',
      name: 'SHEIN',
      params: { aff_short: 'aceitatempo' },
    },
    {
      siteId: 'americanas',
      name: 'Americanas',
      params: { aff_id: 'aceitatempo' },
    },
  ];

  const AFFILIATE_STORE_IDS = AFFILIATE_STORES.map((store) => store.siteId);

  function getAffiliateStore(siteId) {
    return AFFILIATE_STORES.find((store) => store.siteId === siteId) || null;
  }

  function hasAffiliate(siteId) {
    return Boolean(getAffiliateStore(siteId));
  }

  function buildAffiliateUrl(href, siteId) {
    const store = getAffiliateStore(siteId);
    if (!store) {
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

  globalObj.AceitaTempoAffiliate = {
    AFFILIATE_STORES,
    AFFILIATE_STORE_IDS,
    getAffiliateStore,
    hasAffiliate,
    buildAffiliateUrl,
  };
})();
