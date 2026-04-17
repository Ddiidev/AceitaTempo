const DEFAULT_SOCIAL_SITES = ["instagram", "youtube", "youtube-shorts", "tiktok"];
const SOCIAL_SITE_OPTIONS = [
  { id: "instagram", labelKey: "socialAwarenessSiteInstagram" },
  { id: "youtube", labelKey: "socialAwarenessSiteYouTube" },
  { id: "youtube-shorts", labelKey: "socialAwarenessSiteYouTubeShorts" },
  { id: "tiktok", labelKey: "socialAwarenessSiteTikTok" },
];

const DEFAULT_SETTINGS = {
  salaryAmount: 5000,
  salaryCurrency: "BRL",
  monthlyHours: 160,
  salaryPeriod: "monthly",
  wageMode: "monthly",
  hourlyRate: 0,
  timeDisplayMode: "hours",
  extendedTimeDisplay: true,
  extendedTimeDayMode: "calendar",
  replacePricesWithHours: false,
  showSalaryPercent: true,
  enableExternalSites: false,
  disabledSiteNames: [],
  exchangeRateMode: "auto",
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: null,
  socialAwarenessEnabled: false,
  socialAwarenessSites: [...DEFAULT_SOCIAL_SITES],
  socialPromptEnabled: true,
  socialTrackingEnabled: true,
  socialReflectionEnabled: true,
  socialMonetaryOptIn: false,
};

const STORAGE_KEYS = Object.keys(DEFAULT_SETTINGS);
const SITE_CONFIGS = globalThis.AceitaTempoSiteConfig?.siteConfigs
  || globalThis.AceitaTempoSiteConfig?.getSiteConfigs?.()
  || [];
const COMMERCE_SITE_CONFIGS = SITE_CONFIGS.filter((site) => site.kind !== "social");
const FEEDBACK_HIDE_DELAY_MS = 2800;
const ACTION_LABEL_KEYS = {
  save: { idle: "saveButton", busy: "saveButtonSaving" },
  reset: { idle: "resetButton", busy: "resetButtonSaving" },
};

const $ = (id) => document.getElementById(id);
let feedbackHideTimer = null;

