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
          sync: {
            get: (_keys, callback) => callback({ ...settings }),
          },
          local: {
            get: (_keys, callback) => callback({ ...settings }),
          },
          onChanged: {
            addListener: () => {},
          },
        },
      },
    });
  }, SETTINGS);

  for (const script of SCRIPT_FILES) {
    await page.addScriptTag({ content: fs.readFileSync(script, 'utf8') });
  }
}

async function runAmazonAssertions(page) {
  const html = String.raw`<!doctype html>
  <html lang="en">
    <body>
      <div id="apex_desktop">
        <div id="price-block-1" class="a-section a-spacing-none aok-align-center aok-relative apex-core-price-identifier">
          <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value" data-a-size="xl" data-a-color="base">
            <span class="a-offscreen">US$ 19,99</span>
            <span aria-hidden="true">
              <span class="a-price-symbol">US$</span>
              <span class="a-price-whole">19<span class="a-price-decimal">,</span></span>
              <span class="a-price-fraction">99</span>
            </span>
          </span>
        </div>
        <div id="price-block-2" class="a-section a-spacing-none aok-align-center aok-relative apex-core-price-identifier">
          <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value" data-a-size="xl" data-a-color="base">
            <span class="a-offscreen">US$ 31,50</span>
            <span aria-hidden="true">
              <span class="a-price-symbol">US$</span>
              <span class="a-price-whole">31<span class="a-price-decimal">,</span></span>
              <span class="a-price-fraction">50</span>
            </span>
          </span>
        </div>
        <article id="listing-block" class="product-card">
          <span class="a-price" data-a-size="l" data-a-color="base">
            <span class="a-offscreen">US$ 24,50</span>
            <span aria-hidden="true">
              <span class="a-price-symbol">US$</span>
              <span class="a-price-whole">24<span class="a-price-decimal">,</span></span>
              <span class="a-price-fraction">50</span>
            </span>
          </span>
        </article>
        <div id="complex-block" class="a-section apex-core-price-identifier">
          <span id="apex-pricetopay-accessibility-label" class="aok-offscreen">US$ 19,99 com 20 por cento de desconto</span>
          <span class="apex-savings-container">
            <span aria-hidden="true" class="a-size-large a-color-price apex-savings-percentage">-20%</span>
          </span>
          <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value" data-a-size="xl" data-a-color="base">
            <span class="a-offscreen">US$ 19,99</span>
            <span aria-hidden="true">
              <span class="a-price-symbol">US$</span>
              <span class="a-price-whole">19<span class="a-price-decimal">,</span></span>
              <span class="a-price-fraction">99</span>
            </span>
          </span>
          <div id="priceUnitRufusContainer" class="a-section a-spacing-none aok-relative aok-align-center price-unit-rufus-adaptive-container">
            <span class="a-size-base a-color-secondary">US$ 21,80 Cobranças de envio e importação para Brasil</span>
          </div>
        </div>
      </div>
    </body>
  </html>`;

  const css = `
    #apex_desktop { display: block; }
    .a-section { display: block; margin-bottom: 16px; }
    .a-price { display: inline-flex; font-family: Amazon Ember, Arial, sans-serif; font-size: 20px; line-height: 20px; color: rgb(15, 17, 17); }
    .a-offscreen { position: absolute; left: -9999px; }
    .a-price-symbol, .a-price-whole, .a-price-fraction { display: inline; }
  `;

  await page.route('https://www.amazon.com/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    });
  });
  await page.goto('https://www.amazon.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({ content: css });
  await injectExtension(page);
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const read = (id) => {
      const scope = document.querySelector(`#${id}`);
      const price = scope.querySelector('.a-price');
      const badge = scope.querySelector('[data-aceita-tempo-badge="1"]');
      return {
        badgeCount: scope.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
        badgeText: badge?.textContent || '',
        badgeFontFamily: badge ? getComputedStyle(badge).fontFamily : '',
        badgeFontSize: badge ? getComputedStyle(badge).fontSize : '',
        priceFontFamily: price ? getComputedStyle(price).fontFamily : '',
        priceFontSize: price ? getComputedStyle(price).fontSize : '',
        badgeInsideBlock: Boolean(badge && scope.contains(badge)),
      };
    };

    return {
      case1: read('price-block-1'),
      case2: read('price-block-2'),
      listing: read('listing-block'),
      complex: read('complex-block'),
    };
  });

  for (const current of [state.case1, state.case2, state.listing, state.complex]) {
    assert.strictEqual(current.badgeCount, 1, 'Amazon fixture should render one badge per price block');
    assert.ok(current.badgeText.startsWith('~'), 'Amazon badge should show work duration');
    assert.strictEqual(current.badgeFontFamily, current.priceFontFamily, 'Amazon badge should match the price font family');
    assert.strictEqual(current.badgeFontSize, '15px', 'Amazon badge should use 75% of the price font size');
    assert.ok(current.badgeInsideBlock, 'Amazon badge should stay inside the price block');
  }
}

async function runAmazonCssModulesAssertions(page) {
  // Regression test for the newer Amazon card layout using CSS-Module hashed classes.
  // The stable attribute a[data-asin] must act as the scope so the badge is placed correctly.
  const html = String.raw`<!doctype html>
  <html lang="en">
    <body>
      <a data-asin="B09MWHKL2Y" id="cssmod-card" href="#"
         class="a-link-normal _cDEzb_productLink_1X6Zg">
        <div class="a-section a-spacing-none _cDEzb_container_2YT70"></div>
        <div class="a-section a-spacing-none _cDEzb_container__xzc2"></div>
        <div class="a-section a-spacing-none _cDEzb_flex_3xPEG _cDEzb_price_2S471">
          <span id="savingspercent-id" class="a-size-extra-large _cDEzb_savings_kVYU">-7%</span>
          <span id="price-id" class="a-price" data-a-size="xl">
            <span class="a-offscreen">R$&#160;395,99</span>
            <span aria-hidden="true"></span>
          </span>
        </div>
      </a>
    </body>
  </html>`;

  const css = `
    a[data-asin] { display: block; }
    .a-section { display: block; }
    .a-price { display: inline-flex; font-family: Amazon Ember, Arial, sans-serif; font-size: 20px; }
    .a-offscreen { position: absolute; left: -9999px; }
  `;

  await page.route('https://www.amazon.com/cssmod', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    });
  });

  await page.goto('https://www.amazon.com/cssmod', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({ content: css });
  await injectExtension(page);
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => {
    const card = document.querySelector('#cssmod-card');
    const badge = document.querySelector('[data-aceita-tempo-badge="1"]');
    return {
      badgeCount: document.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
      badgeText: badge ? badge.textContent.trim() : '',
      badgeInsideCard: Boolean(badge && card && card.contains(badge)),
    };
  });

  assert.ok(state.badgeCount >= 1, `Amazon _cDEzb_ fixture: expected at least 1 badge, got ${state.badgeCount}`);
  assert.ok(state.badgeText.startsWith('~'), `Amazon _cDEzb_ badge should show work duration, got: "${state.badgeText}"`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await runAmazonAssertions(page);
    console.log('Amazon fixture checks passed.');
    await runAmazonCssModulesAssertions(page);
    console.log('Amazon _cDEzb_ CSS-Modules fixture checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
