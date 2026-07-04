const DEFAULT_SETTINGS = {
  salaryAmount: 5000,
  salaryCurrency: "BRL",
  monthlyHours: 160,
  wageMode: "monthly",
  hourlyRate: 0,
  extendedTimeDisplay: true,
  extendedTimeDayMode: "calendar",
  timeDisplayMode: "hours",
  salaryPeriod: "monthly",
  exchangeRateMode: "auto",
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: null,
  affiliateEnabled: true,
  affiliateDisabledStores: [],
  language: "auto",
};
const SOCIAL_STATUS_REQUEST = "aceitaTempo:getPopupStatus";
const LOCAL_SOCIAL_SESSION_KEY = "aceitaTempoSocialSession";

const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);

function getStorageArea() {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function readSettings() {
  return new Promise((resolve) => {
    getStorageArea().get(STORAGE_KEYS, (items) => resolve({ ...DEFAULT_SETTINGS, ...items }));
  });
}

function queryActiveTab() {
  return new Promise((resolve) => {
    if (!chrome.tabs?.query) {
      resolve(null);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
  });
}

function readLocalSocialSession() {
  return new Promise((resolve) => {
    if (!chrome.storage?.local?.get) {
      resolve(null);
      return;
    }

    chrome.storage.local.get([LOCAL_SOCIAL_SESSION_KEY], (items) => resolve(items?.[LOCAL_SOCIAL_SESSION_KEY] || null));
  });
}

function requestPopupStatus(tabId) {
  return new Promise((resolve) => {
    if (!chrome.tabs?.sendMessage || typeof tabId !== "number") {
      resolve(null);
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: SOCIAL_STATUS_REQUEST }, (response) => {
      if (chrome.runtime?.lastError) {
        resolve(null);
        return;
      }

      resolve(response || null);
    });
  });
}

function getTabSiteConfig(tab) {
  const siteConfigApi = globalThis.AceitaTempoSiteConfig;
  if (!siteConfigApi?.getSiteConfig || !tab?.url) {
    return null;
  }

  try {
    const url = new URL(tab.url);
    return siteConfigApi.getSiteConfig({
      hostname: url.hostname,
      pathname: url.pathname,
      href: url.href,
    });
  } catch {
    return null;
  }
}

async function resolvePopupStatus(activeTab) {
  const messageStatus = await requestPopupStatus(activeTab?.id);
  if (messageStatus?.kind === "social") {
    return messageStatus;
  }

  const siteConfig = getTabSiteConfig(activeTab);
  if (siteConfig?.kind !== "social") {
    return null;
  }

  const storedSession = await readLocalSocialSession();
  if (!storedSession || storedSession.siteId !== siteConfig.siteId) {
    return {
      kind: "social",
      siteId: siteConfig.siteId,
      siteName: siteConfig.name,
      activeMs: 0,
      tracking: false,
    };
  }

  return {
    kind: "social",
    siteId: storedSession.siteId,
    siteName: storedSession.siteName || siteConfig.name,
    activeMs: Number(storedSession.activeMs) || 0,
    tracking: true,
  };
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatDurationCompact(activeMs) {
  const totalSeconds = Math.max(0, Math.round(Number(activeMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function renderSocialCounter(popupStatus) {
  const socialCounterCard = document.getElementById("socialCounterCard");
  if (popupStatus?.kind === "social") {
    socialCounterCard.hidden = false;
    document.getElementById("socialSiteName").textContent = popupStatus.siteName || chrome.i18n.getMessage("popupSocialDefaultSite");
    document.getElementById("socialActiveTime").textContent = formatDurationCompact(popupStatus.activeMs);
    return;
  }

  socialCounterCard.hidden = true;
}

function localize(settings) {
  const i18n = globalThis.AceitaTempoI18n;
  const lang = i18n ? i18n.getEffectiveLanguage(settings) : chrome.i18n.getUILanguage().replace("_", "-");
  document.documentElement.lang = lang === "pt-BR" ? "pt-BR" : "en";
  document.title = chrome.i18n.getMessage("popupTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    const message = i18n ? i18n.getMessage(key, [], settings) : chrome.i18n.getMessage(key);
    if (message) {
      node.textContent = message;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    const message = i18n ? i18n.getMessage(key, [], settings) : chrome.i18n.getMessage(key);
    if (message) {
      node.placeholder = message;
    }
  });
}

async function init() {
  const [settings, activeTab] = await Promise.all([readSettings(), queryActiveTab()]);
  localize(settings);

  const i18n = globalThis.AceitaTempoI18n;
  const effectiveLang = i18n ? i18n.getEffectiveLanguage(settings) : chrome.i18n.getUILanguage();
  let socialCounterIntervalId = null;
  const refreshSocialCounter = async () => {
    const popupStatus = await resolvePopupStatus(activeTab);
    renderSocialCounter(popupStatus);
  };
  const isHourly = settings.wageMode === "hourly";
  const hourly = isHourly
    ? settings.hourlyRate
    : (settings.salaryAmount && settings.monthlyHours ? settings.salaryAmount / settings.monthlyHours : 0);
  const exchangeLabel =
    settings.exchangeRateMode === "manual"
      ? chrome.i18n.getMessage("manualRateStatus", [formatNumber(settings.manualUsdToBrlRate, 4)])
      : settings.exchangeRateUsdToBrl
        ? chrome.i18n.getMessage("autoRateCompact", [formatNumber(settings.exchangeRateUsdToBrl, 4)])
        : chrome.i18n.getMessage("autoRatePending");

  const salaryRow = document.getElementById("salaryRow");
  const hoursRow = document.getElementById("hoursRow");

  if (isHourly) {
    salaryRow.style.display = "none";
    hoursRow.style.display = "none";
  } else {
    salaryRow.style.display = "";
    hoursRow.style.display = "";
    document.getElementById("salaryValue").textContent = formatMoney(settings.salaryAmount, settings.salaryCurrency);
    document.getElementById("hoursValue").textContent = chrome.i18n.getMessage("hoursSummaryValue", [
      formatNumber(settings.monthlyHours),
    ]);
  }

  document.getElementById("hourlyValue").textContent = formatMoney(hourly, settings.salaryCurrency);
  document.getElementById("exchangeValue").textContent = exchangeLabel;
  await refreshSocialCounter();
  socialCounterIntervalId = window.setInterval(refreshSocialCounter, 1000);

  window.addEventListener("unload", () => {
    if (socialCounterIntervalId) {
      window.clearInterval(socialCounterIntervalId);
    }
  }, { once: true });

  document.getElementById("openOptions").addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
    window.close();
  });

  const currencySymbols = { BRL: "R$", USD: "$" };
  const calcCurrency = document.getElementById("calcCurrency");
  const calcInput = document.getElementById("calcInput");
  const calcResult = document.getElementById("calcResult");
  const calcTime = document.getElementById("calcTime");
  const priceUtils = globalThis.AceitaTempoPriceUtils;

  calcCurrency.textContent = currencySymbols[settings.salaryCurrency] || settings.salaryCurrency;

  calcInput.addEventListener("input", () => {
    const raw = calcInput.value.trim();
    if (!raw || !priceUtils) {
      calcResult.hidden = true;
      return;
    }

    const amount = priceUtils.parseLocalizedAmount(raw, settings.salaryCurrency);
    if (amount === null || amount <= 0) {
      calcResult.hidden = true;
      return;
    }

    const duration = priceUtils.calculateWorkDuration(amount, settings.salaryCurrency, settings);
    if (!duration) {
      calcResult.hidden = true;
      return;
    }

    const locale = effectiveLang;
    const timeText = priceUtils.formatWorkDurationShort(duration, settings, locale);
    calcTime.textContent = timeText;
    calcResult.hidden = false;
  });

  const langSelect = document.getElementById("popupLangSelect");
  if (langSelect) {
    langSelect.value = settings.language || "auto";
    langSelect.addEventListener("change", async () => {
      const area = getStorageArea();
      if (!area) return;
      await new Promise((resolve) => area.set({ language: langSelect.value }, resolve));
      localize({ ...settings, language: langSelect.value });
    });
  }
}

init();
