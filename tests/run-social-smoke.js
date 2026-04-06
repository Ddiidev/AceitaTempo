const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const SCRIPT_FILES = [
  path.join(ROOT, 'src', 'price-utils.js'),
  path.join(ROOT, 'src', 'site-config.js'),
  path.join(ROOT, 'src', 'social-awareness.js'),
  path.join(ROOT, 'src', 'content.js'),
];

const SOCIAL_FIXTURE_HTML = `<!doctype html>
<html lang="en-US">
  <body>
    <main>
      <h1>Feed</h1>
      <article>Clip one</article>
      <article>Clip two</article>
      <article>Clip three</article>
    </main>
  </body>
</html>`;

function loadMessages(localeFolder = 'en') {
  const file = path.join(ROOT, '_locales', localeFolder, 'messages.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stripScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

async function installChromeStub(page, {
  syncSettings = {},
  localState = {},
  messages = loadMessages('en'),
  uiLanguage = 'en-US',
  activeTab = null,
  tabMessageResponse = null,
  tabMessageResponseStepMs = 0,
  storageSetDelayMs = 0,
  runtimeSendMessageDelayMs = 0,
} = {}) {
  await page.evaluate(({ syncSettings, localState, messages, uiLanguage, activeTab, tabMessageResponse, tabMessageResponseStepMs, storageSetDelayMs, runtimeSendMessageDelayMs }) => {
    const storageState = {
      sync: { ...syncSettings },
      local: { ...localState },
    };
    let tabMessageCallCount = 0;

    function replacePlaceholders(template, substitutions = []) {
      return substitutions.reduce(
        (text, value, index) => text.replace(new RegExp(`\\$${index + 1}`, 'g'), String(value)),
        template
      );
    }

    function createArea(areaName) {
      return {
        get(keys, callback) {
          const source = storageState[areaName];
          if (keys == null) {
            callback({ ...source });
            return;
          }

          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, source[key]])));
            return;
          }

          if (typeof keys === 'string') {
            callback({ [keys]: source[keys] });
            return;
          }

          const response = { ...keys };
          Object.keys(keys).forEach((key) => {
            if (source[key] !== undefined) {
              response[key] = source[key];
            }
          });
          callback(response);
        },
        set(values, callback) {
          const applyValues = () => {
            Object.assign(storageState[areaName], values || {});
            callback?.();
          };

          if (Number.isFinite(storageSetDelayMs) && storageSetDelayMs > 0) {
            setTimeout(applyValues, storageSetDelayMs);
            return;
          }

          applyValues();
        },
        remove(keys, callback) {
          const entries = Array.isArray(keys) ? keys : [keys];
          entries.forEach((key) => {
            delete storageState[areaName][key];
          });
          callback?.();
        },
      };
    }

    window.__aceitaTempoTestStorage = storageState;
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        storage: {
          sync: createArea('sync'),
          local: createArea('local'),
          onChanged: {
            addListener: () => {},
          },
        },
        runtime: {
          lastError: null,
          sendMessage: (_message, callback) => {
            const respond = () => callback?.({ ok: true });
            if (Number.isFinite(runtimeSendMessageDelayMs) && runtimeSendMessageDelayMs > 0) {
              setTimeout(respond, runtimeSendMessageDelayMs);
              return;
            }

            respond();
          },
          openOptionsPage: async () => {},
        },
        tabs: {
          query: (_queryInfo, callback) => callback(activeTab ? [activeTab] : []),
          sendMessage: (_tabId, _message, callback) => {
            let response = tabMessageResponse;
            if (response && typeof response === 'object' && Number.isFinite(tabMessageResponseStepMs) && tabMessageResponseStepMs > 0) {
              response = {
                ...response,
                activeMs: Number(response.activeMs || 0) + (tabMessageCallCount * tabMessageResponseStepMs),
              };
            }
            tabMessageCallCount += 1;
            callback?.(response);
          },
        },
        i18n: {
          getUILanguage: () => uiLanguage.replace('-', '_'),
          getMessage: (key, substitutions = []) => {
            const template = messages[key]?.message || '';
            return replacePlaceholders(template, Array.isArray(substitutions) ? substitutions : [substitutions]);
          },
        },
      },
    });
  }, {
    syncSettings,
    localState,
    messages,
    uiLanguage,
    activeTab,
    tabMessageResponse,
    tabMessageResponseStepMs,
    storageSetDelayMs,
    runtimeSendMessageDelayMs,
  });
}

async function injectContentScripts(page) {
  for (const file of SCRIPT_FILES) {
    await page.addScriptTag({ content: fs.readFileSync(file, 'utf8') });
  }
}

