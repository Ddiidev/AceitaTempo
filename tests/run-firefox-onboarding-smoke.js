const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = process.cwd();

function loadMessages(localeFolder = 'en') {
  const file = path.join(ROOT, '_locales', localeFolder, 'messages.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stripScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function pickStorageValues(source, keys) {
  if (keys == null) return { ...source };
  if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, source[key]]));
  if (typeof keys === 'string') return { [keys]: source[keys] };
  return Object.fromEntries(Object.keys(keys).map((key) => [key, source[key] ?? keys[key]]));
}

async function runBackgroundWithFirefoxBrowserNamespace() {
  const installedListeners = [];
  const startupListeners = [];
  const alarmListeners = [];
  const messageListeners = [];
  const openedTabs = [];
  const createdAlarms = [];
  const storageState = { sync: {}, local: {} };

  const browser = {
    storage: {
      sync: {
        get: async (keys) => pickStorageValues(storageState.sync, keys),
        set: async (values) => Object.assign(storageState.sync, values || {}),
      },
      local: {
        get: async (keys) => pickStorageValues(storageState.local, keys),
        set: async (values) => Object.assign(storageState.local, values || {}),
      },
    },
    runtime: {
      lastError: null,
      getURL: (resource) => `moz-extension://aceitatempo/${resource}`,
      onInstalled: { addListener: (listener) => installedListeners.push(listener) },
      onStartup: { addListener: (listener) => startupListeners.push(listener) },
      onMessage: { addListener: (listener) => messageListeners.push(listener) },
    },
    alarms: {
      create: async (name, alarmInfo) => createdAlarms.push({ name, alarmInfo }),
      onAlarm: { addListener: (listener) => alarmListeners.push(listener) },
    },
    tabs: {
      create: async (createProperties) => {
        openedTabs.push(createProperties);
        return { id: openedTabs.length, ...createProperties };
      },
    },
  };

  const context = {
    browser,
    fetch: async () => ({
      ok: true,
      json: async () => ({ rates: { BRL: 5.5 } }),
    }),
    console,
    Date,
    Error,
    Object,
    Promise,
    String,
    Number,
    Array,
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), context);

  assert.strictEqual(installedListeners.length, 1, 'Firefox should register the install listener through browser.runtime');
  await installedListeners[0]({ reason: 'install' });

  assert.strictEqual(storageState.sync.onboardingSeen, true, 'Firefox install should mark onboarding as seen before opening it');
  assert.strictEqual(openedTabs.length, 1, 'Firefox install should open exactly one onboarding tab');
  assert.strictEqual(openedTabs[0].url, 'moz-extension://aceitatempo/onboarding.html', 'Firefox install should open onboarding.html');
  assert.strictEqual(createdAlarms.length, 1, 'Firefox install should create the exchange-rate alarm');
  assert.strictEqual(messageListeners.length, 1, 'Firefox should register a background message listener');

  const settingsResponse = await messageListeners[0]({ type: 'aceitaTempo:getSettings' }, {}, () => {
    throw new Error('Firefox browser namespace should return a Promise response instead of sendResponse');
  });
  assert.strictEqual(settingsResponse.ok, true, 'Firefox browser namespace should resolve getSettings messages');
  assert.strictEqual(settingsResponse.settings.affiliateEnabled, true, 'Firefox getSettings response should include defaults');

  await installedListeners[0]({ reason: 'update' });
  assert.strictEqual(openedTabs.length, 1, 'Firefox update should not reopen onboarding after it was marked as seen');
}

async function runBackgroundWithChromeCallbackNamespace() {
  const installedListeners = [];
  const startupListeners = [];
  const alarmListeners = [];
  const messageListeners = [];
  const openedTabs = [];
  const storageState = { sync: {}, local: {} };

  function createArea(areaName) {
    return {
      get(keys, callback) {
        callback(pickStorageValues(storageState[areaName], keys));
      },
      set(values, callback) {
        Object.assign(storageState[areaName], values || {});
        callback?.();
      },
    };
  }

  const chrome = {
    storage: {
      sync: createArea('sync'),
      local: createArea('local'),
    },
    runtime: {
      lastError: null,
      getURL: (resource) => `chrome-extension://aceitatempo/${resource}`,
      onInstalled: { addListener: (listener) => installedListeners.push(listener) },
      onStartup: { addListener: (listener) => startupListeners.push(listener) },
      onMessage: { addListener: (listener) => messageListeners.push(listener) },
    },
    alarms: {
      create: () => undefined,
      onAlarm: { addListener: (listener) => alarmListeners.push(listener) },
    },
    tabs: {
      create(createProperties, callback) {
        openedTabs.push(createProperties);
        callback?.({ id: openedTabs.length, ...createProperties });
      },
    },
  };

  const context = {
    chrome,
    fetch: async () => ({
      ok: true,
      json: async () => ({ rates: { BRL: 5.5 } }),
    }),
    console,
    Date,
    Error,
    Object,
    Promise,
    String,
    Number,
    Array,
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), context);

  assert.strictEqual(installedListeners.length, 1, 'Chrome callback namespace should register the install listener');
  await installedListeners[0]({ reason: 'install' });

  assert.strictEqual(storageState.sync.onboardingSeen, true, 'Chrome callback install should mark onboarding as seen');
  assert.strictEqual(openedTabs.length, 1, 'Chrome callback install should open onboarding once');
  assert.strictEqual(openedTabs[0].url, 'chrome-extension://aceitatempo/onboarding.html', 'Chrome callback install should open onboarding.html');
  assert.strictEqual(messageListeners.length, 1, 'Chrome callback namespace should register a background message listener');

  let callbackResponse = null;
  const keepAlive = messageListeners[0]({ type: 'aceitaTempo:getSettings' }, {}, (response) => {
    callbackResponse = response;
  });
  assert.strictEqual(keepAlive, true, 'Chrome callback namespace should keep sendResponse alive');
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(callbackResponse.ok, true, 'Chrome callback namespace should answer getSettings messages');
}

