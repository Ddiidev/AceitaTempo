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

const FIXTURE_HTML = String.raw`<!doctype html>
<html lang="pt-BR">
  <body>
    <section id="case-1">
      <div class="_3gA8_ card-out-wrapper" style="width: 220px;">
        <a class="_3mPKP" href="#">
          <div class="_3jo5e">
            <div title="Fone De Ouvido Sem Fio Fone De Ouvido Bluetooth Celular" class="_2BLrX" tabindex="0" aria-label="Fone De Ouvido Sem Fio Fone De Ouvido Bluetooth Celular" role="heading" aria-level="3" style="margin-top: 8px;">
              <h3 class="yB6en">Fone De Ouvido Sem Fio Fone De Ouvido Bluetooth Celular</h3>
            </div>
            <div class="_23lt5" tabindex="0" aria-label="R$6,99">
              <div class="_3Mpbo">
                <span style="font-size: 20px; color: rgb(240, 6, 51);">R$</span>
                <span style="font-size: 20px; color: rgb(240, 6, 51);">6</span>
                <span style="font-size: 20px; color: rgb(240, 6, 51);">,</span>
                <span style="font-size: 20px; color: rgb(240, 6, 51);">99</span>
              </div>
              <div class="_3DRNh">
                <span style="text-decoration: line-through; color: rgb(96, 100, 114); font-size: 14px;">R$37,88</span>
              </div>
              <span class="W__kt"> -81%</span>
            </div>
            <div class="nuPN3">
              <div class="FNjFR"><span class="_3SaXM" title="R$18 OFF em R$100" style="color: rgb(240, 6, 51);">R$18 OFF em R$100</span></div>
              <div class="FNjFR"><span class="_3SaXM" title="Novo usuário - R$30,89 OFF" style="color: rgb(211, 3, 28);">Novo usuário - R$30,89 OFF</span></div>
            </div>
          </div>
        </a>
      </div>
    </section>

    <section id="case-2">
      <div class="_9HTSH">
        <div class="_3gA8_ card-out-wrapper">
          <a class="_3mPKP" href="#">
            <div class="_3jo5e">
              <div title="Bolsa de ombro feminina tecida à mão de palha" class="_2BLrX" tabindex="0" aria-label="Bolsa de ombro feminina tecida à mão de palha" role="heading" aria-level="3" style="margin-top: 8px;">
                <h3 class="yB6en">Bolsa de ombro feminina tecida à mão de palha</h3>
              </div>
              <div class="_23lt5" tabindex="0" aria-label="R$5,99">
                <div class="_3Mpbo">
                  <span style="font-size: 20px;">R$</span>
                  <span style="font-size: 20px;">5</span>
                  <span style="font-size: 20px;">,</span>
                  <span style="font-size: 20px;">99</span>
                </div>
              </div>
              <div class="_15juk"><span class="DUuR2">3.000+ vendido(s)</span></div>
              <div class="nuPN3">
                <div class="FNjFR"><span class="_3SaXM" title="Poupe R$35,2" style="color: rgb(240, 6, 51);">Poupe R$35,2</span></div>
                <div class="_2Ctjr"><span class="_2BLrX">Combos de ofertas</span></div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  </body>
</html>`;

async function injectExtension(page, replacePricesWithHours) {
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

async function loadFixture(page, replacePricesWithHours) {
  await page.goto('https://pt.aliexpress.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.setContent(FIXTURE_HTML);
  await page.addStyleTag({
    content: `
      body { font-family: Arial, sans-serif; }
      section { margin: 24px; }
      ._23lt5, ._3jo5e, .nuPN3, .FNjFR { display: block; }
      ._3Mpbo, ._3DRNh, .W__kt { display: inline-block; }
    `,
  });
  await injectExtension(page, replacePricesWithHours);
  await page.waitForTimeout(2500);
}

async function getCaseState(page, caseId) {
  return page.evaluate((id) => {
    const scope = document.querySelector(`#${id}`);
    const currentPrice = scope.querySelector('._23lt5 ._3Mpbo, .lw_kt');
    const oldPrice = scope.querySelector('._3DRNh');
    const badge = scope.querySelector('[data-aceita-tempo-badge="1"]');

    return {
      badgeCount: scope.querySelectorAll('[data-aceita-tempo-badge="1"]').length,
      badgeText: badge?.textContent || '',
      badgeFontFamily: badge ? getComputedStyle(badge).fontFamily : '',
      badgeFontSize: badge ? getComputedStyle(badge).fontSize : '',
      badgeInsidePriceRow: Boolean(badge && badge.closest('._23lt5')),
      currentFontFamily: currentPrice ? getComputedStyle(currentPrice).fontFamily : '',
      currentHidden: currentPrice?.getAttribute('data-aceita-tempo-hidden') || null,
      currentDisplay: currentPrice ? getComputedStyle(currentPrice).display : '',
      oldHidden: oldPrice?.getAttribute('data-aceita-tempo-hidden') || null,
      oldDisplay: oldPrice ? getComputedStyle(oldPrice).display : '',
    };
  }, caseId);
}

async function runModeAssertions(page, replacePricesWithHours) {
  await loadFixture(page, replacePricesWithHours);
  const case1 = await getCaseState(page, 'case-1');
  const case2 = await getCaseState(page, 'case-2');

  assert.strictEqual(case1.badgeCount, 1, 'case-1 should render exactly one badge');
  assert.strictEqual(case2.badgeCount, 1, 'case-2 should render exactly one badge');
  assert.ok(case1.badgeText.startsWith('~'), 'case-1 badge should show work duration');
  assert.ok(case2.badgeText.startsWith('~'), 'case-2 badge should show work duration');
  assert.ok(case1.badgeInsidePriceRow, 'case-1 badge should stay inside the price row');
  assert.ok(case2.badgeInsidePriceRow, 'case-2 badge should stay inside the price row');

  if (replacePricesWithHours) {
    assert.strictEqual(case1.currentHidden, '1', 'case-1 current price should be hidden in replace mode');
    assert.strictEqual(case2.currentHidden, '1', 'case-2 current price should be hidden in replace mode');
    assert.strictEqual(case1.currentDisplay, 'none', 'case-1 current price should not remain visible in replace mode');
    assert.strictEqual(case2.currentDisplay, 'none', 'case-2 current price should not remain visible in replace mode');
    assert.strictEqual(case1.oldHidden, null, 'case-1 old price must remain visible');
    assert.notStrictEqual(case1.oldDisplay, 'none', 'case-1 old price must not be hidden');
    assert.strictEqual(case1.badgeFontFamily, case1.currentFontFamily, 'badge should match the current price font family');
    assert.strictEqual(case1.badgeFontSize, '15px', 'replace mode badge should use 75% of the current price size');
    assert.strictEqual(case2.badgeFontSize, '15px', 'replace mode badge should use 75% of the current price size');
  } else {
    assert.strictEqual(case1.currentHidden, null, 'case-1 current price should remain visible in badge mode');
    assert.strictEqual(case2.currentHidden, null, 'case-2 current price should remain visible in badge mode');
    assert.strictEqual(case1.oldHidden, null, 'case-1 old price should remain visible in badge mode');
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await runModeAssertions(page, false);
    await runModeAssertions(page, true);
    console.log('AliExpress fixture checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
