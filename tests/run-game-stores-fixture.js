const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SETTINGS = {
  salaryAmount: 1600,
  monthlyHours: 160,
  salaryCurrency: 'BRL',
  exchangeRateMode: 'auto',
  exchangeRateUsdToBrl: 5.5,
};

const SCRIPT_FILES = [
  path.join(process.cwd(), 'src', 'price-utils.js'),
  path.join(process.cwd(), 'src', 'site-config.js'),
  path.join(process.cwd(), 'src', 'social-awareness.js'),
  path.join(process.cwd(), 'src', 'content.js'),
];

function scaleFontSize(fontSize, scale = 0.4) {
  const size = Number.parseFloat(String(fontSize || '').replace(',', '.'));
  if (!Number.isFinite(size) || size <= 0) {
    return fontSize;
  }

  return `${Number((size * scale).toFixed(2)).toString()}px`;
}

async function injectScripts(page, replacePricesWithHours) {
  await page.evaluate(({ settings, replacePricesWithHours }) => {
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        storage: {
          sync: {
            get: (_keys, callback) => callback({ ...settings, replacePricesWithHours }),
          },
          local: {
            get: (_keys, callback) => callback({ ...settings, replacePricesWithHours }),
          },
          onChanged: {
            addListener: () => {},
          },
        },
      },
    });
  }, { settings: SETTINGS, replacePricesWithHours });

  for (const file of SCRIPT_FILES) {
    await page.addScriptTag({ content: fs.readFileSync(file, 'utf8') });
  }
}

async function loadFixture(page, url, html, css, replacePricesWithHours) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.unroute(url);

  if (css) {
    await page.addStyleTag({ content: css });
  }

  await injectScripts(page, replacePricesWithHours);
  await page.waitForTimeout(2500);
}

async function runSteamAssertions(page, replacePricesWithHours) {
  const html = String.raw`<!doctype html>
  <html lang="pt-BR">
    <body>
      <section id="steam-case-1">
        <a data-ds-appid="1133500" data-ds-itemkey="App_1133500" class="store_capsule daily_deal app_impression_tracked" href="https://store.steampowered.com/app/1133500/Overthrown/">
          <div class="discount_block daily_deal_discount discount_block_large" data-price-final="4439" data-discount="40" aria-label="40% de desconto. Preço original: R$ 73,99. Preço com desconto: R$ 44,39.">
            <div class="discount_pct">-40%</div>
            <div class="discount_prices">
              <div class="discount_original_price">R$ 73,99</div>
              <div class="discount_final_price">R$ 44,39</div>
            </div>
          </div>
        </a>
      </section>
      <section id="steam-case-2">
        <div class="home_area_spotlight responsive_scroll_snap_start app_impression_tracked">
          <div class="spotlight_content">
            <div class="spotlight_body spotlight_price price">
              <div class="discount_block discount_block_spotlight discount_block_large" data-price-final="4439" data-discount="40" aria-label="40% de desconto. Preço original: R$ 73,99. Preço com desconto: R$ 44,39.">
                <div class="discount_pct">-40%</div>
                <div class="discount_prices">
                  <div class="discount_original_price">R$ 73,99</div>
                  <div class="discount_final_price">R$ 44,39</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </body>
  </html>`;

  const css = `
    a.store_capsule { color: rgb(0, 0, 238); text-decoration: underline; }
    .discount_block, .discount_prices, .discount_pct, .discount_original_price, .discount_final_price, .spotlight_price { display: block; }
    .discount_original_price { color: rgb(124, 134, 146); font-size: 14px; text-decoration: line-through; }
    .discount_final_price { color: rgb(190, 238, 17); font-size: 20px; line-height: 20px; }
    .discount_pct { color: rgb(190, 238, 17); font-size: 18px; }
  `;

  await loadFixture(page, 'https://store.steampowered.com/', html, css, replacePricesWithHours);

  const state = await page.evaluate(() => {
    const read = (scopeId) => {
      const scope = document.querySelector(`#${scopeId}`);
      const finalPrice = scope.querySelector('.discount_final_price');
      const originalPrice = scope.querySelector('.discount_original_price');
      const badge = scope.querySelector('[data-aceita-tempo-badge="1"]');
      return {
        badgeCount: scope.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
        badgeText: badge?.textContent || '',
        badgeColor: badge ? getComputedStyle(badge).color : '',
        badgeFontSize: badge ? getComputedStyle(badge).fontSize : '',
        finalHidden: finalPrice?.getAttribute('data-aceita-tempo-hidden') || null,
        finalDisplay: finalPrice ? getComputedStyle(finalPrice).display : '',
        originalHidden: originalPrice?.getAttribute('data-aceita-tempo-hidden') || null,
      };
    };

    return {
      case1: read('steam-case-1'),
      case2: read('steam-case-2'),
    };
  });

  for (const current of [state.case1, state.case2]) {
    assert.strictEqual(current.badgeCount, 1, 'Steam fixture should render one badge per card');
    assert.ok(current.badgeText.startsWith('~'), 'Steam badge should show work duration');

    if (replacePricesWithHours) {
      assert.strictEqual(current.badgeColor, 'rgb(190, 238, 17)', 'Steam badge should keep the final price color instead of link blue');
      assert.strictEqual(current.badgeFontSize, scaleFontSize('20px', 0.75), 'Steam badge should use 75% of the final price size');
      assert.strictEqual(current.finalHidden, '1', 'Steam final price should be hidden in replace mode');
      assert.strictEqual(current.finalDisplay, 'none', 'Steam final price should not stay visible in replace mode');
      assert.strictEqual(current.originalHidden, null, 'Steam original price should remain visible');
    } else {
      assert.strictEqual(current.finalHidden, null, 'Steam final price should stay visible when not replacing');
    }
  }
}

