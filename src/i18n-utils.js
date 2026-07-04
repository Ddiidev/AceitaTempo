(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  if (globalObj.AceitaTempoI18n) return;

  const EXTENSION_API = typeof browser !== 'undefined' ? browser : chrome;
  const messageCache = { 'pt-BR': null, en: null };

  function getEffectiveLanguage(settings) {
    const lang = String(settings?.language || 'auto').toLowerCase();
    if (lang !== 'auto' && (lang === 'pt-br' || lang === 'en')) {
      return lang === 'pt-br' ? 'pt-BR' : 'en';
    }
    const uiLang = EXTENSION_API.i18n?.getUILanguage?.() || navigator.language || 'en-US';
    return /^pt/i.test(uiLang) ? 'pt-BR' : 'en';
  }

  function localeDir(lang) {
    return lang === 'pt-BR' ? 'pt_BR' : 'en';
  }

  async function loadMessages(lang) {
    if (messageCache[lang]) return messageCache[lang];
    try {
      const url = EXTENSION_API.runtime.getURL(`_locales/${localeDir(lang)}/messages.json`);
      const res = await fetch(url);
      const data = await res.json();
      const map = {};
      Object.entries(data).forEach(([key, entry]) => {
        map[key] = entry?.message || '';
      });
      messageCache[lang] = map;
      return map;
    } catch {
      messageCache[lang] = {};
      return messageCache[lang];
    }
  }

  function substituteMessage(template, substitutions) {
    if (!substitutions?.length) return template;
    return substitutions.reduce(
      (text, value, index) => text.replace(new RegExp(`\\$${index + 1}`, 'g'), String(value)),
      template
    );
  }

  function getMessage(key, substitutions, settings) {
    const lang = getEffectiveLanguage(settings || {});
    if (lang === 'auto' || !messageCache[lang]) {
      const msg = EXTENSION_API.i18n?.getMessage?.(key, substitutions);
      return msg || key;
    }
    const template = messageCache[lang]?.[key];
    if (!template) return key;
    return substituteMessage(template, substitutions);
  }

  function localizeElement(settings) {
    const lang = getEffectiveLanguage(settings || {});
    document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      const message = getMessage(key, [], settings);
      if (message) node.textContent = message;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      const message = getMessage(key, [], settings);
      if (message) node.placeholder = message;
    });
  }

  globalObj.AceitaTempoI18n = {
    getEffectiveLanguage,
    loadMessages,
    getMessage,
    localizeElement,
    messageCache,
  };
})();
