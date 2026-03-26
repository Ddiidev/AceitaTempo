const DEFAULT_SETTINGS = {
  salaryAmount: 5000,
  salaryCurrency: "BRL",
  monthlyHours: 160,
  wageMode: "monthly",
  hourlyRate: 0,
  extendedTimeDisplay: true,
  extendedTimeDayMode: "calendar",
  exchangeRateMode: "auto",
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: null,
};

const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);

function getStorageArea() {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function readSettings() {
  return new Promise((resolve) => {
    getStorageArea().get(STORAGE_KEYS, (items) => resolve({ ...DEFAULT_SETTINGS, ...items }));
  });
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

function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage().replace("_", "-");
  document.title = chrome.i18n.getMessage("popupTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    const message = chrome.i18n.getMessage(key);
    if (message) {
      node.textContent = message;
    }
  });
}

async function init() {
  localize();

  const settings = await readSettings();
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

  document.getElementById("openOptions").addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
    window.close();
  });
}

init();