async function openSocialFixture(page, url, overrides, chromeStubOptions) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: SOCIAL_FIXTURE_HTML,
    });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((nextOverrides) => {
    window.__ACEITA_TEMPO_SOCIAL_TEST_OVERRIDES__ = nextOverrides;
  }, overrides);
  await installChromeStub(page, chromeStubOptions);
  await injectContentScripts(page);
}

async function readActiveMs(page) {
  return page.evaluate(() => window.__aceitaTempoTestStorage?.local?.aceitaTempoSocialSession?.activeMs || 0);
}

async function clickToastButton(page, label) {
  await page.waitForFunction((buttonLabel) => {
    return [...document.querySelectorAll('.aceita-tempo-social__button')]
      .some((button) => button.textContent.trim().includes(buttonLabel));
  }, label);

  await page.evaluate((buttonLabel) => {
    const button = [...document.querySelectorAll('.aceita-tempo-social__button')]
      .find((candidate) => candidate.textContent.trim().includes(buttonLabel));
    button?.click();
  }, label);
}

async function runContentAssertions(browser) {
  const overrides = {
    firstPromptMinDelayMs: 700,
    firstPromptMaxDelayMs: 700,
    followupPromptMinDelayMs: 1600,
    followupPromptMaxDelayMs: 1600,
    inactivityMs: 500,
    tickMs: 120,
    persistEveryMs: 120,
    resumeWindowMs: 250,
  };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await openSocialFixture(page, 'https://www.youtube.com/', overrides, {
    syncSettings: {
      socialAwarenessEnabled: false,
      socialAwarenessSites: ['youtube', 'youtube-shorts'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
      salaryAmount: 5000,
      monthlyHours: 160,
      salaryCurrency: 'BRL',
    },
  });
  await page.waitForTimeout(900);
  assert.strictEqual(await page.locator('#aceita-tempo-social-root').count(), 0, 'disabled social feature should not render toast UI');
  assert.strictEqual(await page.locator('[data-aceita-tempo-badge="1"]').count(), 0, 'social sites must not render price badges');

  await page.close();

  const enabledPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(enabledPage, 'https://www.youtube.com/', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['youtube'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
      salaryAmount: 5000,
      monthlyHours: 160,
      salaryCurrency: 'BRL',
    },
  });

  await enabledPage.waitForTimeout(300);
  assert.strictEqual(await enabledPage.locator('.aceita-tempo-social__toast').count(), 0, 'the first social prompt should wait for the configured initial delay before appearing');
  await enabledPage.waitForSelector('.aceita-tempo-social__input');
  const promptLayout = await enabledPage.evaluate(() => {
    const toast = document.querySelector('.aceita-tempo-social__toast');
    const input = document.querySelector('.aceita-tempo-social__input');
    if (!toast || !input) {
      return null;
    }

    const toastRect = toast.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    return {
      toastRight: toastRect.right,
      inputRight: inputRect.right,
      toastLeft: toastRect.left,
      inputLeft: inputRect.left,
    };
  });
  assert.ok(promptLayout, 'initial social prompt should render the optional note input immediately');
  assert.ok(
    promptLayout.inputRight <= promptLayout.toastRight + 1 && promptLayout.inputLeft >= promptLayout.toastLeft - 1,
    `optional note input must stay inside the toast bounds (left=${promptLayout.inputLeft}/${promptLayout.toastLeft}, right=${promptLayout.inputRight}/${promptLayout.toastRight})`
  );

  await clickToastButton(enabledPage, 'Yes, still aligned');
  assert.strictEqual(await enabledPage.locator('[data-aceita-tempo-badge="1"]').count(), 0, 'social pages must not reuse commerce badges');

  const activeAfterPrompt = await readActiveMs(enabledPage);
  await enabledPage.waitForTimeout(900);
  const activeAfterIdle = await readActiveMs(enabledPage);
  assert.ok(
    activeAfterIdle > activeAfterPrompt,
    `visible social tabs should keep accumulating time while the session stays open (delta=${activeAfterIdle - activeAfterPrompt})`
  );
  assert.strictEqual(await enabledPage.locator('.aceita-tempo-social__toast').count(), 0, 'follow-up check-ins should not reopen before the random 3-7 minute window');

  await enabledPage.waitForTimeout(1000);
  const activeAfterResume = await readActiveMs(enabledPage);
  assert.ok(activeAfterResume > activeAfterIdle, 'active timer should keep growing while the tab remains visible before the follow-up prompt');

  await clickToastButton(enabledPage, 'Yes, still aligned');
  await enabledPage.close();

  const shortSessionPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(shortSessionPage, 'https://www.youtube.com/', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['youtube', 'youtube-shorts'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
    },
    localState: {
      aceitaTempoSocialSession: {
        siteId: 'youtube',
        siteName: 'YouTube',
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        suspendedAt: new Date().toISOString(),
        activeMs: 55 * 1000,
        activeIntervals: [],
        currentIntervalStartAt: null,
        goalNote: '',
        initialPromptShownAt: null,
        initialResponse: null,
        promptCount: 0,
        nextPromptAtActiveMs: 700,
        interimPromptShownAt: null,
        interimResponse: null,
      },
    },
  });
  await shortSessionPage.waitForTimeout(300);
  const shortSessionState = await shortSessionPage.evaluate(() => window.__aceitaTempoTestStorage?.local || {});
  assert.ok(!shortSessionState.aceitaTempoSocialPendingReflection, 'sessions around one minute of active time should be ignored instead of generating a pending reflection');
  await shortSessionPage.close();

  const shortsBlockedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(shortsBlockedPage, 'https://www.youtube.com/shorts/demo', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['youtube'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
    },
  });
  await shortsBlockedPage.waitForTimeout(900);
  assert.strictEqual(await shortsBlockedPage.locator('#aceita-tempo-social-root').count(), 0, 'YouTube Shorts should not be monitored when only the general YouTube option is enabled');
  await shortsBlockedPage.close();

  const shortsEnabledPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(shortsEnabledPage, 'https://www.youtube.com/shorts/demo', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['youtube-shorts'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
    },
  });
  await shortsEnabledPage.waitForSelector('.aceita-tempo-social__toast');
  assert.strictEqual(await shortsEnabledPage.locator('.aceita-tempo-social__toast').count(), 1, 'YouTube Shorts should be monitored when its dedicated option is enabled');
  await shortsEnabledPage.close();

  const siteOptOutPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(siteOptOutPage, 'https://www.youtube.com/', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['instagram'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
    },
  });
  await siteOptOutPage.waitForTimeout(900);
  assert.strictEqual(await siteOptOutPage.locator('#aceita-tempo-social-root').count(), 0, 'unchecked social sites should not be monitored');
  await siteOptOutPage.close();

  const pendingNoMoneyPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(pendingNoMoneyPage, 'https://www.youtube.com/', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['youtube'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: false,
      salaryAmount: 5000,
      monthlyHours: 160,
      salaryCurrency: 'BRL',
    },
    localState: {
      aceitaTempoSocialPendingReflection: {
        siteId: 'youtube',
        siteName: 'YouTube',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        activeMs: 18 * 60 * 1000,
        goalNote: 'watch one video',
        queuedAt: new Date().toISOString(),
      },
    },
  });
  await pendingNoMoneyPage.waitForTimeout(300);
  await clickToastButton(pendingNoMoneyPage, 'Not really');
  const summaryWithoutMoney = await pendingNoMoneyPage.locator('.aceita-tempo-social__toast').innerText();
  assert.ok(/Session summary/i.test(summaryWithoutMoney), 'negative reflection should open the summary toast');
  assert.ok(/final check-in, you chose:\s*Not really/i.test(summaryWithoutMoney), 'summary should mention the response chosen in the final reflection');
  assert.ok(!/Approximate value/i.test(summaryWithoutMoney), 'monetary line should stay hidden by default');
  await clickToastButton(pendingNoMoneyPage, 'Got it');
  await pendingNoMoneyPage.close();

  const pendingWithMoneyPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openSocialFixture(pendingWithMoneyPage, 'https://www.youtube.com/', overrides, {
    syncSettings: {
      socialAwarenessEnabled: true,
      socialAwarenessSites: ['youtube'],
      socialPromptEnabled: true,
      socialTrackingEnabled: true,
      socialReflectionEnabled: true,
      socialMonetaryOptIn: true,
      salaryAmount: 5000,
      monthlyHours: 160,
      salaryCurrency: 'USD',
    },
    localState: {
      aceitaTempoSocialPendingReflection: {
        siteId: 'youtube',
        siteName: 'YouTube',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        activeMs: 30 * 60 * 1000,
        goalNote: '',
        queuedAt: new Date().toISOString(),
      },
    },
  });
  await pendingWithMoneyPage.waitForTimeout(300);
  await clickToastButton(pendingWithMoneyPage, 'Not really');
  const summaryWithMoney = await pendingWithMoneyPage.locator('.aceita-tempo-social__toast').innerText();
  assert.ok(/Approximate value/i.test(summaryWithMoney), 'opt-in monetary mode should add the value line');
  await pendingWithMoneyPage.close();
}

