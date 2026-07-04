const DEFAULT_SETTINGS = {
  salaryAmount: 5000,
  monthlyHours: 160,
  salaryCurrency: "BRL",
  wageMode: "monthly",
  hourlyRate: 0,
  extendedTimeDisplay: true,
  extendedTimeDayMode: "calendar",
  exchangeRateMode: "auto",
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: null,
  socialAwarenessEnabled: false,
  socialAwarenessSites: ["instagram", "youtube", "youtube-shorts", "tiktok"],
  socialPromptEnabled: true,
  socialTrackingEnabled: true,
  socialReflectionEnabled: true,
  socialMonetaryOptIn: false,
  affiliateEnabled: true,
  affiliateDisabledStores: [],
  language: "auto",
};

const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);
const EXCHANGE_ALARM = "aceita-tempo-refresh-exchange-rate";
const EXCHANGE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EXCHANGE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const EXTENSION_API = typeof browser !== "undefined" ? browser : chrome;
const USES_BROWSER_PROMISE_API = typeof browser !== "undefined";

function getLastRuntimeError() {
  const chromeRuntime = typeof chrome !== "undefined" ? chrome.runtime : null;
  return chromeRuntime?.lastError || EXTENSION_API?.runtime?.lastError || null;
}

function callCallbackApi(method, context, ...args) {
  return new Promise((resolve, reject) => {
    method.call(context, ...args, (result) => {
      const error = getLastRuntimeError();
      if (error) {
        reject(new Error(error.message || String(error)));
        return;
      }
      resolve(result);
    });
  });
}

function getStorageArea() {
  return EXTENSION_API.storage?.sync ?? EXTENSION_API.storage?.local;
}

function storageGet(area, keys) {
  if (USES_BROWSER_PROMISE_API) {
    return area.get(keys);
  }
  return callCallbackApi(area.get, area, keys);
}

function storageSet(area, values) {
  if (USES_BROWSER_PROMISE_API) {
    return area.set(values);
  }
  return callCallbackApi(area.set, area, values);
}

function createTab(createProperties) {
  if (USES_BROWSER_PROMISE_API) {
    return EXTENSION_API.tabs.create(createProperties);
  }
  return callCallbackApi(EXTENSION_API.tabs.create, EXTENSION_API.tabs, createProperties);
}

async function createAlarm(name, alarmInfo) {
  const result = EXTENSION_API.alarms.create(name, alarmInfo);
  if (result && typeof result.then === "function") {
    await result;
  }
}

async function getSettings() {
  const area = getStorageArea();
  const stored = area ? await storageGet(area, STORAGE_KEYS) : {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function savePartialSettings(nextValues) {
  const area = getStorageArea();
  if (!area) {
    return;
  }
  await storageSet(area, nextValues);
}

async function ensureDefaults() {
  const area = getStorageArea();
  if (!area) {
    return;
  }
  const current = await storageGet(area, STORAGE_KEYS);
  const missingEntries = Object.entries(DEFAULT_SETTINGS).filter(([key]) => current[key] === undefined);

  if (!missingEntries.length) {
    return;
  }

  await storageSet(area, Object.fromEntries(missingEntries));
}

async function maybeOpenOnboarding() {
  const area = getStorageArea();
  if (!area) {
    return;
  }
  const items = await storageGet(area, ["onboardingSeen"]);
  if (items?.onboardingSeen) {
    return;
  }
  await storageSet(area, { onboardingSeen: true });
  try {
    await createTab({ url: EXTENSION_API.runtime.getURL("onboarding.html") });
  } catch (error) {
    console.warn("[AceitaTempo] Failed to open onboarding", error);
  }
}

async function fetchUsdToBrlRate() {
  const response = await fetch(EXCHANGE_ENDPOINT, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Exchange rate request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const rate = payload?.rates?.BRL;

  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid USD/BRL exchange rate payload");
  }

  return rate;
}

async function refreshExchangeRate({ force = false } = {}) {
  const settings = await getSettings();

  if (settings.exchangeRateMode !== "auto" && !force) {
    return {
      ok: true,
      skipped: true,
      reason: "manual-mode",
      rate: settings.exchangeRateUsdToBrl,
      fetchedAt: settings.exchangeRateFetchedAt,
    };
  }

  const fetchedAt = settings.exchangeRateFetchedAt ? Date.parse(settings.exchangeRateFetchedAt) : 0;
  const cacheValid = fetchedAt && (Date.now() - fetchedAt) < EXCHANGE_CACHE_TTL_MS;

  if (!force && cacheValid) {
    return {
      ok: true,
      skipped: true,
      reason: "cache-valid",
      rate: settings.exchangeRateUsdToBrl,
      fetchedAt: settings.exchangeRateFetchedAt,
    };
  }

  const rate = await fetchUsdToBrlRate();
  const nextState = {
    exchangeRateUsdToBrl: rate,
    exchangeRateFetchedAt: new Date().toISOString(),
  };

  await savePartialSettings(nextState);

  return {
    ok: true,
    skipped: false,
    reason: "updated",
    rate,
    fetchedAt: nextState.exchangeRateFetchedAt,
  };
}

EXTENSION_API.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await createAlarm(EXCHANGE_ALARM, {
    periodInMinutes: 60,
  });

  try {
    await refreshExchangeRate();
  } catch (error) {
    console.warn("[AceitaTempo] Failed to refresh exchange rate on install", error);
  }

  await maybeOpenOnboarding();
});

EXTENSION_API.runtime.onStartup.addListener(async () => {
  await ensureDefaults();

  try {
    await refreshExchangeRate();
  } catch (error) {
    console.warn("[AceitaTempo] Failed to refresh exchange rate on startup", error);
  }
});

EXTENSION_API.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== EXCHANGE_ALARM) {
    return;
  }

  try {
    await refreshExchangeRate();
  } catch (error) {
    console.warn("[AceitaTempo] Failed to refresh exchange rate from alarm", error);
  }
});

EXTENSION_API.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  if (message.type === "aceitaTempo:getSettings") {
    const response = getSettings()
      .then((settings) => ({ ok: true, settings }))
      .catch((error) => ({ ok: false, error: error.message }));

    if (USES_BROWSER_PROMISE_API) {
      return response;
    }

    response.then(sendResponse);
    return true;
  }

  if (message.type === "aceitaTempo:refreshExchangeRate") {
    const response = refreshExchangeRate({ force: true })
      .then((result) => result)
      .catch((error) => ({ ok: false, error: error.message }));

    if (USES_BROWSER_PROMISE_API) {
      return response;
    }

    response.then(sendResponse);
    return true;
  }

  return undefined;
});
