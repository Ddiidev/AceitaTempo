const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const DAY_MS = 24 * 60 * 60 * 1000;
const HTML = `<!doctype html><html lang="en"><body>
  <div id="corePrice_feature_div">
    <span class="a-price"><span class="a-offscreen">US$ 19.99</span><span aria-hidden="true">US$ 19.99</span></span>
  </div>
</body></html>`;
const SETTINGS = {
  salaryAmount: 5000,
  monthlyHours: 160,
  salaryCurrency: 'BRL',
  exchangeRateMode: 'manual',
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  affiliateEnabled: true,
  affiliateDisabledStores: [],
};
const CONTENT_SCRIPTS = [
  'src/price-utils.js',
  'src/site-config.js',
  'src/social-awareness.js',
  'src/affiliate.js',
  'src/i18n-utils.js',
  'src/content.js',
];

function createStorageArea(values) {
  return {
    get(keys, callback) {
      const selected = Array.isArray(keys)
        ? Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]))
        : { ...values };
      queueMicrotask(() => callback(selected));
    },
    set(nextValues, callback) {
      Object.assign(values, nextValues);
      queueMicrotask(() => callback?.());
    },
  };
}

function createBackground() {
  const storage = {};
  let messageListener;
  const area = createStorageArea(storage);
  const event = { addListener(listener) { this.listener = listener; } };
  const chrome = {
    storage: { sync: area, local: area },
    runtime: {
      lastError: null,
      getURL: (file) => `chrome-extension://test/${file}`,
      onMessage: { addListener(listener) { messageListener = listener; } },
      onInstalled: event,
      onStartup: event,
    },
    alarms: { create() {}, onAlarm: event },
    tabs: { create: (_properties, callback) => callback?.() },
  };
  const source = fs.readFileSync(path.join(process.cwd(), 'background.js'), 'utf8');
  vm.runInNewContext(source, { chrome, console, Date, URL, fetch, setTimeout, clearTimeout });

  return {
    storage,
    request(message) {
      return new Promise((resolve) => {
        const returned = messageListener(message, {}, resolve);
        if (returned && typeof returned.then === 'function') returned.then(resolve);
        else if (returned !== true) resolve(returned);
      });
    },
  };
}

async function injectContent(page, background, settings = SETTINGS) {
  await page.evaluate((settings) => {
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        storage: {
          sync: { get: (_keys, callback) => callback({ ...settings }) },
          local: { get: (_keys, callback) => callback({ ...settings }) },
          onChanged: { addListener: () => {} },
        },
        runtime: {
          sendMessage: (message, callback) => {
            window.__sendExtensionMessage(message).then((response) => callback?.(response));
          },
          getURL: (file) => `chrome-extension://test/${file}`,
        },
        i18n: { getMessage: (key) => key },
      },
    });
  }, settings);
  for (const file of CONTENT_SCRIPTS) {
    await page.addScriptTag({ path: path.join(process.cwd(), file) });
  }
  await page.locator('[data-aceita-tempo-badge="1"]').first().waitFor({ state: 'attached' });
}

async function assertBackgroundPolicy(background) {
  const [first, concurrent] = await Promise.all([
    background.request({ type: 'aceitaTempo:affiliateToast:claim' }),
    background.request({ type: 'aceitaTempo:affiliateToast:claim' }),
  ]);
  assert.strictEqual([first, concurrent].filter((result) => result.allowed).length, 1,
    'only one simultaneous tab may claim the global toast');

  background.storage.affiliateToastLastShownAt = Date.now() - (7 * DAY_MS) - 1;
  const afterCooldown = await background.request({ type: 'aceitaTempo:affiliateToast:claim' });
  assert.strictEqual(afterCooldown.allowed, true, 'a new toast may be claimed after seven days');

  await background.request({ type: 'aceitaTempo:affiliateToast:dismiss' });
  assert.ok(background.storage.affiliateToastDismissedUntil >= Date.now() + (29 * DAY_MS),
    'dismissal should persist a 30-day pause');
  background.storage.affiliateToastLastShownAt = Date.now() - (8 * DAY_MS);
  const whileDismissed = await background.request({ type: 'aceitaTempo:affiliateToast:claim' });
  assert.strictEqual(whileDismissed.allowed, false, 'dismissal pause should block claims beyond the weekly cooldown');
  background.storage.affiliateToastDismissedUntil = Date.now() - 1;
  const afterDismissal = await background.request({ type: 'aceitaTempo:affiliateToast:claim' });
  assert.strictEqual(afterDismissal.allowed, true, 'suggestions may resume after the dismissal pause expires');
}

