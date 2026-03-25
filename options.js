const DEFAULT_SETTINGS = {
  salaryAmount: 5000,
  salaryCurrency: "BRL",
  monthlyHours: 160,
  wageMode: "monthly",
  hourlyRate: 0,
  replacePricesWithHours: false,
  enableExternalSites: false,
  disabledSiteNames: [],
  exchangeRateMode: "auto",
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: null,
};

const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);
const SITE_CONFIGS = globalThis.AceitaTempoSiteConfig?.siteConfigs
  || globalThis.AceitaTempoSiteConfig?.getSiteConfigs?.()
  || [];

const $ = (id) => document.getElementById(id);

function getStorageArea() {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function readSettings() {
  return new Promise((resolve) => {
    getStorageArea().get(STORAGE_KEYS, (items) => resolve({ ...DEFAULT_SETTINGS, ...items }));
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    getStorageArea().set(settings, resolve);
  });
}

function refreshExchangeRate() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "aceitaTempo:refreshExchangeRate" }, (response) => resolve(response));
  });
}

function isTruthySetting(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeSettings(raw) {
  return {
    salaryAmount: Math.max(0, Number(raw.salaryAmount) || 0),
    salaryCurrency: raw.salaryCurrency === "USD" ? "USD" : "BRL",
    monthlyHours: Math.max(1, Math.round(Number(raw.monthlyHours) || DEFAULT_SETTINGS.monthlyHours)),
    wageMode: raw.wageMode === "hourly" ? "hourly" : "monthly",
    hourlyRate: Math.max(0, Number(raw.hourlyRate) || 0),
    replacePricesWithHours: isTruthySetting(raw.replacePricesWithHours),
    enableExternalSites: isTruthySetting(raw.enableExternalSites ?? raw.enableExternal ?? raw.allowExternalSites),
    disabledSiteNames: Array.isArray(raw.disabledSiteNames) ? raw.disabledSiteNames : [],
    exchangeRateMode: raw.exchangeRateMode === "manual" ? "manual" : "auto",
    manualUsdToBrlRate: Math.max(0, Number(raw.manualUsdToBrlRate) || 0),
  };
}

function formatRate(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

function updateWageModeUI(mode) {
  const isHourly = mode === "hourly";
  $("wageMode").checked = isHourly;

  $("salaryAmount").closest(".field").style.display = isHourly ? "none" : "";
  $("monthlyHours").closest(".field").style.display = isHourly ? "none" : "";
  $("hourlyRateGroup").style.display = isHourly ? "" : "none";
}

function fillForm(settings) {
  $("salaryAmount").value = settings.salaryAmount;
  $("salaryCurrency").value = settings.salaryCurrency;
  $("monthlyHours").value = settings.monthlyHours;
  $("hourlyRate").value = settings.hourlyRate;
  $("replacePricesWithHours").checked = isTruthySetting(settings.replacePricesWithHours);
  $("enableExternalSites").checked = isTruthySetting(settings.enableExternalSites);
  $("exchangeRateMode").value = settings.exchangeRateMode;
  $("manualUsdToBrlRate").value = settings.manualUsdToBrlRate;
  $("manualUsdToBrlRate").disabled = settings.exchangeRateMode !== "manual";
  updateWageModeUI(settings.wageMode);
  renderSiteToggles(settings.disabledSiteNames);
}

function renderSiteToggles(disabledSiteNames = []) {
  const container = $("siteToggles");
  if (!container) return;

  const disabled = new Set((disabledSiteNames || []).map((value) => String(value)));
  container.innerHTML = SITE_CONFIGS.map((site) => {
    const checked = !disabled.has(site.name);
    return `
      <label class="site-toggle">
        <span class="site-toggle__text">
          <span class="site-toggle__name">${site.name}</span>
          <span class="site-toggle__meta">${site.hostPatterns?.map((pattern) => pattern.source).join(" • ") || ""}</span>
        </span>
        <span class="switch">
          <input type="checkbox" data-site-name="${site.name}" ${checked ? "checked" : ""} />
          <span class="switch-track" aria-hidden="true"></span>
        </span>
      </label>
    `;
  }).join("");
}

function updateSiteBlockToggle() {
  const body = $("siteBlockBody");
  const button = $("siteBlockToggle");
  if (!body || !button) return;

  const expanded = body.classList.contains("is-expanded");
  button.textContent = chrome.i18n.getMessage(expanded ? "siteBlockShowLess" : "siteBlockShowMore");
  button.setAttribute("aria-expanded", String(expanded));
}

function setStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.style.color = isError ? "#b91c1c" : "#0f766e";
}

function updateRateSnapshot(settings) {
  const rateNode = $("rateSnapshot");

  if (settings.exchangeRateMode === "manual") {
    rateNode.textContent = chrome.i18n.getMessage("manualRateStatus", [formatRate(settings.manualUsdToBrlRate || 0)]);
    return;
  }

  if (settings.exchangeRateUsdToBrl && settings.exchangeRateFetchedAt) {
    const formattedDate = new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(settings.exchangeRateFetchedAt));

    rateNode.textContent = chrome.i18n.getMessage("autoRateStatus", [
      formatRate(settings.exchangeRateUsdToBrl),
      formattedDate,
    ]);
    return;
  }

  rateNode.textContent = chrome.i18n.getMessage("autoRatePending");
}