function getStorageArea() {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function readSettings() {
  return new Promise((resolve) => {
    getStorageArea().get(STORAGE_KEYS, (items) => resolve(normalizeSettings({ ...DEFAULT_SETTINGS, ...items })));
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

function normalizeSocialSites(rawSites) {
  const values = Array.isArray(rawSites) ? rawSites : DEFAULT_SOCIAL_SITES;
  const normalized = values.map((value) => String(value || "").toLowerCase()).filter(Boolean);
  return normalized.length ? [...new Set(normalized)] : [...DEFAULT_SOCIAL_SITES];
}

function normalizeSettings(raw) {
  return {
    salaryAmount: Math.max(0, Number(raw.salaryAmount) || 0),
    salaryCurrency: raw.salaryCurrency === "USD" ? "USD" : "BRL",
    monthlyHours: Math.max(1, Math.round(Number(raw.monthlyHours) || DEFAULT_SETTINGS.monthlyHours)),
    salaryPeriod: ["monthly", "biweekly", "weekly", "daily"].includes(String(raw.salaryPeriod || "").toLowerCase())
      ? String(raw.salaryPeriod).toLowerCase()
      : DEFAULT_SETTINGS.salaryPeriod,
    wageMode: raw.wageMode === "hourly" ? "hourly" : "monthly",
    hourlyRate: Math.max(0, Number(raw.hourlyRate) || 0),
    timeDisplayMode: String(raw.timeDisplayMode || "").toLowerCase() === "period" ? "period" : "hours",
    extendedTimeDisplay: isTruthySetting(raw.extendedTimeDisplay ?? true),
    extendedTimeDayMode: raw.extendedTimeDayMode === "working" ? "working" : "calendar",
    replacePricesWithHours: isTruthySetting(raw.replacePricesWithHours),
    showSalaryPercent: raw.showSalaryPercent === undefined ? true : isTruthySetting(raw.showSalaryPercent),
    enableExternalSites: isTruthySetting(raw.enableExternalSites ?? raw.enableExternal ?? raw.allowExternalSites),
    disabledSiteNames: Array.isArray(raw.disabledSiteNames) ? raw.disabledSiteNames : [],
    exchangeRateMode: raw.exchangeRateMode === "manual" ? "manual" : "auto",
    manualUsdToBrlRate: Math.max(0, Number(raw.manualUsdToBrlRate) || 0),
    exchangeRateUsdToBrl: Math.max(0, Number(raw.exchangeRateUsdToBrl) || 0),
    exchangeRateFetchedAt: raw.exchangeRateFetchedAt || null,
    socialAwarenessEnabled: isTruthySetting(raw.socialAwarenessEnabled),
    socialAwarenessSites: normalizeSocialSites(raw.socialAwarenessSites),
    socialPromptEnabled: isTruthySetting(raw.socialPromptEnabled ?? true),
    socialTrackingEnabled: isTruthySetting(raw.socialTrackingEnabled ?? true),
    socialReflectionEnabled: isTruthySetting(raw.socialReflectionEnabled ?? true),
    socialMonetaryOptIn: isTruthySetting(raw.socialMonetaryOptIn),
  };
}

function formatRate(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

function updateWageModeUI(mode) {
  const isHourly = mode === "hourly";
  $("wageMode").checked = isHourly;

  $("salaryAmount").closest(".field").style.display = isHourly ? "none" : "";
  $("salaryPeriod").closest(".field").style.display = isHourly ? "none" : "";
  $("monthlyHours").closest(".field").style.display = isHourly ? "none" : "";
  $("hourlyRateGroup").style.display = isHourly ? "" : "none";
}

function updateExtendedTimeUI(enabled) {
  $("extendedTimeDisplay").checked = enabled;
  $("extendedTimeDayModeGroup").style.display = enabled ? "" : "none";
}

function updateSocialAwarenessUI(enabled) {
  const controls = $("socialAwarenessControls");
  if (!controls) return;

  $("socialAwarenessEnabled").checked = enabled;
  controls.hidden = !enabled;
  controls.querySelectorAll("input").forEach((input) => {
    input.disabled = !enabled;
  });
}

function fillForm(settings) {
  $("salaryAmount").value = settings.salaryAmount;
  $("salaryCurrency").value = settings.salaryCurrency;
  $("monthlyHours").value = settings.monthlyHours;
  $("salaryPeriod").value = settings.salaryPeriod;
  $("hourlyRate").value = settings.hourlyRate;
  $("timeDisplayMode").value = settings.timeDisplayMode;
  $("replacePricesWithHours").checked = isTruthySetting(settings.replacePricesWithHours);
  $("showSalaryPercent").checked = settings.showSalaryPercent !== false;
  $("enableExternalSites").checked = isTruthySetting(settings.enableExternalSites);
  $("exchangeRateMode").value = settings.exchangeRateMode;
  $("manualUsdToBrlRate").value = settings.manualUsdToBrlRate;
  $("manualUsdToBrlRate").disabled = settings.exchangeRateMode !== "manual";
  $("extendedTimeDayMode").value = settings.extendedTimeDayMode;
  $("socialPromptEnabled").checked = settings.socialPromptEnabled;
  $("socialTrackingEnabled").checked = settings.socialTrackingEnabled;
  $("socialReflectionEnabled").checked = settings.socialReflectionEnabled;
  $("socialMonetaryOptIn").checked = settings.socialMonetaryOptIn;

  updateExtendedTimeUI(settings.extendedTimeDisplay);
  updateWageModeUI(settings.wageMode);
  renderSiteToggles(settings.disabledSiteNames);
  renderSocialSiteToggles(settings.socialAwarenessSites);
  updateSocialAwarenessUI(settings.socialAwarenessEnabled);
}

function renderSiteToggles(disabledSiteNames = []) {
  const container = $("siteToggles");
  if (!container) return;

  const disabled = new Set((disabledSiteNames || []).map((value) => String(value)));
  container.innerHTML = COMMERCE_SITE_CONFIGS.map((site) => {
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

function renderSocialSiteToggles(selectedSiteIds = []) {
  const container = $("socialAwarenessSiteToggles");
  if (!container) return;

  const selected = new Set(normalizeSocialSites(selectedSiteIds));
  container.innerHTML = SOCIAL_SITE_OPTIONS.map((site) => `
    <label class="site-toggle site-toggle--checkbox">
      <span class="site-toggle__text">
        <span class="site-toggle__name">${chrome.i18n.getMessage(site.labelKey)}</span>
      </span>
      <input type="checkbox" data-social-site-id="${site.id}" ${selected.has(site.id) ? "checked" : ""} />
    </label>
  `).join("");
}

function getSelectedSocialSites() {
  return Array.from(document.querySelectorAll("[data-social-site-id]"))
    .filter((input) => input.checked)
    .map((input) => input.getAttribute("data-social-site-id"))
    .filter(Boolean);
}

function ensureAllSocialSitesSelectedIfNeeded() {
  if (!$("socialAwarenessEnabled").checked) {
    return;
  }

  const inputs = Array.from(document.querySelectorAll("[data-social-site-id]"));
  if (!inputs.length || inputs.some((input) => input.checked)) {
    return;
  }

  inputs.forEach((input) => {
    input.checked = true;
  });
}

function updateSiteBlockToggle() {
  const body = $("siteBlockBody");
  const button = $("siteBlockToggle");
  if (!body || !button) return;

  const expanded = body.classList.contains("is-expanded");
  button.textContent = chrome.i18n.getMessage(expanded ? "siteBlockShowLess" : "siteBlockShowMore");
  button.setAttribute("aria-expanded", String(expanded));
}

function getMessage(key, substitutions = []) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

function clearFeedbackTimer() {
  if (feedbackHideTimer) {
    window.clearTimeout(feedbackHideTimer);
    feedbackHideTimer = null;
  }
}

function hideFeedback() {
  clearFeedbackTimer();

  const toast = $("saveToast");
  if (!toast) return;

  toast.hidden = true;
  toast.removeAttribute("data-tone");
  $("saveToastTitle").textContent = "";
  $("saveToastMessage").textContent = "";
  const status = $("status");
  if (status) {
    status.textContent = "";
  }
}

function announceStatus(message) {
  const status = $("status");
  if (status) {
    status.textContent = message;
  }
}

function setActionButtonState(action, busy) {
  const config = ACTION_LABEL_KEYS[action];
  const button = $(`${action}Button`);
  const label = $(`${action}ButtonLabel`);
  if (!config || !button || !label) return;

  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  label.textContent = getMessage(busy ? config.busy : config.idle);
}

function setActionsBusy(action = null) {
  setActionButtonState("save", action === "save");
  setActionButtonState("reset", action === "reset");

  if (!action) {
    $("saveButton").disabled = false;
    $("resetButton").disabled = false;
    $("saveButton").classList.remove("is-loading");
    $("resetButton").classList.remove("is-loading");
    $("saveButtonLabel").textContent = getMessage(ACTION_LABEL_KEYS.save.idle);
    $("resetButtonLabel").textContent = getMessage(ACTION_LABEL_KEYS.reset.idle);
    return;
  }

  if (action === "save") {
    $("resetButton").disabled = true;
    $("resetButton").classList.remove("is-loading");
    $("resetButtonLabel").textContent = getMessage(ACTION_LABEL_KEYS.reset.idle);
  }

  if (action === "reset") {
    $("saveButton").disabled = true;
    $("saveButton").classList.remove("is-loading");
    $("saveButtonLabel").textContent = getMessage(ACTION_LABEL_KEYS.save.idle);
  }
}

function showFeedback({ tone, titleKey, message, duration = FEEDBACK_HIDE_DELAY_MS }) {
  const toast = $("saveToast");
  const title = $("saveToastTitle");
  const messageNode = $("saveToastMessage");
  if (!toast || !title || !messageNode) return;

  clearFeedbackTimer();
  toast.hidden = false;
  toast.dataset.tone = tone;
  title.textContent = getMessage(titleKey);
  messageNode.textContent = message;
  announceStatus(`${title.textContent}. ${messageNode.textContent}`.trim());
  feedbackHideTimer = window.setTimeout(() => {
    hideFeedback();
  }, duration);
}

function setStatus(message, isError = false) {
  const status = $("status");
  if (status) {
    status.textContent = message;
  }
  showFeedback({
    tone: isError ? "error" : "success",
    titleKey: isError ? "saveErrorToastTitle" : "savedToastTitle",
    message,
  });
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
  hideFeedback();
  setActionsBusy(null);
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

  $("extendedTimeDisplay").addEventListener("change", () => {
    updateExtendedTimeUI($("extendedTimeDisplay").checked);
  });

  $("socialAwarenessEnabled").addEventListener("change", () => {
    updateSocialAwarenessUI($("socialAwarenessEnabled").checked);
    ensureAllSocialSitesSelectedIfNeeded();
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
    ensureAllSocialSitesSelectedIfNeeded();
    hideFeedback();

    const payload = normalizeSettings({
      salaryAmount: $("salaryAmount").value,
      salaryCurrency: $("salaryCurrency").value,
      monthlyHours: $("monthlyHours").value,
      salaryPeriod: $("salaryPeriod").value,
      wageMode: $("wageMode").checked ? "hourly" : "monthly",
      hourlyRate: $("hourlyRate").value,
      timeDisplayMode: $("timeDisplayMode").value,
      extendedTimeDisplay: $("extendedTimeDisplay").checked,
      extendedTimeDayMode: $("extendedTimeDayMode").value,
      replacePricesWithHours: $("replacePricesWithHours").checked,
      showSalaryPercent: $("showSalaryPercent").checked,
      enableExternalSites: $("enableExternalSites").checked,
      disabledSiteNames: Array.from(document.querySelectorAll("[data-site-name]"))
        .filter((input) => !input.checked)
        .map((input) => input.getAttribute("data-site-name")),
      exchangeRateMode: $("exchangeRateMode").value,
      manualUsdToBrlRate: $("manualUsdToBrlRate").value,
      socialAwarenessEnabled: $("socialAwarenessEnabled").checked,
      socialAwarenessSites: getSelectedSocialSites(),
      socialPromptEnabled: $("socialPromptEnabled").checked,
      socialTrackingEnabled: $("socialTrackingEnabled").checked,
      socialReflectionEnabled: $("socialReflectionEnabled").checked,
      socialMonetaryOptIn: $("socialMonetaryOptIn").checked,
    });

    if (payload.exchangeRateMode === "manual" && payload.manualUsdToBrlRate <= 0) {
      setStatus(chrome.i18n.getMessage("manualRateRequired"), true);
      return;
    }

    if (payload.wageMode === "hourly" && payload.hourlyRate <= 0) {
      setStatus(chrome.i18n.getMessage("hourlyRateRequired"), true);
      return;
    }

    if (payload.socialAwarenessEnabled && payload.socialAwarenessSites.length === 0) {
      setStatus(chrome.i18n.getMessage("socialAwarenessSiteRequired"), true);
      return;
    }

    setActionsBusy("save");

    showFeedback({
      titleKey: "savingToastTitle",
      message: chrome.i18n.getMessage("savingToastMessage"),
    });

    try {
      await saveSettings(payload);

      let feedback = {
        tone: "success",
        titleKey: "savedToastTitle",
        message: chrome.i18n.getMessage("savedMessage"),
      };

      if (payload.exchangeRateMode === "auto") {
        const response = await refreshExchangeRate();
        if (!response?.ok) {
          feedback = {
            tone: "warning",
            titleKey: "savedWithExchangeWarningTitle",
            message: chrome.i18n.getMessage("savedWithExchangeWarning"),
          };
        }
      }

      const nextSettings = await readSettings();
      fillForm(nextSettings);
      updateHourlyRateCurrencyPrefix();
      updateRateSnapshot(nextSettings);
      updateSiteBlockToggle();
      showFeedback(feedback);
    } catch (error) {
      console.error("Failed to save AceitaTempo settings:", error);
      showFeedback({
        tone: "error",
        titleKey: "saveErrorToastTitle",
        message: chrome.i18n.getMessage("saveErrorToastMessage"),
      });
    } finally {
      setActionsBusy(null);
    }
  });

  $("resetButton").addEventListener("click", () => {
    $("resetConfirmModal").showModal();
  });

  $("cancelResetButton").addEventListener("click", () => {
    $("resetConfirmModal").close();
  });

  $("confirmResetButton").addEventListener("click", async () => {
    $("resetConfirmModal").close();
    hideFeedback();
    
    showFeedback({
      titleKey: "restoringToastTitle",
      message: chrome.i18n.getMessage("restoringToastMessage"),
    });
    setActionsBusy("reset");

    try {
      await saveSettings(DEFAULT_SETTINGS);
      fillForm(DEFAULT_SETTINGS);
      updateHourlyRateCurrencyPrefix();
      updateRateSnapshot(DEFAULT_SETTINGS);
      updateSiteBlockToggle();
      showFeedback({
        tone: "success",
        titleKey: "resetToastTitle",
        message: chrome.i18n.getMessage("resetMessage"),
      });
    } catch (error) {
      console.error("Failed to restore AceitaTempo defaults:", error);
      showFeedback({
        tone: "error",
        titleKey: "saveErrorToastTitle",
        message: chrome.i18n.getMessage("saveErrorToastMessage"),
      });
    } finally {
      setActionsBusy(null);
    }
  });
}

init();
