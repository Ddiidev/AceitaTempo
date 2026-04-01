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
  path.join(process.cwd(), 'src', 'social-awareness.js'),
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

async function runAlibabaAssertions(page) {
  const html = String.raw`<!doctype html>
  <html lang="pt-BR">
    <head><style>
      .slick-slide { display: inline-block; width: 173px; }
      .bottom_content { display: block; }
      .product-price { display: block; font-size: 18px; }
      .price-wrapper { display: block; font-size: 18px; }
      .final-price { display: inline; }
      .sub-title { display: block; }
    </style></head>
    <body>
      <!-- Layout A: ag-gruarantee-block -->
      <div class="ag-gruarantee-block" id="layout-a-block">
        <div class="slider-container">
          <div class="slick-slider slick-initialized">
            <div class="slick-list">
              <div class="slick-track">
                <div data-index="0" class="slick-slide" style="width:173px;" id="layout-a-item">
                  <div>
                    <div style="width:100%; display:inline-block;">
                      <a href="#" class="home-dot-element">
                        <div class="product-img-wrapper"></div>
                        <div class="bottom_content">
                          <div class="product-price" id="price-layout-a">R$&#160;33,00</div>
                          <div class="sub-title">Entrega até 07 de mai.</div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Layout B: top-deals-floor -->
      <div class="top-deals-floor" id="layout-b-block">
        <div class="slider-container">
          <div class="slick-slider slick-initialized">
            <div class="slick-list">
              <div class="slick-track">
                <div data-index="0" class="slick-slide" style="width:236px;" id="layout-b-item">
                  <a href="#" class="home-dot-element">
                    <div class="product-img-wrapper"></div>
                    <div class="bottom_content">
                      <div class="custom-wrapper">
                        <div class="price-wrapper" id="price-layout-b">
                          <span class="price">
                            <span class="final-price">R$&#160;164,91</span>
                          </span>
                        </div>
                      </div>
                      <div class="sub-title">MOQ: 10</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`;

  await page.route('https://www.alibaba.com/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    });
  });

  await page.goto('https://www.alibaba.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await injectExtension(page);
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('[data-aceita-tempo-badge="1"]')];
    return {
      badgeCount: badges.length,
      badgeTexts: badges.map((b) => b.textContent.trim()),
    };
  });

  assert.ok(state.badgeCount >= 2, `Alibaba fixture: expected at least 2 badges (one per layout), got ${state.badgeCount}. Texts: ${JSON.stringify(state.badgeTexts)}`);
  for (const text of state.badgeTexts) {
    assert.ok(text.startsWith('~'), `Alibaba badge should show work duration, got: "${text}"`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await runAlibabaAssertions(page);
    console.log('Alibaba fixture checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
//Jiuk
