const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SETTINGS = {
  salaryAmount: 5000,
  monthlyHours: 160,
  salaryCurrency: 'BRL',
  exchangeRateMode: 'manual',
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
};

const SCRIPT_FILES = [
  path.join(process.cwd(), 'src', 'price-utils.js'),
  path.join(process.cwd(), 'src', 'site-config.js'),
  path.join(process.cwd(), 'src', 'content.js'),
];

async function injectExtension(page) {
  await page.evaluate((settings) => {
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        storage: {
          sync: { get: (_keys, callback) => callback({ ...settings }) },
          local: { get: (_keys, callback) => callback({ ...settings }) },
          onChanged: { addListener: () => {} },
        },
      },
    });
  }, SETTINGS);

  for (const script of SCRIPT_FILES) {
    await page.addScriptTag({ content: fs.readFileSync(script, 'utf8') });
  }
}

async function runTemuAssertions(page) {
  // HTML mirrors the real Temu structure provided in the task spec.
  // The price lives in a visually-hidden srOnly span (innerText empty),
  // so the extension must fall back to textContent to capture R$769,57.
  const html = String.raw`<!doctype html>
  <html lang="pt-BR">
    <head><style>
      .srOnly-18Z4t {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
      .item-3QttB { display: block; }
      .goodsPrice-3WNiN { display: block; font-size: 20px; }
    </style></head>
    <body>
      <div class="saleInfo-sPIai item-3QttB">
        <div class="left-1AmIx">
          <div class="saleInfo-3iLVR newStyle-2ZixM" data-priority-list="5,3,1,2,4,8,9">
            <div class="priceWrap-3YWwa" data-ignore="true">
              <div class="goodsPrice-3WNiN" data-type="price" id="price-block-1">
                <span class="srOnly-18Z4t" id="price-sr-only">R$769,57</span>
                <div class="price-2Xz_3" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`;

  await page.route('https://www.temu.com/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    });
  });

  await page.goto('https://www.temu.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await injectExtension(page);
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const scope = document.querySelector('#price-block-1');
    const badge = scope && scope.parentElement
      ? scope.parentElement.querySelector('[data-aceita-tempo-badge="1"]')
        || document.querySelector('[data-aceita-tempo-badge="1"]')
      : document.querySelector('[data-aceita-tempo-badge="1"]');

    return {
      badgeCount: document.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
      badgeText: badge ? badge.textContent.trim() : '',
    };
  });

  assert.ok(state.badgeCount >= 1, `Temu fixture: expected at least 1 badge, got ${state.badgeCount}`);
  assert.ok(state.badgeText.startsWith('~'), `Temu badge should show work duration, got: "${state.badgeText}"`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await runTemuAssertions(page);
    console.log('Temu fixture checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