async function runOptionsAssertions(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const html = stripScripts(fs.readFileSync(path.join(ROOT, 'options.html'), 'utf8'));
  await page.setContent(html);
  await installChromeStub(page, {
    syncSettings: {},
    messages: loadMessages('en'),
    storageSetDelayMs: 800,
    runtimeSendMessageDelayMs: 300,
  });
  await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, 'options.css'), 'utf8') });

  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src', 'site-config.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'options.js'), 'utf8') });
  await page.waitForTimeout(300);

  assert.strictEqual(await page.isChecked('#socialAwarenessEnabled'), false, 'social master toggle should start disabled');
  assert.strictEqual(await page.locator('#salaryPeriod').inputValue(), 'monthly', 'salary period should default to monthly');
  assert.strictEqual(await page.locator('#timeDisplayMode').inputValue(), 'hours', 'time display mode should default to hours');
  assert.strictEqual(await page.locator('.form-dock').evaluate((node) => getComputedStyle(node).position), 'fixed', 'actions dock should stay fixed to the viewport');
  const sectionTitles = await page.locator('.settings-section__header h2').allInnerTexts();
  assert.deepStrictEqual(
    sectionTitles,
    ['Calculation basics', 'Time display', 'Sites and exceptions', 'Social awareness'],
    'settings should be grouped in the expected order'
  );
  const selectedCount = await page.locator('[data-social-site-id]:checked').count();
  assert.strictEqual(selectedCount, 4, 'all supported social sites should be selected by default');
  assert.strictEqual(await page.locator('[data-social-site-id=\"youtube-shorts\"]').count(), 1, 'options should expose a dedicated YouTube Shorts toggle');
  assert.strictEqual(await page.locator('#socialAwarenessControls').evaluate((node) => node.hidden), true, 'social suboptions should stay hidden while master toggle is off');

  await page.locator('#socialAwarenessEnabled').check({ force: true });
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('#socialAwarenessControls').evaluate((node) => node.hidden), false, 'social suboptions should appear after enabling the feature');
  assert.strictEqual(await page.locator('#socialPromptEnabled').isDisabled(), false, 'social suboptions should become interactive when the master toggle is on');

  await page.fill('#salaryAmount', '6123.45');
  await page.click('#saveButton');
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('#saveButton').isDisabled(), true, 'save button should disable while saving');
  assert.match(await page.locator('#saveButtonLabel').innerText(), /Saving/i, 'save button should show a loading label');
  assert.strictEqual(await page.locator('#saveToast').evaluate((node) => node.hidden), true, 'toast should still be hidden during the save');

  await page.waitForTimeout(1100);
  assert.strictEqual(await page.locator('#saveToast').evaluate((node) => node.hidden), false, 'toast should appear after saving finishes');
  assert.match(await page.locator('#saveToastTitle').innerText(), /All set/i, 'toast should use a success title');
  assert.match(await page.locator('#saveToastMessage').innerText(), /Settings saved\./i, 'toast should show a success message');

  await page.waitForTimeout(3000);
  assert.strictEqual(await page.locator('#saveToast').evaluate((node) => node.hidden), true, 'toast should auto-dismiss after a short delay');

  await page.close();
}