async function runGogAssertions(page, replacePricesWithHours) {
  const html = String.raw`<!doctype html>
  <html lang="en">
    <body>
      <section id="gog-case-1">
        <product-tile>
          <a class="product-tile product-tile--grid" href="https://www.gog.com/en/game/dorfromantik">
            <div class="product-tile__info">
              <div class="product-tile__footer">
                <div class="product-tile__price-info">
                  <product-price>
                    <price-discount>-30%</price-discount>
                    <price-value>
                      <span class="base-value">\$5.69</span>
                      <span class="final-value">\$3.98</span>
                    </price-value>
                  </product-price>
                </div>
              </div>
            </div>
          </a>
        </product-tile>
      </section>
      <section id="gog-case-2">
        <product-tile>
          <a class="product-tile product-tile--grid" href="https://www.gog.com/en/game/no_discount">
            <div class="product-tile__info">
              <div class="product-tile__footer">
                <div class="product-tile__price-info">
                  <product-price>
                    <price-value>
                      <span class="final-value">$22.51</span>
                    </price-value>
                  </product-price>
                </div>
              </div>
            </div>
          </a>
        </product-tile>
      </section>
    </body>
  </html>`;

  const css = `
    .product-tile { display: block; color: rgb(232, 230, 227); }
    .product-tile__price-info, product-price, price-value { display: block; }
    price-discount { display: inline-block; color: rgb(134, 214, 0); font-size: 12px; }
    .base-value { color: rgb(138, 132, 126); font-size: 12px; text-decoration: line-through; }
    .final-value { color: rgb(255, 255, 255); font-size: 18px; line-height: 18px; }
  `;

  await loadFixture(page, 'https://www.gog.com/en/', html, css, replacePricesWithHours);

  const state = await page.evaluate(() => {
    const read = (scopeId) => {
      const scope = document.querySelector(`#${scopeId}`);
      const finalPrice = scope.querySelector('.final-value');
      const basePrice = scope.querySelector('.base-value');
      const badge = scope.querySelector('[data-aceita-tempo-badge="1"]');
      return {
        badgeCount: scope.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
        badgeText: badge?.textContent || '',
        finalHidden: finalPrice?.getAttribute('data-aceita-tempo-hidden') || null,
        finalDisplay: finalPrice ? getComputedStyle(finalPrice).display : '',
        baseHidden: basePrice?.getAttribute('data-aceita-tempo-hidden') || null,
      };
    };

    return {
      case1: read('gog-case-1'),
      case2: read('gog-case-2'),
    };
  });

  for (const current of [state.case1, state.case2]) {
    assert.strictEqual(current.badgeCount, 1, 'GOG fixture should render one badge per card');
    assert.ok(current.badgeText.startsWith('~'), 'GOG badge should show work duration');

    if (replacePricesWithHours) {
      assert.strictEqual(current.finalHidden, '1', 'GOG final price should be hidden in replace mode');
      assert.strictEqual(current.finalDisplay, 'none', 'GOG final price should not stay visible in replace mode');
    } else {
      assert.strictEqual(current.finalHidden, null, 'GOG final price should stay visible when not replacing');
    }
  }

  if (replacePricesWithHours) {
    assert.strictEqual(state.case1.baseHidden, null, 'GOG original price should remain visible');
  }
}

async function runEpicStyleAssertion(page) {
  const html = String.raw`<!doctype html>
  <html lang="en">
    <body>
      <section id="epic-case">
        <a class="offer-card" href="https://store.epicgames.com/en-US/p/example">
          <div class="offer-card__meta">Base Game</div>
          <div class="offer-card__price" data-testid="offer-price">
            <span class="offer-card__price-value">$24.99</span>
          </div>
        </a>
      </section>
    </body>
  </html>`;

  const css = `
    .offer-card { display: block; color: rgb(86, 115, 255); text-decoration: underline; }
    .offer-card__price { display: block; }
    .offer-card__price-value { color: rgb(252, 252, 252); font-size: 18px; line-height: 18px; }
  `;

  await loadFixture(page, 'https://store.epicgames.com/en-US/', html, css, true);

  const state = await page.evaluate(() => {
    const badge = document.querySelector('#epic-case [data-aceita-tempo-badge="1"]');
    const price = document.querySelector('#epic-case .offer-card__price-value');
    return {
      badgeText: badge?.textContent || '',
      badgeColor: badge ? getComputedStyle(badge).color : '',
      badgeFontSize: badge ? getComputedStyle(badge).fontSize : '',
      priceHidden: price?.getAttribute('data-aceita-tempo-hidden') || null,
    };
  });

  assert.ok(state.badgeText.startsWith('~'), 'Epic-style fixture should render work duration');
  assert.strictEqual(state.badgeColor, 'rgb(252, 252, 252)', 'Epic-style badge should use the price color instead of link blue');
  assert.strictEqual(state.badgeFontSize, scaleFontSize('18px', 0.75), 'Epic-style badge should use 75% of the price font size');
  assert.strictEqual(state.priceHidden, '1', 'Epic-style price should be hidden in replace mode');
}