function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage().replace("_", "-");
  document.title = chrome.i18n.getMessage("optionsTitle");

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
  fillForm(settings);
  updateHourlyRateCurrencyPrefix();
  updateRateSnapshot(settings);
  updateSiteBlockToggle();

  $("wageMode").addEventListener("change", () => {
    const isHourly = $("wageMode").checked;
    updateWageModeUI(isHourly ? "hourly" : "monthly");

    if (isHourly && (!$("hourlyRate").value || Number($("hourlyRate").value) === 0)) {
      const salary = Number($("salaryAmount").value) || 0;
      const hours = Number($("monthlyHours").value) || 1;
      if (salary > 0) {
        $("hourlyRate").value = (salary / hours).toFixed(2);
      }
    }
  });

  $("exchangeRateMode").addEventListener("change", () => {
    $("manualUsdToBrlRate").disabled = $("exchangeRateMode").value !== "manual";
  });

  function updateHourlyRateCurrencyPrefix() {
    const prefix = $("hourlyRateCurrencyPrefix");
    if (prefix) {
      prefix.textContent = $("salaryCurrency").value === "USD" ? "$" : "R$";
    }
  }

  $("salaryCurrency").addEventListener("change", updateHourlyRateCurrencyPrefix);

  $("siteBlockToggle").addEventListener("click", () => {
    const body = $("siteBlockBody");
    if (!body) return;
    body.classList.toggle("is-expanded");
    body.classList.toggle("is-collapsed", !body.classList.contains("is-expanded"));
    updateSiteBlockToggle();
  });

  $("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = normalizeSettings({
      salaryAmount: $("salaryAmount").value,
      salaryCurrency: $("salaryCurrency").value,
      monthlyHours: $("monthlyHours").value,
      wageMode: $("wageMode").checked ? "hourly" : "monthly",
      hourlyRate: $("hourlyRate").value,
      replacePricesWithHours: $("replacePricesWithHours").checked,
      enableExternalSites: $("enableExternalSites").checked,
      disabledSiteNames: Array.from(document.querySelectorAll("[data-site-name]"))
        .filter((input) => !input.checked)
        .map((input) => input.getAttribute("data-site-name")),
      exchangeRateMode: $("exchangeRateMode").value,
      manualUsdToBrlRate: $("manualUsdToBrlRate").value,
    });

    if (payload.exchangeRateMode === "manual" && payload.manualUsdToBrlRate <= 0) {
      setStatus(chrome.i18n.getMessage("manualRateRequired"), true);
      return;
    }

    if (payload.wageMode === "hourly" && payload.hourlyRate <= 0) {
      setStatus(chrome.i18n.getMessage("hourlyRateRequired"), true);
      return;
    }

    await saveSettings(payload);

    let hadExchangeWarning = false;
    if (payload.exchangeRateMode === "auto") {
      const response = await refreshExchangeRate();
      if (!response?.ok) {
        setStatus(chrome.i18n.getMessage("savedWithExchangeWarning"), true);
        hadExchangeWarning = true;
      }
    }

    const nextSettings = await readSettings();
    updateRateSnapshot(nextSettings);
    if (!hadExchangeWarning) {
      setStatus(chrome.i18n.getMessage("savedMessage"));
    }
  });

  $("resetButton").addEventListener("click", async () => {
    await saveSettings(DEFAULT_SETTINGS);
    fillForm(DEFAULT_SETTINGS);
    updateHourlyRateCurrencyPrefix();
    updateRateSnapshot(DEFAULT_SETTINGS);
    updateSiteBlockToggle();
    setStatus(chrome.i18n.getMessage("resetMessage"));
  });
}

init();
