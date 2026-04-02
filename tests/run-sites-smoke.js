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

const ARTIFACT_DIR = path.join(process.cwd(), 'playwright-artifacts');
const SCRIPT_FILES = [
  path.join(process.cwd(), 'src', 'price-utils.js'),
  path.join(process.cwd(), 'src', 'site-config.js'),
  path.join(process.cwd(), 'src', 'social-awareness.js'),
  path.join(process.cwd(), 'src', 'content.js'),
];

const SITES = [
  { key: 'amazon', url: 'https://www.amazon.com/' },
  { key: 'magalu', url: 'https://www.magazineluiza.com.br/' },
  { key: 'shopee', url: 'https://shopee.com/' },
  { key: 'ebay', url: 'https://www.ebay.com/' },
  { key: 'aliexpress', url: 'https://aliexpress.com/' },
  { key: 'shein', url: 'https://shein.com/' },
  { key: 'armazem-paraiba', url: 'https://www.armazemparaiba.com.br/' },
  { key: 'americanas', url: 'https://www.americanas.com.br/' },
  { key: 'mercado-livre', url: 'https://www.mercadolivre.com.br/' },
  { key: 'temu', url: 'https://www.temu.com/' },
  { key: 'alibaba', url: 'https://www.alibaba.com/' },
];

async function injectExtension(page, scripts) {
  await page.evaluate((settings) => {
    window.chrome = {
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
    };
  }, SETTINGS);

  for (const script of scripts) {
    await page.addScriptTag({ content: script });
  }
}

async function collectStats(page) {
  return page.evaluate(() => {
    const badges = [...document.querySelectorAll('[data-aceita-tempo-badge="1"]')];
    const texts = badges.map((badge) => badge.textContent.trim());
    const tooltips = badges.map((badge) => badge.title.trim()).filter(Boolean);

    return {
      badgeCount: badges.length,
      allShortLabels: texts.every((text) => /^~/.test(text)),
      tooltipCount: tooltips.length,
      sampleTexts: texts.slice(0, 10),
      sampleTooltips: tooltips.slice(0, 4),
    };
  });
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const scripts = SCRIPT_FILES.map((file) => fs.readFileSync(file, 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const results = [];

  for (const site of SITES) {
    try {
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      await injectExtension(page, scripts);
      await page.waitForTimeout(1800);
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(2200);

      const stats = await collectStats(page);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `${site.key}.png`),
        fullPage: false,
      });

      const result = { site: site.key, status: 'ok', ...stats };
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (error) {
      const result = { site: site.key, status: 'error', error: error.message };
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }

  await browser.close();

  const failing = results.filter((result) => result.status !== 'ok');
  if (failing.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