async function runInstantGamingAssertions(page, replacePricesWithHours) {
  const html = String.raw`<!doctype html>
  <html lang="pt-BR">
    <body>
      <section id="instant-gaming-case">
        <a class="game-card" href="https://www.instant-gaming.com/br/1234-comprar-example/">
          <span class="game-card__title">Example Game</span>
          <span class="game-card__price price">R$ 89,99</span>
        </a>
      </section>
    </body>
  </html>`;

  const css = `
    .game-card { display: block; color: rgb(235, 235, 235); text-decoration: none; }
    .game-card__price { display: inline-block; color: rgb(255, 210, 74); font-size: 20px; line-height: 20px; }
  `;

  await loadFixture(page, 'https://www.instant-gaming.com/br/', html, css, replacePricesWithHours);

  const state = await page.evaluate(() => {
    const badge = document.querySelector('#instant-gaming-case [data-aceita-tempo-badge="1"]');
    const price = document.querySelector('#instant-gaming-case .game-card__price');
    return {
      badgeText: badge?.textContent || '',
      badgeColor: badge ? getComputedStyle(badge).color : '',
      badgeFontSize: badge ? getComputedStyle(badge).fontSize : '',
      priceHidden: price?.getAttribute('data-aceita-tempo-hidden') || null,
    };
  });

  assert.ok(state.badgeText.startsWith('~'), 'Instant Gaming fixture should render work duration');

  if (replacePricesWithHours) {
    assert.strictEqual(state.badgeColor, 'rgb(255, 210, 74)', 'Instant Gaming badge should keep the price color');
    assert.strictEqual(state.badgeFontSize, scaleFontSize('20px', 0.75), 'Instant Gaming badge should use 75% of the price font size');
    assert.strictEqual(state.priceHidden, '1', 'Instant Gaming price should be hidden in replace mode');
  } else {
    assert.strictEqual(state.priceHidden, null, 'Instant Gaming price should stay visible when not replacing');
  }
}

async function runSteamSearchAndCartAssertions(page) {
  const html = String.raw`<!doctype html>
  <html lang="pt-BR">
    <body>
      <!-- Search result item -->
      <div id="steam-search-row" class="search_result_row">
        <div class="col search_price_discount_combined">
          <div class="col search_price discounted responsive_secondrow">
            <span style="color: #888888;"><strike>R$ 107,99</strike></span><br>R$ 10,79
          </div>
        </div>
      </div>

      <!-- New React Cart item -->
      <div id="steam-new-cart-row" class="_3CartItem_12345">
        <div class="_1PriceDisplay_67890">R$ 59,99</div>
      </div>
      
      <!-- Market listing -->
      <div id="steam-market-item">
        <span class="market_listing_price market_listing_price_with_fee">R$ 1,50</span>
      </div>
    </body>
  </html>`;

  await loadFixture(page, 'https://store.steampowered.com/search/', html, '', false);

  const state = await page.evaluate(() => {
    const read = (id) => {
      const scope = document.querySelector(`#${id}`);
      const badge = scope.querySelector('[data-aceita-tempo-badge="1"]');
      return {
        badgeCount: scope.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
        badgeText: badge ? badge.textContent.trim() : '',
      };
    };

    return {
      search: read('steam-search-row'),
      cart: read('steam-new-cart-row'),
      market: read('steam-market-item'),
    };
  });

  assert.strictEqual(state.search.badgeCount, 1, 'Steam search row should have a badge');
  assert.ok(state.search.badgeText.startsWith('~'), 'Steam search badge should show duration');
  
  assert.strictEqual(state.cart.badgeCount, 1, 'Steam new cart row should have a badge');
  assert.ok(state.cart.badgeText.startsWith('~'), 'Steam cart badge should show duration');

  assert.strictEqual(state.market.badgeCount, 1, 'Steam market item should have a badge');
  assert.ok(state.market.badgeText.startsWith('~'), 'Steam market badge should show duration');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await runSteamAssertions(page, false);
    await runSteamAssertions(page, true);
    await runSteamSearchAndCartAssertions(page);
    await runGogAssertions(page, false);
    await runGogAssertions(page, true);
    await runInstantGamingAssertions(page, false);
    await runInstantGamingAssertions(page, true);
    await runEpicStyleAssertion(page);
    console.log('Game store fixture checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