async function installFirefoxPageStub(page) {
  const messages = loadMessages('en');
  const messagesDataUrl = `data:application/json;base64,${Buffer.from(JSON.stringify(messages)).toString('base64')}`;

  await page.evaluate(({ messages, messagesDataUrl }) => {
    const storageState = {
      sync: {
        affiliateEnabled: true,
        affiliateDisabledStores: [],
      },
      local: {},
    };

    function replacePlaceholders(template, substitutions = []) {
      return substitutions.reduce(
        (text, value, index) => text.replace(new RegExp(`\\$${index + 1}`, 'g'), String(value)),
        template
      );
    }

    function createArea(areaName) {
      return {
        get: async (keys) => {
          const source = storageState[areaName];
          if (keys == null) return { ...source };
          if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, source[key]]));
          if (typeof keys === 'string') return { [keys]: source[keys] };
          return Object.fromEntries(Object.keys(keys).map((key) => [key, source[key] ?? keys[key]]));
        },
        set: async (values) => {
          Object.assign(storageState[areaName], values || {});
        },
      };
    }

    window.__aceitaTempoFirefoxStorage = storageState;
    window.__aceitaTempoOpenedOptions = false;
    window.__aceitaTempoClosed = false;
    window.close = () => {
      window.__aceitaTempoClosed = true;
    };

    Object.defineProperty(window, 'browser', {
      configurable: true,
      value: {
        storage: {
          sync: createArea('sync'),
          local: createArea('local'),
        },
        runtime: {
          getURL: (resource) => (resource.startsWith('_locales/') ? messagesDataUrl : `moz-extension://aceitatempo/${resource}`),
          openOptionsPage: async () => {
            window.__aceitaTempoOpenedOptions = true;
          },
        },
        i18n: {
          getUILanguage: () => 'en-US',
          getMessage: (key, substitutions = []) => {
            const template = messages[key]?.message || '';
            return replacePlaceholders(template, Array.isArray(substitutions) ? substitutions : [substitutions]);
          },
        },
      },
    });
  }, { messages, messagesDataUrl });
}

async function runOnboardingPageWithFirefoxBrowserNamespace(browser) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1200 } });
  const html = stripScripts(fs.readFileSync(path.join(ROOT, 'onboarding.html'), 'utf8'));
  await page.setContent(html);
  await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, 'onboarding.css'), 'utf8') });
  await installFirefoxPageStub(page);
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src', 'site-config.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src', 'affiliate.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'onboarding.js'), 'utf8') });

  await page.waitForSelector('[data-affiliate-site-id="amazon"]');
  assert.match(await page.locator('h1').innerText(), /AceitaTempo/i, 'Firefox onboarding should localize the title');
  const instantGamingAffiliateUrl = await page.evaluate(() =>
    window.AceitaTempoAffiliate.buildAffiliateUrl('https://www.instant-gaming.com/br/1234-comprar-example/', 'instant-gaming')
  );
  assert.match(instantGamingAffiliateUrl, /[?&]igr=aceitatempo(?:&|$)/, 'Instant Gaming affiliate links should receive igr=aceitatempo');

  const affiliateStoreIds = await page.locator('[data-affiliate-site-id]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-affiliate-site-id')).sort()
  );
  assert.deepStrictEqual(
    affiliateStoreIds,
    ['amazon', 'instant-gaming', 'mercado-livre'],
    'Firefox onboarding should expose only active affiliate stores'
  );
  assert.strictEqual(
    await page.evaluate(() =>
      document.querySelector('[data-affiliate-site-id="instant-gaming"]')
        ?.closest('.site-toggle')
        ?.querySelector('.site-toggle__link')
        ?.getAttribute('href')
    ),
    'https://www.instant-gaming.com/br/',
    'Firefox onboarding should show the Instant Gaming store link'
  );

  await page.locator('#dismiss').click();
  await page.waitForFunction(() => window.__aceitaTempoFirefoxStorage.sync.onboardingSeen === true);
  assert.strictEqual(await page.evaluate(() => window.__aceitaTempoClosed), true, 'dismiss should close the Firefox onboarding tab');

  await page.close();

  const optionsPage = await browser.newPage({ viewport: { width: 1100, height: 1200 } });
  await optionsPage.setContent(html);
  await optionsPage.addStyleTag({ content: fs.readFileSync(path.join(ROOT, 'onboarding.css'), 'utf8') });
  await installFirefoxPageStub(optionsPage);
  await optionsPage.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src', 'site-config.js'), 'utf8') });
  await optionsPage.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src', 'affiliate.js'), 'utf8') });
  await optionsPage.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'onboarding.js'), 'utf8') });

  await optionsPage.waitForSelector('#openSettings');
  await optionsPage.locator('#openSettings').click();
  await optionsPage.waitForFunction(() => window.__aceitaTempoOpenedOptions === true);
  assert.strictEqual(
    await optionsPage.evaluate(() => window.__aceitaTempoFirefoxStorage.sync.onboardingSeen),
    true,
    'open settings should mark Firefox onboarding as seen'
  );

  await optionsPage.close();
}

async function main() {
  await runBackgroundWithFirefoxBrowserNamespace();
  await runBackgroundWithChromeCallbackNamespace();

  const browser = await chromium.launch({ headless: true });
  try {
    await runOnboardingPageWithFirefoxBrowserNamespace(browser);
  } finally {
    await browser.close();
  }

  console.log('Firefox onboarding smoke checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
