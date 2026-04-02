(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  const PriceUtils = globalObj.AceitaTempoPriceUtils;

  if (!PriceUtils || globalObj.AceitaTempoSocialAwareness) {
    return;
  }

  const STYLE_ID = 'aceita-tempo-social-style';
  const ROOT_ID = 'aceita-tempo-social-root';
  const LOCAL_SESSION_KEY = 'aceitaTempoSocialSession';
  const LOCAL_PENDING_KEY = 'aceitaTempoSocialPendingReflection';
  const DEFAULT_SITES = ['instagram', 'youtube', 'youtube-shorts', 'tiktok'];
  const MIN_REFLECTION_ACTIVE_MS = 90 * 1000;
  const DEFAULT_RUNTIME = {
    firstPromptMinDelayMs: 1 * 60 * 1000,
    firstPromptMaxDelayMs: 3 * 60 * 1000,
    followupPromptMinDelayMs: 3 * 60 * 1000,
    followupPromptMaxDelayMs: 7 * 60 * 1000,
    inactivityMs: 20 * 1000,
    tickMs: 1000,
    resumeWindowMs: 5 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    persistEveryMs: 5 * 1000,
  };
  const FALLBACK_MESSAGES = {
    'pt-BR': {
      socialPromptTitleInitial: 'Check-in discreto',
      socialPromptTitleInterim: 'Ainda está valendo?',
      socialPromptBodyInitial: 'Este uso está alinhado com o que você queria fazer aqui?',
      socialPromptBodyInterim: 'Sua sessão ainda está alinhada com o que você abriu para fazer?',
      socialPromptGoalLabel: 'Anotação opcional',
      socialPromptGoalPlaceholder: 'Ex.: ver um vídeo específico, responder alguém, relaxar',
      socialPromptYes: 'Sim, está alinhado',
      socialPromptNo: 'Não muito',
      socialPromptDismiss: 'Descartar',
      socialReflectionTitle: 'Antes de começar de novo',
      socialReflectionBody: 'Na última sessão no $1, você ficou $2 em tempo ativo. Isso ficou alinhado com o que queria fazer?',
      socialSummaryTitle: 'Resumo da sessão',
      socialSummaryBody: 'Tempo ativo nesta sessão: $1 no $2.',
      socialSummaryResponse: 'Na revisão final, você marcou: $1.',
      socialSummaryGoal: 'Anotação inicial: $1',
      socialSummaryMoney: 'Conversão aproximada pela sua referência atual: $1.',
      socialSummaryClose: 'Entendi',
    },
    en: {
      socialPromptTitleInitial: 'Quick check-in',
      socialPromptTitleInterim: 'Still on track?',
      socialPromptBodyInitial: 'Is this session aligned with what you wanted to do here?',
      socialPromptBodyInterim: 'Is this session still aligned with what you opened the site to do?',
      socialPromptGoalLabel: 'Optional note',
      socialPromptGoalPlaceholder: 'e.g. watch one specific video, reply to someone, relax',
      socialPromptYes: 'Yes, still aligned',
      socialPromptNo: 'Not really',
      socialPromptDismiss: 'Dismiss',
      socialReflectionTitle: 'Before you start again',
      socialReflectionBody: 'On your last session on $1, you spent $2 of active time. Did that stay aligned with what you wanted to do?',
      socialSummaryTitle: 'Session summary',
      socialSummaryBody: 'Active time in this session: $1 on $2.',
      socialSummaryResponse: 'In the final check-in, you chose: $1.',
      socialSummaryGoal: 'Initial note: $1',
      socialSummaryMoney: 'Approximate value at your current hourly reference: $1.',
      socialSummaryClose: 'Got it',
    },
  };

  function localArea() {
    try {
      return chrome.storage?.local ?? chrome.storage?.sync ?? null;
    } catch {
      return null;
    }
  }

  function readLocal(keys) {
    const area = localArea();
    if (!area) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      try {
        area.get(keys, (items) => resolve(items || {}));
      } catch {
        resolve({});
      }
    });
  }

  function writeLocal(values) {
    const area = localArea();
    if (!area) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        area.set(values, resolve);
      } catch {
        resolve();
      }
    });
  }

  function removeLocal(keys) {
    const area = localArea();
    if (!area) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        area.remove(keys, resolve);
      } catch {
        resolve();
      }
    });
  }

  function normalizeLocale(locale) {
    return /^pt/i.test(locale || '') ? 'pt-BR' : 'en';
  }

  function getMessage(locale, key, substitutions = []) {
    try {
      const chromeMessage = chrome.i18n?.getMessage?.(key, substitutions);
      if (chromeMessage) {
        return chromeMessage;
      }
    } catch {
      // ignore
    }

    const normalizedLocale = normalizeLocale(locale);
    const template = FALLBACK_MESSAGES[normalizedLocale]?.[key] ?? FALLBACK_MESSAGES.en[key] ?? key;
    return substitutions.reduce(
      (text, value, index) => text.replace(new RegExp(`\\$${index + 1}`, 'g'), String(value)),
      template
    );
  }

  function runtimeConfig() {
    const overrides = globalObj.__ACEITA_TEMPO_SOCIAL_TEST_OVERRIDES__ || {};
    const config = { ...DEFAULT_RUNTIME };

    Object.keys(config).forEach((key) => {
      const numeric = Number(overrides[key]);
      if (Number.isFinite(numeric) && numeric > 0) {
        config[key] = numeric;
      }
    });

    return config;
  }

  function isTruthySetting(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function normalizeSites(rawSites) {
    const values = Array.isArray(rawSites) ? rawSites : DEFAULT_SITES;
    const normalized = values.map((value) => String(value || '').toLowerCase()).filter(Boolean);
    return normalized.length ? [...new Set(normalized)] : [...DEFAULT_SITES];
  }

  function shouldTrackSite(settings, siteConfig) {
    if (!siteConfig || siteConfig.kind !== 'social') {
      return false;
    }

    if (!isTruthySetting(settings?.socialAwarenessEnabled)) {
      return false;
    }

    if (!isTruthySetting(settings?.socialTrackingEnabled ?? true)) {
      return false;
    }

    return normalizeSites(settings?.socialAwarenessSites).includes(siteConfig.siteId);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        display: grid;
        gap: 12px;
        width: min(360px, calc(100vw - 24px));
        pointer-events: none;
      }

      .aceita-tempo-social__toast {
        pointer-events: auto;
        display: grid;
        gap: 12px;
        padding: 18px;
        border-radius: 22px;
        border: 1px solid rgba(30, 26, 23, 0.12);
        background: rgba(255, 255, 255, 0.94);
        color: #1e1a17;
        box-shadow: 0 22px 48px rgba(53, 38, 25, 0.16);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        font: 600 13px/1.5 Aptos, "Segoe UI Variable Display", "Trebuchet MS", sans-serif;
        box-sizing: border-box;
      }

      .aceita-tempo-social__toast * {
        box-sizing: border-box;
      }

      .aceita-tempo-social__eyebrow {
        margin: 0;
        color: #0f766e;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .aceita-tempo-social__title {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-size: 21px;
        line-height: 1.05;
        letter-spacing: -0.03em;
      }

      .aceita-tempo-social__body,
      .aceita-tempo-social__meta {
        margin: 0;
        color: #6b625a;
      }

      .aceita-tempo-social__label {
        display: grid;
        gap: 6px;
        min-width: 0;
        font-size: 12px;
        font-weight: 700;
        color: #1e1a17;
      }

      .aceita-tempo-social__input {
        display: block;
        min-width: 0;
        width: 100%;
        max-width: 100%;
        border: 1px solid rgba(30, 26, 23, 0.14);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.9);
        color: #1e1a17;
        font: inherit;
        transition: border-color 150ms ease, box-shadow 150ms ease;
      }

      .aceita-tempo-social__input:focus {
        outline: none;
        border-color: rgba(15, 118, 110, 0.55);
        box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.14);
      }

      .aceita-tempo-social__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .aceita-tempo-social__button {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
      }

      .aceita-tempo-social__button--primary {
        background: linear-gradient(135deg, #0f766e, #115e59);
        color: #fff;
      }

      .aceita-tempo-social__button--secondary {
        background: rgba(15, 118, 110, 0.08);
        color: #115e59;
      }

      .aceita-tempo-social__button--ghost {
        background: rgba(30, 26, 23, 0.06);
        color: #6b625a;
      }

      @media (max-width: 720px) {
        #${ROOT_ID} {
          left: 12px;
          right: 12px;
          bottom: 12px;
          width: auto;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function getRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) {
      return root;
    }

    root = document.createElement('div');
    root.id = ROOT_ID;
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function removeRoot() {
    document.getElementById(ROOT_ID)?.remove();
  }

  function playingVideoDetected() {
    return [...document.querySelectorAll('video')].some((video) => {
      try {
        return !video.paused && !video.ended && video.readyState >= 2;
      } catch {
        return false;
      }
    });
  }

  function clampPositive(number, fallback = 0) {
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function normalizeTimestamp(value, fallback = 0) {
    if (typeof value === 'number') {
      return clampPositive(value, fallback);
    }

    const parsed = Date.parse(value || '');
    return clampPositive(parsed, fallback);
  }

  function buildPendingReflection(session, queuedAt = Date.now()) {
    return {
      siteId: session.siteId,
      siteName: session.siteName,
      startedAt: session.startedAt,
      endedAt: queuedAt,
      activeMs: session.activeMs || 0,
      goalNote: session.goalNote || '',
      initialResponse: session.initialResponse || null,
      interimResponse: session.interimResponse || null,
      queuedAt,
    };
  }

  function formatActiveDuration(activeMs, locale, settings) {
    return PriceUtils.formatDurationLong(Math.max(1, Math.round(activeMs / 60000)), locale, settings);
  }

  function shouldIgnoreReflection(activeMs) {
    return clampPositive(Number(activeMs), 0) < MIN_REFLECTION_ACTIVE_MS;
  }

  function randomBetween(min, max) {
    const safeMin = clampPositive(Math.min(min, max), 0);
    const safeMax = clampPositive(Math.max(min, max), safeMin);
    if (safeMax <= safeMin) {
      return safeMin;
    }

    return Math.round(safeMin + (Math.random() * (safeMax - safeMin)));
  }

  function getPromptResponseLabel(locale, response) {
    if (response === 'yes') {
      return getMessage(locale, 'socialPromptYes');
    }

    if (response === 'no') {
      return getMessage(locale, 'socialPromptNo');
    }

    if (response === 'dismissed') {
      return getMessage(locale, 'socialPromptDismiss');
    }

    return '';
  }

  function createController({ siteConfig, settings, locale }) {
    const config = runtimeConfig();
    const state = {
      destroyed: false,
      lastTickAt: Date.now(),
      lastInteractionAt: Date.now(),
      lastPersistAt: 0,
      session: null,
      pendingReflection: null,
      currentToast: null,
      listeners: [],
      tickId: null,
    };

    function registerListener(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options);
      state.listeners.push(() => target.removeEventListener(eventName, handler, options));
    }

    function closeCurrentToast() {
      state.currentToast?.remove();
      state.currentToast = null;
    }

    function createToastShell(eyebrow, title, body) {
      ensureStyle();
      const toast = document.createElement('section');
      toast.className = 'aceita-tempo-social__toast';

      const eyebrowNode = document.createElement('p');
      eyebrowNode.className = 'aceita-tempo-social__eyebrow';
      eyebrowNode.textContent = eyebrow;
      toast.appendChild(eyebrowNode);

      const titleNode = document.createElement('h2');
      titleNode.className = 'aceita-tempo-social__title';
      titleNode.textContent = title;
      toast.appendChild(titleNode);

      const bodyNode = document.createElement('p');
      bodyNode.className = 'aceita-tempo-social__body';
      bodyNode.textContent = body;
      toast.appendChild(bodyNode);

      return toast;
    }

    function showToast(toast) {
      closeCurrentToast();
      const root = getRoot();
      root.replaceChildren(toast);
      state.currentToast = toast;
    }

    async function persistSession(force = false) {
      if (!state.session) {
        return;
      }

      const now = Date.now();
      if (!force && now - state.lastPersistAt < config.persistEveryMs) {
        return;
      }

      state.lastPersistAt = now;
      await writeLocal({ [LOCAL_SESSION_KEY]: state.session });
    }

    function finalizeOpenInterval(now) {
      if (!state.session?.currentIntervalStartAt) {
        return;
      }

      state.session.activeIntervals.push({
        startAt: state.session.currentIntervalStartAt,
        endAt: now,
      });
      state.session.currentIntervalStartAt = null;
    }

    function ensureOpenInterval(now) {
      if (!state.session || state.session.currentIntervalStartAt) {
        return;
      }

      state.session.currentIntervalStartAt = now;
    }

    function isActive(now) {
      if (document.visibilityState !== 'visible') {
        return false;
      }

      return true;
    }

    function recordInteraction() {
      state.lastInteractionAt = Date.now();
      if (state.session) {
        state.session.lastActivityAt = state.lastInteractionAt;
      }
    }

    function randomFollowupDelayMs() {
      return randomBetween(config.followupPromptMinDelayMs, config.followupPromptMaxDelayMs);
    }

    function randomFirstPromptDelayMs() {
      return randomBetween(config.firstPromptMinDelayMs, config.firstPromptMaxDelayMs);
    }

    function normalizePromptSchedule(session) {
      if (!session) {
        return;
      }

      const promptCount = clampPositive(Number(session.promptCount), 0);
      session.promptCount = promptCount;

      const nextPromptAtActiveMs = clampPositive(Number(session.nextPromptAtActiveMs), 0);
      if (nextPromptAtActiveMs > 0) {
        session.nextPromptAtActiveMs = nextPromptAtActiveMs;
        return;
      }

      if (promptCount > 0 || session.initialPromptShownAt) {
        session.nextPromptAtActiveMs = (session.activeMs || 0) + randomFollowupDelayMs();
        return;
      }

      session.nextPromptAtActiveMs = randomFirstPromptDelayMs();
    }

    function scheduleNextPrompt(session, promptKind) {
      if (!session) {
        return;
      }

      if (promptKind === 'initial') {
        session.promptCount = 1;
      } else {
        session.promptCount = clampPositive(Number(session.promptCount), 1) + 1;
      }

      session.nextPromptAtActiveMs = (session.activeMs || 0) + randomFollowupDelayMs();
    }

    async function queuePendingReflectionFromSession(session) {
      if (
        !session
        || !session.activeMs
        || shouldIgnoreReflection(session.activeMs)
        || !isTruthySetting(settings?.socialReflectionEnabled ?? true)
      ) {
        await removeLocal([LOCAL_SESSION_KEY, LOCAL_PENDING_KEY]);
        return;
      }

      state.pendingReflection = buildPendingReflection(session);
      await writeLocal({
        [LOCAL_PENDING_KEY]: state.pendingReflection,
      });
      await removeLocal([LOCAL_SESSION_KEY]);
    }

    function showSummaryToast(reflection, options = {}) {
      const durationText = formatActiveDuration(reflection.activeMs, locale, settings);
      const toast = createToastShell(
        siteConfig.name,
        getMessage(locale, 'socialSummaryTitle'),
        getMessage(locale, 'socialSummaryBody', [durationText, reflection.siteName || siteConfig.name])
      );

      const finalResponseLabel = getPromptResponseLabel(locale, options.finalResponse);
      if (finalResponseLabel) {
        const responseNode = document.createElement('p');
        responseNode.className = 'aceita-tempo-social__meta';
        responseNode.textContent = getMessage(locale, 'socialSummaryResponse', [finalResponseLabel]);
        toast.appendChild(responseNode);
      }

      if (reflection.goalNote) {
        const goalNode = document.createElement('p');
        goalNode.className = 'aceita-tempo-social__meta';
        goalNode.textContent = getMessage(locale, 'socialSummaryGoal', [reflection.goalNote]);
        toast.appendChild(goalNode);
      }

      if (isTruthySetting(settings?.socialMonetaryOptIn)) {
        const estimate = PriceUtils.calculateApproximateValueForMinutes(reflection.activeMs / 60000, settings, true);
        if (estimate) {
          const moneyNode = document.createElement('p');
          moneyNode.className = 'aceita-tempo-social__meta';
          moneyNode.textContent = getMessage(locale, 'socialSummaryMoney', [
            PriceUtils.formatCurrency(estimate.amount, estimate.currency, locale),
          ]);
          toast.appendChild(moneyNode);
        }
      }

      const actions = document.createElement('div');
      actions.className = 'aceita-tempo-social__actions';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--primary';
      closeButton.textContent = getMessage(locale, 'socialSummaryClose');
      closeButton.addEventListener('click', async () => {
        state.pendingReflection = null;
        closeCurrentToast();
        await removeLocal([LOCAL_PENDING_KEY]);
        maybeShowPrompts();
      });

      actions.appendChild(closeButton);
      toast.appendChild(actions);
      showToast(toast);
    }

    function showReflectionToast(reflection) {
      if (!reflection || state.currentToast || !isTruthySetting(settings?.socialReflectionEnabled ?? true)) {
        return;
      }

      const durationText = formatActiveDuration(reflection.activeMs, locale, settings);
      const toast = createToastShell(
        reflection.siteName || siteConfig.name,
        getMessage(locale, 'socialReflectionTitle'),
        getMessage(locale, 'socialReflectionBody', [reflection.siteName || siteConfig.name, durationText])
      );

      const actions = document.createElement('div');
      actions.className = 'aceita-tempo-social__actions';

      const yesButton = document.createElement('button');
      yesButton.type = 'button';
      yesButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--secondary';
      yesButton.textContent = getMessage(locale, 'socialPromptYes');
      yesButton.addEventListener('click', async () => {
        state.pendingReflection = null;
        closeCurrentToast();
        await removeLocal([LOCAL_PENDING_KEY]);
        maybeShowPrompts();
      });

      const noButton = document.createElement('button');
      noButton.type = 'button';
      noButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--primary';
      noButton.textContent = getMessage(locale, 'socialPromptNo');
      noButton.addEventListener('click', async () => {
        closeCurrentToast();
        showSummaryToast(reflection, { finalResponse: 'no' });
      });

      const dismissButton = document.createElement('button');
      dismissButton.type = 'button';
      dismissButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--ghost';
      dismissButton.textContent = getMessage(locale, 'socialPromptDismiss');
      dismissButton.addEventListener('click', async () => {
        state.pendingReflection = null;
        closeCurrentToast();
        await removeLocal([LOCAL_PENDING_KEY]);
        maybeShowPrompts();
      });

      actions.append(yesButton, noButton, dismissButton);
      toast.appendChild(actions);
      showToast(toast);
    }

    function showPrompt(kind) {
      if (!state.session || state.currentToast || !isTruthySetting(settings?.socialPromptEnabled ?? true)) {
        return;
      }

      const isInitial = kind === 'initial';
      const toast = createToastShell(
        siteConfig.name,
        getMessage(locale, isInitial ? 'socialPromptTitleInitial' : 'socialPromptTitleInterim'),
        getMessage(locale, isInitial ? 'socialPromptBodyInitial' : 'socialPromptBodyInterim')
      );

      let goalInput = null;
      if (isInitial || !state.session.goalNote) {
        const label = document.createElement('label');
        label.className = 'aceita-tempo-social__label';
        label.textContent = getMessage(locale, 'socialPromptGoalLabel');

        goalInput = document.createElement('input');
        goalInput.type = 'text';
        goalInput.className = 'aceita-tempo-social__input';
        goalInput.placeholder = getMessage(locale, 'socialPromptGoalPlaceholder');
        goalInput.value = state.session.goalNote || '';
        label.appendChild(goalInput);
        toast.appendChild(label);
      }

      const actions = document.createElement('div');
      actions.className = 'aceita-tempo-social__actions';

      const applyResponse = async (response) => {
        if (!state.session) {
          return;
        }

        const noteValue = goalInput ? goalInput.value.trim().slice(0, 120) : '';
        if (noteValue) {
          state.session.goalNote = noteValue;
        }

        if (isInitial) {
          state.session.initialPromptShownAt = Date.now();
          state.session.initialResponse = response;
        } else {
          state.session.interimPromptShownAt = Date.now();
          state.session.interimResponse = response;
        }
        scheduleNextPrompt(state.session, isInitial ? 'initial' : 'interim');

        closeCurrentToast();
        await persistSession(true);
      };

      const yesButton = document.createElement('button');
      yesButton.type = 'button';
      yesButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--secondary';
      yesButton.textContent = getMessage(locale, 'socialPromptYes');
      yesButton.addEventListener('click', () => {
        applyResponse('yes');
      });

      const noButton = document.createElement('button');
      noButton.type = 'button';
      noButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--primary';
      noButton.textContent = getMessage(locale, 'socialPromptNo');
      noButton.addEventListener('click', () => {
        applyResponse('no');
      });

      const dismissButton = document.createElement('button');
      dismissButton.type = 'button';
      dismissButton.className = 'aceita-tempo-social__button aceita-tempo-social__button--ghost';
      dismissButton.textContent = getMessage(locale, 'socialPromptDismiss');
      dismissButton.addEventListener('click', async () => {
        if (isInitial) {
          state.session.initialPromptShownAt = Date.now();
          state.session.initialResponse = 'dismissed';
        } else {
          state.session.interimPromptShownAt = Date.now();
          state.session.interimResponse = 'dismissed';
        }
        scheduleNextPrompt(state.session, isInitial ? 'initial' : 'interim');
        closeCurrentToast();
        await persistSession(true);
      });

      actions.append(yesButton, noButton, dismissButton);
      toast.appendChild(actions);
      showToast(toast);
    }

    function maybeShowPrompts() {
      if (!state.session || state.pendingReflection || state.currentToast) {
        return;
      }

      if (!isTruthySetting(settings?.socialPromptEnabled ?? true)) {
        return;
      }

      normalizePromptSchedule(state.session);
      if (state.session.activeMs >= state.session.nextPromptAtActiveMs) {
        showPrompt(state.session.promptCount > 0 ? 'interim' : 'initial');
      }
    }

    async function cleanupExistingState() {
      const storage = await readLocal([LOCAL_SESSION_KEY, LOCAL_PENDING_KEY]);
      const storedSession = storage[LOCAL_SESSION_KEY];
      const storedPending = storage[LOCAL_PENDING_KEY];
      const now = Date.now();

      const pendingReferenceTime = normalizeTimestamp(storedPending?.queuedAt || storedPending?.endedAt, now);

      if (storedPending && pendingReferenceTime && (now - pendingReferenceTime) > config.staleMs) {
        await removeLocal([LOCAL_PENDING_KEY]);
      } else if (storedPending && !shouldIgnoreReflection(storedPending.activeMs)) {
        state.pendingReflection = storedPending;
      } else if (storedPending) {
        await removeLocal([LOCAL_PENDING_KEY]);
      }

      if (!storedSession) {
        return;
      }

      const referenceTime = normalizeTimestamp(
        storedSession.suspendedAt || storedSession.lastActivityAt || storedSession.startedAt,
        now
      );

      const canResume = storedSession.siteId === siteConfig.siteId && (now - referenceTime) <= config.resumeWindowMs;
      const isStale = (now - referenceTime) > config.staleMs;

      if (canResume) {
        state.session = storedSession;
        normalizePromptSchedule(state.session);
        state.session.suspendedAt = null;
        state.session.lastActivityAt = new Date(now).toISOString();
        state.lastInteractionAt = now;
        return;
      }

      if (
        !isStale
        && storedSession.activeMs > 0
        && !shouldIgnoreReflection(storedSession.activeMs)
        && isTruthySetting(settings?.socialReflectionEnabled ?? true)
      ) {
        state.pendingReflection = buildPendingReflection(storedSession, now);
        await writeLocal({ [LOCAL_PENDING_KEY]: state.pendingReflection });
      }

      await removeLocal([LOCAL_SESSION_KEY]);
    }

    function startFreshSession() {
      const now = Date.now();
      state.session = {
        siteId: siteConfig.siteId,
        siteName: siteConfig.name,
        startedAt: new Date(now).toISOString(),
        lastActivityAt: new Date(now).toISOString(),
        suspendedAt: null,
        activeMs: 0,
        activeIntervals: [],
        currentIntervalStartAt: null,
        goalNote: '',
        initialPromptShownAt: null,
        initialResponse: null,
        promptCount: 0,
        nextPromptAtActiveMs: randomFirstPromptDelayMs(),
        interimPromptShownAt: null,
        interimResponse: null,
      };
      state.lastInteractionAt = now;
    }

    async function start() {
      if (state.destroyed) {
        return;
      }

      await cleanupExistingState();
      if (!state.session) {
        startFreshSession();
        await persistSession(true);
      }

      if (state.pendingReflection) {
        showReflectionToast(state.pendingReflection);
      }

      const activityEvents = ['pointerdown', 'mousemove', 'keydown', 'scroll', 'focus', 'touchstart'];
      activityEvents.forEach((eventName) => {
        registerListener(window, eventName, recordInteraction, { passive: true });
      });
      registerListener(document, 'visibilitychange', async () => {
        if (document.visibilityState === 'hidden') {
          finalizeOpenInterval(Date.now());
          if (state.session) {
            state.session.suspendedAt = new Date().toISOString();
            await persistSession(true);
          }
        } else {
          recordInteraction();
        }
      });
      registerListener(window, 'pagehide', () => {
        finalizeOpenInterval(Date.now());
        if (state.session) {
          state.session.suspendedAt = new Date().toISOString();
        }
        persistSession(true);
      });

      maybeShowPrompts();

      state.tickId = window.setInterval(async () => {
        if (!state.session || state.destroyed) {
          return;
        }

        const now = Date.now();
        const delta = Math.min(Math.max(now - state.lastTickAt, 0), config.tickMs * 2);
        state.lastTickAt = now;

        if (isActive(now)) {
          ensureOpenInterval(now);
          state.session.activeMs += delta;
          state.session.lastActivityAt = new Date(now).toISOString();
        } else {
          finalizeOpenInterval(now);
        }

        maybeShowPrompts();
        await persistSession();
      }, config.tickMs);
    }

    async function stop(options = {}) {
      state.destroyed = true;
      if (state.tickId) {
        window.clearInterval(state.tickId);
        state.tickId = null;
      }

      finalizeOpenInterval(Date.now());
      state.listeners.splice(0).forEach((dispose) => dispose());
      closeCurrentToast();

      if (options.clearLocalState) {
        await removeLocal([LOCAL_SESSION_KEY, LOCAL_PENDING_KEY]);
      } else if (state.session) {
        state.session.suspendedAt = new Date().toISOString();
        await persistSession(true);
      }

      removeRoot();
    }

    function getStatus() {
      if (!state.session) {
        return {
          kind: 'social',
          siteId: siteConfig.siteId,
          siteName: siteConfig.name,
          activeMs: 0,
          tracking: false,
        };
      }

      return {
        kind: 'social',
        siteId: siteConfig.siteId,
        siteName: state.session.siteName || siteConfig.name,
        activeMs: clampPositive(Number(state.session.activeMs), 0),
        tracking: true,
      };
    }

    return { start, stop, getStatus };
  }

  globalObj.AceitaTempoSocialAwareness = {
    shouldTrackSite,
    createController,
  };
})();
