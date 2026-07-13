(function onboardingInit() {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  const ExtensionApi = typeof browser !== 'undefined' ? browser : chrome;
  const usesBrowserPromiseApi = typeof browser !== 'undefined';
  const SiteConfig = globalObj.AceitaTempoSiteConfig;
  const Affiliate = globalObj.AceitaTempoAffiliate;
  const DEFAULT_SETTINGS = { affiliateEnabled: true, affiliateDisabledStores: [] };
  const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);
  const COMMERCE_SITE_CONFIGS = SiteConfig?.siteConfigs?.filter((s) => s.kind !== 'social') || [];
  const ACTIVE_AFFILIATE_STORE_IDS = new Set(Affiliate?.ACTIVE_AFFILIATE_STORE_IDS || []);
  const AFFILIATE_SITE_CONFIGS = COMMERCE_SITE_CONFIGS.filter((s) => ACTIVE_AFFILIATE_STORE_IDS.has(s.siteId));

  function getStorageArea() {
    return ExtensionApi.storage?.sync ?? ExtensionApi.storage?.local;
  }

  function storageGet(area, keys) {
    if (usesBrowserPromiseApi) {
      return area.get(keys);
    }
    return new Promise((resolve) => {
      area.get(keys, (items) => resolve(items || {}));
    });
  }

  function storageSet(area, values) {
    if (usesBrowserPromiseApi) {
      return area.set(values);
    }
    return new Promise((resolve) => {
      area.set(values, () => resolve());
    });
  }

  function openOptionsPage() {
    const opener = ExtensionApi.runtime?.openOptionsPage;
    if (!opener) {
      return Promise.resolve();
    }
    const result = opener.call(ExtensionApi.runtime);
    return result && typeof result.then === 'function' ? result : Promise.resolve(result);
  }

  function readSettings() {
    const area = getStorageArea();
    if (!area) {
      return Promise.resolve({ ...DEFAULT_SETTINGS });
    }
    return storageGet(area, STORAGE_KEYS).then((items) => ({ ...DEFAULT_SETTINGS, ...items }));
  }

  function savePartialSettings(nextValues) {
    const area = getStorageArea();
    if (!area) {
      return Promise.resolve();
    }
    return storageSet(area, nextValues);
  }

  let langPref = 'auto';
  let currentLang = ExtensionApi.i18n?.getUILanguage?.().startsWith('pt') ? 'pt-BR' : 'en';
  const messageCache = { 'pt-BR': null, en: null };

  function resolveLang(pref) {
    if (pref === 'pt-BR' || pref === 'en') return pref;
    return ExtensionApi.i18n?.getUILanguage?.().startsWith('pt') ? 'pt-BR' : 'en';
  }

  const LANG_META = {
    auto: { key: 'languageAuto', value: 'auto' },
    'pt-BR': { key: null, value: 'pt-BR', label: 'Português' },
    en: { key: null, value: 'en', label: 'English' },
  };

  function getLangLabel(pref) {
    const meta = LANG_META[pref];
    if (!meta) return pref;
    if (meta.key) return t(meta.key);
    return meta.label;
  }

  function syncLangDropdown(root) {
    const btn = root.querySelector('.lang-trigger');
    if (btn) btn.textContent = getLangLabel(langPref);
    root.querySelectorAll('.lang-option').forEach((opt) => {
      const selected = opt.dataset.lang === langPref;
      opt.setAttribute('aria-selected', selected ? 'true' : 'false');
      opt.classList.toggle('is-active', selected);
    });
  }

  async function loadMessages(lang) {
    const localeDir = lang === 'pt-BR' ? 'pt_BR' : 'en';
    if (messageCache[lang]) return messageCache[lang];
    try {
      const url = ExtensionApi.runtime.getURL(`_locales/${localeDir}/messages.json`);
      const res = await fetch(url);
      const data = await res.json();
      const map = {};
      Object.entries(data).forEach(([key, entry]) => {
        map[key] = entry && typeof entry === 'object' ? (entry.message || '') : '';
      });
      messageCache[lang] = map;
      return map;
    } catch {
      messageCache[lang] = {};
      return messageCache[lang];
    }
  }

  function t(key, lang = currentLang) {
    const map = messageCache[lang] || messageCache['pt-BR'] || {};
    return map[key] || ExtensionApi.i18n?.getMessage?.(key) || key;
  }

  function localize() {
    document.documentElement.lang = currentLang === 'pt-BR' ? 'pt-BR' : 'en';
    document.title = t('onboardingTitle');
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      const message = t(key);
      if (message) {
        node.textContent = message;
      }
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
      const key = node.getAttribute('data-i18n-aria-label');
      const message = t(key);
      if (message) {
        node.setAttribute('aria-label', message);
      }
    });
  }

  function renderAffiliateToggles(affiliateEnabled, affiliateDisabledStores) {
    const container = document.getElementById('affiliateToggles');
    if (!container) return;
    const disabled = new Set((affiliateDisabledStores || []).map((v) => String(v)));
    container.textContent = '';
    AFFILIATE_SITE_CONFIGS.forEach((site) => {
      const checked = affiliateEnabled && !disabled.has(site.siteId);
      const label = document.createElement('label');
      label.className = 'site-toggle';
      const textSpan = document.createElement('span');
      textSpan.className = 'site-toggle__text';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'site-toggle__name';
      nameSpan.textContent = site.name;
      textSpan.appendChild(nameSpan);
      const storeUrl = Affiliate?.getAffiliateStore?.(site.siteId)?.storeUrl;
      if (storeUrl) {
        const link = document.createElement('a');
        link.className = 'site-toggle__link';
        link.href = storeUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = storeUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        link.addEventListener('pointerdown', (event) => event.stopPropagation());
        link.addEventListener('click', (event) => event.stopPropagation());
        textSpan.appendChild(link);
      }
      const switchSpan = document.createElement('span');
      switchSpan.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-affiliate-site-id', site.siteId);
      input.checked = checked;
      input.disabled = !affiliateEnabled;
      const trackSpan = document.createElement('span');
      trackSpan.className = 'switch-track';
      trackSpan.setAttribute('aria-hidden', 'true');
      switchSpan.appendChild(input);
      switchSpan.appendChild(trackSpan);
      label.appendChild(textSpan);
      label.appendChild(switchSpan);
      container.appendChild(label);
    });
  }

  function updateAffiliateUI(enabled) {
    const container = document.getElementById('affiliateToggles');
    if (!container) return;
    const masterSwitch = document.getElementById('affiliateEnabled');
    if (masterSwitch) masterSwitch.checked = enabled;
    container.querySelectorAll('input[data-affiliate-site-id]').forEach((input) => {
      input.disabled = !enabled;
      input.checked = enabled;
    });
  }

  function markOnboardingSeen() {
    const area = getStorageArea();
    if (!area) {
      return Promise.resolve();
    }
    return storageSet(area, { onboardingSeen: true });
  }

  async function saveAffiliateSettings() {
    const masterSwitch = document.getElementById('affiliateEnabled');
    const affiliateEnabled = masterSwitch ? masterSwitch.checked : true;
    const affiliateDisabledStores = Array.from(document.querySelectorAll('[data-affiliate-site-id]'))
      .filter((input) => !input.checked)
      .map((input) => input.getAttribute('data-affiliate-site-id'));
    await savePartialSettings({ affiliateEnabled, affiliateDisabledStores });
  }

  async function openOptions() {
    await saveAffiliateSettings();
    await markOnboardingSeen();
    await openOptionsPage();
    window.close();
  }

  async function dismiss() {
    await saveAffiliateSettings();
    await markOnboardingSeen();
    window.close();
  }

  function bindLangPicker() {
    const root = document.getElementById('langPicker');
    if (!root) return;

    syncLangDropdown(root);

    const btn = root.querySelector('.lang-trigger');
    const menu = root.querySelector('.lang-menu');

    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = root.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.addEventListener('click', async (e) => {
        const opt = e.target.closest('.lang-option');
        if (!opt) return;
        langPref = opt.dataset.lang;
        currentLang = resolveLang(langPref);
        await loadMessages(currentLang);
        localize();
        syncLangDropdown(root);
        root.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('click', (e) => {
        if (!root.contains(e.target)) {
          root.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && root.classList.contains('is-open')) {
          root.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    }
  }

  function bind() {
    const openSettingsBtn = document.getElementById('openSettings');
    const dismissBtn = document.getElementById('dismiss');
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openOptions);
    if (dismissBtn) dismissBtn.addEventListener('click', dismiss);
    const masterSwitch = document.getElementById('affiliateEnabled');
    if (masterSwitch) {
      masterSwitch.addEventListener('change', () => {
        updateAffiliateUI(masterSwitch.checked);
      });
    }
  }

  async function init() {
    await loadMessages(currentLang);
    localize();
    bindLangPicker();
    const settings = await readSettings();
    if (document.getElementById('affiliateEnabled')) {
      document.getElementById('affiliateEnabled').checked = settings.affiliateEnabled;
    }
    renderAffiliateToggles(settings.affiliateEnabled, settings.affiliateDisabledStores);
    updateAffiliateUI(settings.affiliateEnabled);
    bind();
  }

  init();
})();
