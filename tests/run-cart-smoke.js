const http = require('http');
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
  enableExternalSites: true,
};

const SCRIPT_FILES = [
  path.join(process.cwd(), 'src', 'price-utils.js'),
  path.join(process.cwd(), 'src', 'site-config.js'),
  path.join(process.cwd(), 'src', 'social-awareness.js'),
  path.join(process.cwd(), 'src', 'content.js'),
];

const HTML = `<!doctype html>
<html lang="pt-BR">
  <body>
    <h1>Resumo do pedido</h1>
    <div class="line-item">Produto A <span>R$ 129,90</span></div>
    <div class="line-item">Produto B <span>R$ 79,90</span></div>
    <div class="shipping">Frete <span>R$ 25,00</span></div>
    <div class="order-summary">
      <div>Subtotal</div>
      <div data-testid="order-total">R$ 234,80</div>
    </div>
  </body>
</html>`;

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

  for (const file of SCRIPT_FILES) {
    await page.addScriptTag({ content: fs.readFileSync(file, 'utf8') });
  }
}

async function main() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/cart.html`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await injectExtension(page);
    await page.waitForTimeout(2500);

    const result = await page.evaluate(() => {
      const badges = [...document.querySelectorAll('[data-aceita-tempo-badge="1"]')];
      const texts = badges.map((badge) => badge.textContent.trim());

      return {
        badgeCount: badges.length,
        allShortLabels: texts.every((text) => /^~/.test(text)),
        sampleTexts: texts.slice(0, 4),
      };
    });

    console.log(JSON.stringify({ site: 'cart-smoke', status: 'ok', ...result }));

    if (result.badgeCount !== 1 || !result.allShortLabels) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(JSON.stringify({ site: 'cart-smoke', status: 'error', error: error.message }));
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
