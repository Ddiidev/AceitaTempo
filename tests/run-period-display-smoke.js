const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const PRICE_UTILS = fs.readFileSync(path.join(ROOT, 'src', 'price-utils.js'), 'utf8');
const SITE_CONFIG = fs.readFileSync(path.join(ROOT, 'src', 'site-config.js'), 'utf8');
const CONTENT_SCRIPT = fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');

const SETTINGS = {
  salaryAmount: 900,
  monthlyHours: 30,
  salaryPeriod: 'weekly',
  salaryCurrency: 'BRL',
  wageMode: 'monthly',
  timeDisplayMode: 'hours',
  extendedTimeDisplay: false,
  exchangeRateMode: 'manual',
  manualUsdToBrlRate: 1,
  exchangeRateUsdToBrl: 1,
};

function buildHtml(priceText) {
  return `<!doctype html>
<html lang="pt-BR">
  <body>
    <main>
      <section id="product">
        <span class="a-price">
          <span class="a-offscreen">${priceText}</span>
        </span>
      </section>
    </main>
  </body>
</html>`;
}

async function installChromeStub(page, syncSettings) {
  await page.evaluate((settings) => {
    const storageState = {
      sync: { ...settings },
      local: {},
    };

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
          Object.assign(storageState[areaName], values || {});
          callback?.();
        },
      };
    }

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
          sendMessage: (_message, callback) => callback?.({ ok: true }),
        },
      },
    });
  }, syncSettings);
}

async function loadPage(page, syncSettings, html) {
  await page.route('https://www.amazon.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  await page.goto('https://www.amazon.com/', { waitUntil: 'domcontentloaded' });
  await installChromeStub(page, syncSettings);
  await page.addScriptTag({ content: PRICE_UTILS });
  await page.addScriptTag({ content: SITE_CONFIG });
  await page.addScriptTag({ content: CONTENT_SCRIPT });
  await page.waitForTimeout(800);
}

async function getBadgeText(page) {
  return page.locator('[data-aceita-tempo-badge="1"]').first().innerText();
}

async function getTooltipText(page) {
  return page.locator('#aceita-tempo-tooltip').innerText();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
      await loadPage(page, { ...SETTINGS, timeDisplayMode: 'hours' }, buildHtml('R$ 2.250,00'));
      assert.strictEqual(await getBadgeText(page), '~75h', 'hours mode should keep the hour-based badge');
      await page.locator('[data-aceita-tempo-badge="1"]').first().hover();
      await page.waitForTimeout(100);
      assert.match(await getTooltipText(page), /75h de trabalho|75h of work/i, 'hours mode tooltip should remain hour-based');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
      await loadPage(
        page,
        {
          ...SETTINGS,
          salaryAmount: 5000,
          monthlyHours: 160,
          salaryPeriod: 'monthly',
          timeDisplayMode: 'period',
          extendedTimeDisplay: true,
          extendedTimeDayMode: 'working',
        },
        buildHtml('R$ 67.990,00')
      );
      const badgeText = await getBadgeText(page);
      assert.strictEqual(badgeText, '~1 ano e 1 mês', `monthly period mode should keep only the first two measures, got: ${badgeText}`);
      assert.ok(!/\d+h|\d+min/i.test(badgeText), `monthly period mode should not expose hours/minutes, got: ${badgeText}`);
      await page.locator('[data-aceita-tempo-badge="1"]').first().hover();
      await page.waitForTimeout(100);
      assert.match(await getTooltipText(page), /1 ano e 1 mês/i, 'monthly tooltip should match the rounded compact label');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
      await loadPage(
        page,
        {
          ...SETTINGS,
          salaryAmount: 5000,
          monthlyHours: 160,
          salaryPeriod: 'monthly',
          timeDisplayMode: 'period',
          extendedTimeDisplay: true,
          extendedTimeDayMode: 'working',
        },
        buildHtml('R$ 6.799,00')
      );
      const badgeText = await getBadgeText(page);
      assert.strictEqual(badgeText, '~1 mês e 1 semana', `monthly period mode should stop after two measures, got: ${badgeText}`);
      assert.ok(!/ e .* e /.test(badgeText), `monthly period mode should never show more than two measures, got: ${badgeText}`);
      await page.locator('[data-aceita-tempo-badge="1"]').first().hover();
      await page.waitForTimeout(100);
      assert.match(await getTooltipText(page), /1 mês e 1 semana/i, 'monthly tooltip should match the compact label');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
      await loadPage(
        page,
        {
          ...SETTINGS,
          salaryAmount: 1000,
          monthlyHours: 80,
          salaryPeriod: 'biweekly',
          timeDisplayMode: 'period',
          extendedTimeDisplay: true,
          extendedTimeDayMode: 'working',
        },
        buildHtml('R$ 1.591,00')
      );
      const badgeText = await getBadgeText(page);
      assert.ok(/2 semanas|13d/.test(badgeText), `biweekly period mode should round near-week remainders, got: ${badgeText}`);
      assert.ok(!/\d+h|\d+min/i.test(badgeText), `biweekly period mode should not expose hours/minutes, got: ${badgeText}`);
      await page.locator('[data-aceita-tempo-badge="1"]').first().hover();
      await page.waitForTimeout(100);
      assert.match(await getTooltipText(page), /2 semanas|13d/i, 'biweekly tooltip should match the rounded compact label');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
      await loadPage(
        page,
        {
          ...SETTINGS,
          salaryAmount: 900,
          monthlyHours: 30,
          salaryPeriod: 'weekly',
          timeDisplayMode: 'period',
          extendedTimeDisplay: true,
          extendedTimeDayMode: 'working',
        },
        buildHtml('R$ 2.250,00')
      );
      const badgeText = await getBadgeText(page);
      assert.ok(/~2 semanas e 15h/.test(badgeText), `weekly period mode should remain able to show hours, got: ${badgeText}`);
      await page.locator('[data-aceita-tempo-badge="1"]').first().hover();
      await page.waitForTimeout(100);
      assert.match(await getTooltipText(page), /2 semanas e 15h/i, 'weekly period mode tooltip should still include the remainder hours');
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
      await loadPage(
        page,
        {
          ...SETTINGS,
          salaryAmount: 240,
          monthlyHours: 8,
          salaryPeriod: 'daily',
          timeDisplayMode: 'period',
          extendedTimeDisplay: false,
        },
        buildHtml('R$ 75,00')
      );
      const badgeText = await getBadgeText(page);
      assert.ok(/~2h 30m/.test(badgeText), `daily period mode should stay compact in hours/minutes, got: ${badgeText}`);
      await page.locator('[data-aceita-tempo-badge="1"]').first().hover();
      await page.waitForTimeout(100);
      assert.match(await getTooltipText(page), /2h 30m/i, 'daily period mode tooltip should reflect the hourly remainder');
      await page.close();
    }

    console.log('Period-display smoke checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
