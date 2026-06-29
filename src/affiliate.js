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
     active: false,
    },
    {
      siteId: 'shopee',
      name: 'Shopee',
      params: { af_siteid: 'aceitatempo' },
     active: false,
    },
    {
      siteId: 'mercado-livre',
      name: 'Mercado Livre',
      params: { af_id: 'aceitatempo' },
    },
  ];
 
 // TODO: Lomadee integration for Casas Bahia and Americanas.
 // These stores require API calls to generate deep links.
 // When Lomadee sourceId/advertiserId are available, add:
 //   { siteId: 'casas-bahia', name: 'Casas Bahia', params: { ... } }
 //   { siteId: 'americanas', name: 'Americanas', params: { ... } }
 // And update buildAffiliateUrl to handle the Lomadee redirect flow.

  const AFFILIATE_STORE_IDS = AFFILIATE_STORES.map((store) => store.siteId);
 const ACTIVE_AFFILIATE_STORE_IDS = AFFILIATE_STORES.filter((s) => s.active !== false).map((s) => s.siteId);

  function getAffiliateStore(siteId) {
    return AFFILIATE_STORES.find((store) => store.siteId === siteId) || null;
  }

  function hasAffiliate(siteId) {
   const store = getAffiliateStore(siteId);
   return Boolean(store) && store.active !== false;
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
   ACTIVE_AFFILIATE_STORE_IDS,
    getAffiliateStore,
    hasAffiliate,
    buildAffiliateUrl,
  };
})();