async function runPopupAssertions(browser) {
  const page = await browser.newPage({ viewport: { width: 380, height: 480 } });
  const html = stripScripts(fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8'));
  await page.setContent(html);
  await installChromeStub(page, {
    syncSettings: {
      salaryAmount: 5000,
      salaryCurrency: 'BRL',
      monthlyHours: 160,
      wageMode: 'monthly',
      exchangeRateMode: 'auto',
      exchangeRateUsdToBrl: 5.5,
    },
    localState: {
      aceitaTempoSocialSession: {
        siteId: 'instagram',
        siteName: 'Instagram',
        activeMs: 125000,
      },
    },
    messages: loadMessages('en'),
    activeTab: { id: 1, url: 'https://www.instagram.com/' },
    tabMessageResponse: {
      kind: 'social',
      siteId: 'instagram',
      siteName: 'Instagram',
      activeMs: 3000,
      tracking: true,
    },
    tabMessageResponseStepMs: 1000,
  });

  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src', 'site-config.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8') });
  await page.waitForTimeout(200);

  assert.strictEqual(await page.locator('#socialCounterCard').evaluate((node) => node.hidden), false, 'popup should show the social counter card on monitored social pages');
  assert.match(await page.locator('#socialSiteName').innerText(), /Instagram/i, 'popup should label the current social site');
  assert.match(await page.locator('#socialActiveTime').innerText(), /3s/, 'popup should show the current active-time counter');
  await page.waitForTimeout(1200);
  assert.match(await page.locator('#socialActiveTime').innerText(), /4s/, 'popup social counter should keep updating while the popup stays open');

  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    await runContentAssertions(browser);
    await runOptionsAssertions(browser);
    await runPopupAssertions(browser);
    console.log('Social-awareness smoke checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
