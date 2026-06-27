(function onboardingInit() {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  const SiteConfig = globalObj.AceitaTempoSiteConfig;
  const Affiliate = globalObj.AceitaTempoAffiliate;
  const DEFAULT_SETTINGS = { affiliateEnabled: true, affiliateDisabledStores: [] };
  const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);
  const COMMERCE_SITE_CONFIGS = SiteConfig?.siteConfigs?.filter((s) => s.kind !== 'social') || [];
  const AFFILIATE_STORE_IDS = new Set(Affiliate?.AFFILIATE_STORE_IDS || []);
  const AFFILIATE_SITE_CONFIGS = COMMERCE_SITE_CONFIGS.filter((s) => AFFILIATE_STORE_IDS.has(s.siteId));

  function getStorageArea() {
    return chrome.storage?.sync ?? chrome.storage?.local;
  }

  function readSettings() {
    return new Promise((resolve) => {
      getStorageArea().get(STORAGE_KEYS, (items) => resolve({ ...DEFAULT_SETTINGS, ...items }));
    });
  }

  function savePartialSettings(nextValues) {
    return new Promise((resolve) => {
      getStorageArea().set(nextValues, () => resolve());
    });
  }

  let currentLang = chrome.i18n.getUILanguage().startsWith('pt') ? 'pt-BR' : 'en';
  const messageCache = { 'pt-BR': null, en: null };

  async function loadMessages(lang) {
    const localeDir = lang === 'pt-BR' ? 'pt_BR' : 'en';
    if (messageCache[lang]) return messageCache[lang];
    try {
      const url = chrome.runtime.getURL(`_locales/${localeDir}/messages.json`);
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
    return map[key] || chrome.i18n?.getMessage?.(key) || key;
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
    return new Promise((resolve) => {
      const area = chrome.storage?.sync ?? chrome.storage?.local;
      if (!area) { resolve(); return; }
      area.set({ onboardingSeen: true }, () => resolve());
    });
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
    if (chrome.runtime?.openOptionsPage) chrome.runtime.openOptionsPage();
    window.close();
  }

  async function dismiss() {
    await saveAffiliateSettings();
    await markOnboardingSeen();
    window.close();
  }

  function bindLangPicker() {
    const picker = document.getElementById('langPicker');
    if (!picker) return;
    picker.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.lang === currentLang ? 'true' : 'false');
       btn.addEventListener('click', async () => {
        currentLang = btn.dataset.lang;
        picker.querySelectorAll('[data-lang]').forEach((b) => {
          b.setAttribute('aria-pressed', b.dataset.lang === currentLang ? 'true' : 'false');
        });
         await loadMessages(currentLang);
        localize();
      });
    });
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