async function main() {
  const background = createBackground();
  await assertBackgroundPolicy(background);
  console.log('Affiliate toast background policy checks passed.');
  if (process.argv.includes('--policy-only')) return;
  background.storage.affiliateToastLastShownAt = Date.now() - (8 * DAY_MS);
  background.storage.affiliateToastDismissedUntil = Date.now() - 1;
  const launchOptions = process.env.ACEITATEMPO_TEST_BROWSER
    ? { executablePath: process.env.ACEITATEMPO_TEST_BROWSER }
    : {};
  const browser = await chromium.launch({ headless: true, ...launchOptions });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.exposeBinding('__sendExtensionMessage', (_source, message) => background.request(message));
  const pages = [];

  try {
    for (const product of ['first', 'second']) {
      const page = await context.newPage();
      pages.push(page);
      await page.route('https://www.amazon.com/dp/*', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HTML,
      }));
      await page.goto(`https://www.amazon.com/dp/${product}`, { waitUntil: 'domcontentloaded' });
      await page.clock.install();
      await injectContent(page, background);
    }

    const [firstPage, secondPage] = pages;
    const badge = firstPage.locator('[data-aceita-tempo-badge="1"]').first();
    await badge.hover();
    await firstPage.clock.fastForward(8_000);
    await firstPage.mouse.move(5, 5);
    await firstPage.clock.fastForward(300);
    assert.strictEqual(await firstPage.locator('#aceita-tempo-affiliate-toast').count(), 0,
      'leaving the badge before 15 seconds must not show the toast');
    await badge.hover();
    await firstPage.clock.fastForward(8_000);
    assert.strictEqual(await firstPage.locator('#aceita-tempo-affiliate-toast').count(), 0,
      're-entering after leaving must start a fresh 15-second timer');
    const tooltip = firstPage.locator('#aceita-tempo-tooltip');
    await tooltip.waitFor({ state: 'visible' });
    await tooltip.hover();
    await firstPage.clock.fastForward(7_000);
    await firstPage.locator('#aceita-tempo-affiliate-toast').waitFor({ state: 'attached' });
    assert.ok(firstPage.url().includes('/dp/first') && !firstPage.url().includes('tag='),
      'showing the toast must not redirect before an explicit click');

    const secondBadge = secondPage.locator('[data-aceita-tempo-badge="1"]').first();
    await secondBadge.hover();
    await secondPage.clock.fastForward(15_000);
    assert.strictEqual(await secondPage.locator('#aceita-tempo-affiliate-toast').count(), 0,
      'the global seven-day limit should block another product tab');

    await firstPage.locator('#aceita-tempo-affiliate-toast button').nth(1).click();
    assert.ok(background.storage.affiliateToastDismissedUntil > Date.now(),
      'dismiss button should apply the global 30-day pause');

    background.storage.affiliateToastLastShownAt = Date.now() - (8 * DAY_MS);
    await secondPage.mouse.move(5, 5);
    await secondPage.clock.fastForward(300);
    await secondBadge.hover();
    await secondPage.clock.fastForward(15_000);
    assert.strictEqual(await secondPage.locator('#aceita-tempo-affiliate-toast').count(), 0,
      'dismissal should suppress suggestions even after the seven-day cooldown');

    background.storage.affiliateToastDismissedUntil = Date.now() - 1;
    await secondPage.mouse.move(5, 5);
    await secondPage.clock.fastForward(300);
    await secondBadge.hover();
    await secondPage.clock.fastForward(15_000);
    await secondPage.locator('#aceita-tempo-affiliate-toast').waitFor({ state: 'attached' });
    await secondPage.locator('#aceita-tempo-affiliate-toast button').first().click();
    await secondPage.waitForURL(/tag=aceitatempo-20/);

    const disabledPage = await context.newPage();
    pages.push(disabledPage);
    await disabledPage.route('https://www.amazon.com/dp/*', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: HTML,
    }));
    await disabledPage.goto('https://www.amazon.com/dp/disabled', { waitUntil: 'domcontentloaded' });
    await disabledPage.clock.install();
    await injectContent(disabledPage, background, { ...SETTINGS, affiliateEnabled: false });
    await disabledPage.locator('[data-aceita-tempo-badge="1"]').first().hover();
    await disabledPage.clock.fastForward(16_000);
    assert.strictEqual(await disabledPage.locator('#aceita-tempo-affiliate-toast').count(), 0,
      'the master affiliate setting should continue to disable the toast');

    const storeDisabledPage = await context.newPage();
    pages.push(storeDisabledPage);
    await storeDisabledPage.route('https://www.amazon.com/dp/*', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: HTML,
    }));
    await storeDisabledPage.goto('https://www.amazon.com/dp/store-disabled', { waitUntil: 'domcontentloaded' });
    await storeDisabledPage.clock.install();
    await injectContent(storeDisabledPage, background, { ...SETTINGS, affiliateDisabledStores: ['amazon'] });
    await storeDisabledPage.locator('[data-aceita-tempo-badge="1"]').first().hover();
    await storeDisabledPage.clock.fastForward(16_000);
    assert.strictEqual(await storeDisabledPage.locator('#aceita-tempo-affiliate-toast').count(), 0,
      'the per-store affiliate setting should continue to disable the toast');

    console.log('Affiliate toast smoke checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
