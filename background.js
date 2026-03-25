const DEFAULT_SETTINGS = {
  salaryAmount: 5000,
  monthlyHours: 160,
  salaryCurrency: "BRL",
  wageMode: "monthly",
  hourlyRate: 0,
  exchangeRateMode: "auto",
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: null,
};

const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);
const EXCHANGE_ALARM = "aceita-tempo-refresh-exchange-rate";
const EXCHANGE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EXCHANGE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

async function getSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function savePartialSettings(nextValues) {
  await chrome.storage.sync.set(nextValues);
}

async function ensureDefaults() {
  const current = await chrome.storage.sync.get(STORAGE_KEYS);
  const missingEntries = Object.entries(DEFAULT_SETTINGS).filter(([key]) => current[key] === undefined);

  if (!missingEntries.length) {
    return;
  }

  await chrome.storage.sync.set(Object.fromEntries(missingEntries));
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

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await chrome.alarms.create(EXCHANGE_ALARM, {
    periodInMinutes: 60,
  });

  try {
    await refreshExchangeRate();
  } catch (error) {
    console.warn("[AceitaTempo] Failed to refresh exchange rate on install", error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();

  try {
    await refreshExchangeRate();
  } catch (error) {
    console.warn("[AceitaTempo] Failed to refresh exchange rate on startup", error);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== EXCHANGE_ALARM) {
    return;
  }

  try {
    await refreshExchangeRate();
  } catch (error) {
    console.warn("[AceitaTempo] Failed to refresh exchange rate from alarm", error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  if (message.type === "aceitaTempo:getSettings") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message.type === "aceitaTempo:refreshExchangeRate") {
    refreshExchangeRate({ force: true })
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  return undefined;
});
