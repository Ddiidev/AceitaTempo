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
  const html = String.raw`<!doctype html>
  <html lang="pt-BR">
    <head><style>
      .item-container { display: block; margin: 20px; border-bottom: 1px solid #ccc; padding: 10px; }
      .price-row-reverse { display: flex; flex-direction: row-reverse; font-size: 20px; font-weight: bold; background: #f9f9f9; }
      .pvr-price { text-decoration: line-through; color: gray; margin: 0 10px; font-size: 14px; }
      .installment { color: #cc6600; font-size: 12px; margin-top: 5px; }
    </style></head>
    <body>
      <!-- Case 1: Search result with row-reverse and hidden accessibility text -->
      <div role="group" aria-label="Laptop Pro 15" class="item-container" id="card-1">
        <div class="price-row-reverse">
            <!-- Screen reader text (duplicated value, should be skipped) -->
            <div aria-hidden="true" style="position:absolute; left:-999px;">R$10.740,03</div>
            
            <!-- Visual price container -->
            <div class="visual-price">
              <span>R$</span>
              <span>10.740</span>
              <span>,03</span>
            </div>
        </div>
      </div>

      <!-- Case 2: Product page with PVR and Installments (should only badge the main price) -->
      <div class="product-price-container" data-type="price" id="card-2">
        <div class="main-price">R$960,39</div>
        <div class="pvr-price">PVR R$ 1.200,00</div>
        <div class="installment">Ou 6x R$ 160,06/mês</div>
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
  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    const badges = document.querySelectorAll('[data-aceita-tempo-badge="1"]');
    
    // Check Case 1: row-reverse positioning
    const card1 = document.querySelector('#card-1');
    const visualPrice = card1.querySelector('.visual-price');
    const badge1 = card1.querySelector('[data-aceita-tempo-badge="1"]');
    
    // In row-reverse, if badge is before visualPrice, it's visually to the right
    const isBadgeBefore = badge1 && visualPrice && (badge1.compareDocumentPosition(visualPrice) & Node.DOCUMENT_POSITION_FOLLOWING);

    // Check Case 2: PVR/Installment exclusion
    const card2 = document.querySelector('#card-2');
    const card2Badges = card2.querySelectorAll('[data-aceita-tempo-badge="1"]');

    return {
      totalBadges: badges.length,
      card1BadgeFound: !!badge1,
      isBadgeRightPos: !!isBadgeBefore,
      card2BadgeCount: card2Badges.length,
    };
  });

  console.log('Final Test State:', JSON.stringify(state, null, 2));

  assert.strictEqual(state.card1BadgeFound, true, 'Card 1 (row-reverse) should have a badge');
  assert.strictEqual(state.isBadgeRightPos, true, 'Card 1 badge should be before visual-price (visually right in row-reverse)');
  assert.strictEqual(state.card2BadgeCount, 1, `Card 2 should have exactly 1 badge (main price only), got ${state.card2BadgeCount}`);
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
//Jiuk