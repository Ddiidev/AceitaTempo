import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUTPUT_SCREENSHOTS_DIR = path.join(ROOT, 'store', 'screenshots');
const OUTPUT_PROMO_DIR = path.join(ROOT, 'store', 'promotional');
const OPTIONS_CSS_PATH = path.join(ROOT, 'options.css');
const SCRIPT_FILES = [
  path.join(ROOT, 'src', 'price-utils.js'),
  path.join(ROOT, 'src', 'site-config.js'),
  path.join(ROOT, 'src', 'content.js'),
];
const PT_MESSAGES_PATH = path.join(ROOT, '_locales', 'pt_BR', 'messages.json');
const LOGO_SVG_PATH = path.join(ROOT, 'assets', 'logo.svg');
let optionsCss = '';

const SETTINGS_OPTIONS = {
  salaryAmount: 5000,
  monthlyHours: 160,
  salaryCurrency: 'BRL',
  replacePricesWithHours: false,
  enableExternalSites: false,
  disabledSiteNames: ['Amazon'],
  exchangeRateMode: 'manual',
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: '2026-03-19T12:00:00.000Z',
};

const SETTINGS_MARKET = {
  salaryAmount: 5000,
  monthlyHours: 160,
  salaryCurrency: 'BRL',
  replacePricesWithHours: false,
  enableExternalSites: true,
  disabledSiteNames: [],
  exchangeRateMode: 'manual',
  manualUsdToBrlRate: 5.5,
  exchangeRateUsdToBrl: 5.5,
  exchangeRateFetchedAt: '2026-03-19T12:00:00.000Z',
};

function toDataUri(svgMarkup) {
  return `data:image/svg+xml;base64,${Buffer.from(svgMarkup).toString('base64')}`;
}

function installChromeMock({ settings, messages, locale }) {
  const substitute = (message, substitutions = []) => {
    let result = String(message || '');
    substitutions.forEach((value, index) => {
      const token = new RegExp(`\\$${index + 1}`, 'g');
      result = result.replace(token, String(value));
    });
    return result;
  };

  window.chrome = {
    i18n: {
      getUILanguage: () => locale,
      getMessage: (key, substitutions = []) => {
        const entry = messages?.[key]?.message;
        return entry ? substitute(entry, substitutions) : '';
      },
    },
    runtime: {
      sendMessage: (_message, callback) => {
        if (typeof callback === 'function') {
          callback({ ok: true, settings: { ...settings } });
        }
      },
    },
    storage: {
      sync: {
        get: (_keys, callback) => callback({ ...settings }),
        set: (_values, callback) => callback?.(),
      },
      local: {
        get: (_keys, callback) => callback({ ...settings }),
        set: (_values, callback) => callback?.(),
      },
      onChanged: {
        addListener: () => {},
      },
    },
  };
}

async function loadScriptBundle(page) {
  for (const file of SCRIPT_FILES) {
    await page.addScriptTag({ content: await fs.readFile(file, 'utf8') });
  }
}

async function screenshot(page, html, outputPath, viewport) {
  await page.setViewportSize(viewport);
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: outputPath, fullPage: false });
}

async function loadMockUrl(page, url, html) {
  await page.route(url, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: html,
    });
  });

  await page.goto(url, { waitUntil: 'load' });
}

function makeHeader() {
  return `
    <header class="topbar">
      <div class="brand">
        <img src="${toDataUri(logoSvg)}" alt="AceitaTempo" />
      </div>
      <div class="topbar__pill">Converta preços em horas</div>
    </header>
  `;
}

function productHtml() {
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root {
            color-scheme: light;
            --text: #0f172a;
            --muted: #475569;
            --line: rgba(15, 23, 42, 0.12);
            --green: #10b981;
            --bg: #f8fafc;
          }

          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Inter, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            background:
              radial-gradient(circle at top left, rgba(16, 185, 129, 0.16), transparent 28%),
              linear-gradient(180deg, #f8fafc 0%, #eef7f4 100%);
            color: var(--text);
          }
          main {
            max-width: 1280px;
            margin: 0 auto;
            padding: 24px;
          }
          ${sharedStyles()}
          .product-shell {
            display: grid;
            grid-template-columns: 420px 1fr;
            gap: 28px;
            margin-top: 24px;
            align-items: start;
          }
          .gallery {
            min-height: 420px;
            padding: 24px;
            border-radius: 28px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid var(--line);
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          }
          .image {
            height: 372px;
            border-radius: 22px;
            background:
              linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(16, 185, 129, 0.55)),
              radial-gradient(circle at 35% 35%, rgba(255,255,255,0.22), transparent 32%);
            position: relative;
            overflow: hidden;
          }
          .image::after {
            content: "";
            position: absolute;
            inset: 24px;
            border-radius: 18px;
            border: 2px solid rgba(255,255,255,0.24);
          }
          .details {
            padding: 12px 6px 0;
          }
          .kicker {
            display: inline-flex;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(16, 185, 129, 0.12);
            color: #065f46;
            font-size: 13px;
            font-weight: 700;
          }
          h1 {
            margin: 14px 0 8px;
            font-size: 42px;
            line-height: 1.05;
          }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            color: var(--muted);
          }
          .price-row {
            display: flex;
            align-items: baseline;
            gap: 12px;
            margin-top: 18px;
            font-variant-numeric: tabular-nums;
          }
          .old-price {
            color: #64748b;
            text-decoration: line-through;
            font-size: 18px;
          }
          .price {
            display: inline-flex;
            align-items: baseline;
            gap: 4px;
            font-size: 34px;
            font-weight: 800;
            color: #0f172a;
          }
          .price .currency {
            font-size: 18px;
            font-weight: 700;
          }
          .cta {
            margin-top: 24px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 14px 20px;
            border-radius: 999px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            font-weight: 800;
            box-shadow: 0 14px 30px rgba(16, 185, 129, 0.28);
          }
        </style>
      </head>
      <body>
        <main>
          ${makeHeader()}
          <section class="product-shell">
            <div class="gallery">
              <div class="image"></div>
            </div>
            <div class="details">
              <span class="kicker">Marketplace de exemplo</span>
              <h1>Headset Bluetooth Pro 5.3</h1>
              <div class="meta">
                <span>4.8 ★★★★★</span>
                <span>Entrega rápida</span>
                <span>12x sem juros</span>
              </div>
              <div class="price-row">
                <span class="old-price">R$ 399,90</span>
                <span class="price" itemprop="price" data-testid="product-price">
                  <span class="currency">R$</span><span>249,90</span>
                </span>
              </div>
              <div class="cta">Adicionar ao carrinho</div>
            </div>
          </section>
        </main>
      </body>
    </html>`;
}

function checkoutHtml() {
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root {
            color-scheme: light;
            --text: #0f172a;
            --muted: #475569;
            --line: rgba(15, 23, 42, 0.12);
            --green: #10b981;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Inter, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(180deg, #f8fafc, #ecf7f4);
            color: var(--text);
          }
          main {
            max-width: 1280px;
            margin: 0 auto;
            padding: 24px;
          }
          ${sharedStyles()}
          .checkout {
            margin-top: 24px;
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 20px;
            align-items: start;
          }
          .panel {
            padding: 22px;
            border-radius: 28px;
            background: rgba(255,255,255,0.92);
            border: 1px solid var(--line);
            box-shadow: 0 18px 50px rgba(15,23,42,0.08);
          }
          .line {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 16px 0;
            border-bottom: 1px solid var(--line);
            color: var(--muted);
          }
          .line strong {
            color: var(--text);
          }
          .summary-title {
            margin: 0 0 18px;
            font-size: 28px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding-top: 18px;
          }
          .total-label {
            font-size: 24px;
            font-weight: 700;
          }
          .total {
            display: inline-flex;
            align-items: baseline;
            gap: 4px;
            font-size: 40px;
            font-weight: 900;
            font-variant-numeric: tabular-nums;
          }
          .total .currency {
            font-size: 18px;
          }
          .sidebar {
            background: linear-gradient(180deg, rgba(16,185,129,0.14), rgba(255,255,255,0.92));
          }
          .sidebar h2 {
            margin: 0 0 12px;
            font-size: 24px;
          }
          .pill {
            display: inline-flex;
            margin-top: 10px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(16, 185, 129, 0.14);
            color: #065f46;
            font-weight: 700;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <main>
          ${makeHeader()}
          <section class="checkout">
            <div class="panel">
              <h1 class="summary-title">Resumo do pedido</h1>
              <div class="line"><span>Mouse sem fio</span><strong>R$ 89,90</strong></div>
              <div class="line"><span>Teclado mecânico</span><strong>R$ 279,90</strong></div>
              <div class="line"><span>Frete</span><strong>R$ 19,90</strong></div>
              <div class="total-row">
                <span class="total-label">Valor total</span>
                <span class="total" data-testid="order-total" itemprop="price">
                  <span class="currency">R$</span><span>389,70</span>
                </span>
              </div>
            </div>
            <aside class="panel sidebar">
              <h2>Finalizar compra</h2>
              <p>Veja o total convertido em horas antes de concluir o pagamento.</p>
              <span class="pill">Checkout convertido</span>
            </aside>
          </section>
        </main>
      </body>
    </html>`;
}

function sharedStyles() {
  return `
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 22px;
      background: rgba(255,255,255,0.92);
      border: 1px solid rgba(15, 23, 42, 0.12);
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
    }
    .brand img {
      width: 220px;
      height: auto;
      display: block;
    }
    .topbar__pill {
      display: inline-flex;
      align-items: center;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.12);
      color: #065f46;
      font-weight: 700;
      font-size: 14px;
      white-space: nowrap;
    }
  `;
}

function promoHtml({ width, height, title, subtitle, cta, small = false }) {
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root {
            color-scheme: light;
            --text: #0f172a;
            --muted: rgba(15, 23, 42, 0.76);
            --card: rgba(255,255,255,0.92);
            --green: #10b981;
            --green-dark: #059669;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            font-family: Inter, Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            background:
              radial-gradient(circle at top left, rgba(16, 185, 129, 0.24), transparent 34%),
              radial-gradient(circle at bottom right, rgba(15, 23, 42, 0.12), transparent 28%),
              linear-gradient(135deg, #0f172a 0%, #0f766e 100%);
            color: var(--text);
          }
          .frame {
            width: 100%;
            height: 100%;
            padding: ${small ? 24 : 34}px;
          }
          .card {
            width: 100%;
            height: 100%;
            border-radius: ${small ? 26 : 34}px;
            background: var(--card);
            border: 1px solid rgba(255,255,255,0.24);
            box-shadow: 0 22px 60px rgba(0, 0, 0, 0.22);
            padding: ${small ? 20 : 34}px;
            display: grid;
            grid-template-columns: ${small ? '1.1fr 0.9fr' : '1.15fr 0.85fr'};
            gap: ${small ? 18 : 28}px;
            align-items: center;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 18px;
            margin-bottom: 18px;
          }
          .brand img {
            width: ${small ? 180 : 270}px;
            height: auto;
            display: block;
          }
          .eyebrow {
            margin: 0 0 8px;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: #059669;
            font-size: ${small ? 11 : 13}px;
            font-weight: 800;
          }
          h1 {
            margin: 0;
            font-size: ${small ? 28 : 52}px;
            line-height: 1.02;
            letter-spacing: -0.04em;
          }
          .lead {
            margin: 14px 0 0;
            color: rgba(15, 23, 42, 0.7);
            font-size: ${small ? 14 : 22}px;
            line-height: 1.5;
            max-width: 18ch;
          }
          .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 18px;
          }
          .chip {
            padding: ${small ? '8px 11px' : '10px 14px'};
            border-radius: 999px;
            background: rgba(16,185,129,0.12);
            color: #065f46;
            font-weight: 800;
            font-size: ${small ? 12 : 16}px;
          }
          .preview {
            align-self: stretch;
            border-radius: ${small ? 24 : 32}px;
            background:
              linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,118,110,0.76)),
              linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0));
            color: white;
            padding: ${small ? 18 : 28}px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
          }
          .preview::before {
            content: '';
            position: absolute;
            inset: auto -18% -22% auto;
            width: 240px;
            height: 240px;
            border-radius: 50%;
            background: rgba(255,255,255,0.08);
          }
          .preview__label {
            display: inline-flex;
            align-self: flex-start;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255,255,255,0.14);
            font-size: ${small ? 11 : 14}px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .preview__price {
            margin-top: auto;
            display: flex;
            align-items: baseline;
            gap: 8px;
            font-variant-numeric: tabular-nums;
          }
          .preview__price .currency {
            font-size: ${small ? 16 : 22}px;
            color: rgba(255,255,255,0.82);
          }
          .preview__price .value {
            font-size: ${small ? 34 : 58}px;
            font-weight: 900;
          }
          .preview__badge {
            display: inline-flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255,255,255,0.12);
            color: white;
            font-size: ${small ? 13 : 18}px;
            font-weight: 800;
            margin-left: 10px;
          }
          .preview__note {
            margin-top: 10px;
            color: rgba(255,255,255,0.82);
            font-size: ${small ? 12 : 16}px;
            line-height: 1.45;
            max-width: 22ch;
          }
          .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: ${small ? '10px 14px' : '14px 20px'};
            border-radius: 999px;
            background: linear-gradient(135deg, var(--green), var(--green-dark));
            color: white;
            font-weight: 800;
            font-size: ${small ? 13 : 18}px;
            box-shadow: 0 14px 30px rgba(16, 185, 129, 0.24);
            margin-top: ${small ? 14 : 20}px;
          }
          .subline {
            margin-top: 8px;
            color: rgba(15,23,42,0.66);
            font-size: ${small ? 12 : 16}px;
            line-height: 1.45;
          }
          @media (max-width: 900px) {
            .card {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="frame">
          <div class="card">
            <section>
              <div class="brand">
                <img src="${toDataUri(logoSvg)}" alt="AceitaTempo" />
              </div>
              <p class="eyebrow">Chrome Extension</p>
              <h1>${title}</h1>
              <p class="lead">${subtitle}</p>
              <div class="chips">
                <span class="chip">Preço → horas</span>
                <span class="chip">Checkout</span>
                <span class="chip">Sem servidor</span>
              </div>
              <div class="button">${cta}</div>
              <div class="subline">Converte valores em tempo de trabalho com base no seu salário.</div>
            </section>
            <aside class="preview">
              <span class="preview__label">Prévia da extensão</span>
              <div>
                <div class="preview__price">
                  <span class="currency">R$</span>
                  <span class="value">249,90</span>
                  <span class="preview__badge">~4h 5m</span>
                </div>
                <div class="preview__note">
                  Visualização do badge ao lado do preço, com o chip compacto e transparente.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </body>
    </html>`;
}

let logoSvg = '';

async function main() {
  await fs.mkdir(OUTPUT_SCREENSHOTS_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_PROMO_DIR, { recursive: true });

  const [priceUtils, siteConfig, contentScript, messages] = await Promise.all([
    fs.readFile(SCRIPT_FILES[0], 'utf8'),
    fs.readFile(SCRIPT_FILES[1], 'utf8'),
    fs.readFile(SCRIPT_FILES[2], 'utf8'),
    fs.readFile(PT_MESSAGES_PATH, 'utf8').then((value) => JSON.parse(value)),
  ]);
  optionsCss = await fs.readFile(OPTIONS_CSS_PATH, 'utf8');
  logoSvg = await fs.readFile(LOGO_SVG_PATH, 'utf8');

  const browser = await chromium.launch({ headless: true });

  try {
    await renderOptionsScreenshot(browser, messages);
    await renderProductScreenshot(browser, priceUtils, siteConfig, contentScript);
    await renderCheckoutScreenshot(browser, priceUtils, siteConfig, contentScript);
    await renderPromoImages(browser);
  } finally {
    await browser.close();
  }
}

async function renderOptionsScreenshot(browser, messages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(optionsMockHtml(), { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUTPUT_SCREENSHOTS_DIR, '01-options.png'), fullPage: false });
    console.log('generated store/screenshots/01-options.png');
  } finally {
    await page.close();
  }
}

async function renderProductScreenshot(browser, priceUtils, siteConfig, contentScript) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await loadMockUrl(page, 'https://store.test/product', productHtml());
    await page.evaluate(installChromeMock, {
      settings: SETTINGS_MARKET,
      messages: {},
      locale: 'pt-BR',
    });
    await page.addScriptTag({ content: priceUtils });
    await page.addScriptTag({ content: siteConfig });
    await page.addScriptTag({ content: contentScript });
    await page.waitForFunction(() => Boolean(document.querySelector('[data-aceita-tempo-badge="1"]')));
    await page.screenshot({ path: path.join(OUTPUT_SCREENSHOTS_DIR, '02-product.png'), fullPage: false });
    console.log('generated store/screenshots/02-product.png');
  } finally {
    await page.close();
  }
}

async function renderCheckoutScreenshot(browser, priceUtils, siteConfig, contentScript) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  try {
    await loadMockUrl(page, 'https://store.test/checkout', checkoutHtml());
    await page.evaluate(installChromeMock, {
      settings: SETTINGS_MARKET,
      messages: {},
      locale: 'pt-BR',
    });
    await page.addScriptTag({ content: priceUtils });
    await page.addScriptTag({ content: siteConfig });
    await page.addScriptTag({ content: contentScript });
    await page.waitForFunction(() => Boolean(document.querySelector('[data-aceita-tempo-badge="1"]')));
    await page.screenshot({ path: path.join(OUTPUT_SCREENSHOTS_DIR, '03-checkout.png'), fullPage: false });
    console.log('generated store/screenshots/03-checkout.png');
  } finally {
    await page.close();
  }
}

async function renderPromoImages(browser) {
  const small = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  const marquee = await browser.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 1 });

  try {
    await small.setContent(promoHtml({
      width: 440,
      height: 280,
      title: 'Converta preços em tempo real.',
      subtitle: 'Badge curto, hover com detalhes e controle total nas opções.',
      cta: 'AceitaTempo para Chrome',
      small: true,
    }), { waitUntil: 'load' });
    await small.screenshot({ path: path.join(OUTPUT_PROMO_DIR, 'small-promo-440x280.png'), fullPage: false });
    console.log('generated store/promotional/small-promo-440x280.png');

    await marquee.setContent(promoHtml({
      width: 1400,
      height: 560,
      title: 'Preço em horas de trabalho, direto no navegador.',
      subtitle: 'AceitaTempo ajuda você a comparar compras com o seu tempo, com badge compacto, hover detalhado e controles por site.',
      cta: 'Extensão pronta para publicar',
      small: false,
    }), { waitUntil: 'load' });
    await marquee.screenshot({ path: path.join(OUTPUT_PROMO_DIR, 'marquee-1400x560.png'), fullPage: false });
    console.log('generated store/promotional/marquee-1400x560.png');
  } finally {
    await small.close();
    await marquee.close();
  }
}

function optionsMockHtml() {
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          ${optionsCss}

          :root {
            --page-bg: linear-gradient(180deg, #f8fafc 0%, #eef7f4 100%);
            --shadow-strong: 0 18px 50px rgba(15, 23, 42, 0.08);
            --shadow-soft: 0 12px 24px rgba(16, 185, 129, 0.12);
          }

          body {
            background: var(--page-bg);
            padding: 24px;
          }

          .shell {
            max-width: 1150px;
            margin: 0 auto;
          }

          .hero.card {
            display: grid;
            gap: 12px;
            padding: 28px;
            margin-bottom: 20px;
          }

          .hero h1 {
            font-size: 38px;
            line-height: 1.05;
          }

          .hero p {
            max-width: 64ch;
            font-size: 17px;
          }

          .card {
            box-shadow: var(--shadow-strong);
          }

          .form {
            display: grid;
            gap: 18px;
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .field {
            min-height: 64px;
          }

          .field input,
          .field select {
            height: 48px;
          }

          .toggle-field {
            padding: 16px 18px;
          }

          .toggle-title {
            font-size: 16px;
          }

          .toggle-desc {
            font-size: 13px;
          }

          .site-block {
            margin-top: 4px;
          }

          .site-block__header {
            margin-bottom: 10px;
          }

          .site-block__body {
            max-height: 170px;
            overflow: hidden;
            position: relative;
            border-radius: 18px;
            border: 1px solid rgba(15, 23, 42, 0.08);
            background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72));
          }

          .site-block__body::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 52px;
            background: linear-gradient(180deg, rgba(255,255,255,0), rgba(248,250,252,1));
            pointer-events: none;
          }

          .site-grid {
            padding: 16px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .site-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.03);
            border: 1px solid rgba(15, 23, 42, 0.08);
          }

          .site-card strong {
            display: block;
            font-size: 14px;
          }

          .site-card span {
            color: #64748b;
            font-size: 12px;
          }

          .site-block__toggle {
            margin-top: 10px;
            position: relative;
            padding-right: 40px;
          }

          .site-block__toggle::after {
            content: "⌄";
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 20px;
            line-height: 1;
          }

          .actions {
            margin-top: 6px;
          }
        </style>
      </head>
      <body>
        <div class="form-dock" aria-label="Ações da tela de configuração">
          <div class="form-dock-content">
            <p id="status" class="status sr-only" role="status" aria-live="polite"></p>

            <div id="saveToast" class="save-feedback" hidden role="status" aria-live="polite" aria-atomic="true">
              <span class="save-feedback__icon" aria-hidden="true"></span>
              <div class="save-feedback__copy">
                <strong id="saveToastTitle" class="save-feedback__title"></strong>
                <span id="saveToastMessage" class="save-feedback__message"></span>
              </div>
            </div>

            <div class="actions actions--dock">
              <button type="submit" id="saveButton" form="settingsForm" class="primary action-button">
                <span id="saveButtonLabel" class="action-button__label">Salvar</span>
              </button>
              <button type="button" id="resetButton" class="secondary action-button">
                <span id="resetButtonLabel" class="action-button__label">Restaurar padrão</span>
              </button>
            </div>
          </div>
        </div>
        <main class="shell">
          <section class="hero card">
            <div class="eyebrow">Extensão Chrome</div>
            <h1>AceitaTempo</h1>
            <p>Converta preços em horas de trabalho enquanto navega. Ajuste salário, câmbio e comportamento por site nas opções.</p>
          </section>

          <section class="card">
            <div class="form">
              <div class="grid">
                <label class="field">
                  <span>Salário mensal</span>
                  <input value="5000" />
                </label>
                <label class="field">
                  <span>Moeda do salário</span>
                  <select><option>BRL</option></select>
                </label>
                <label class="field">
                  <span>Horas trabalhadas por mês</span>
                  <input value="160" />
                </label>
                <label class="field field-wide toggle-field">
                  <span class="toggle-copy">
                    <span class="toggle-title">Substituir preços por horas de trabalho</span>
                    <span class="toggle-desc">Ative para esconder o preço e mostrar apenas o tempo necessário para comprar o produto.</span>
                  </span>
                  <span class="switch"><span class="switch-track" aria-hidden="true"></span></span>
                </label>
                <label class="field field-wide toggle-field">
                  <span class="toggle-copy">
                    <span class="toggle-title">Ativar em sites externos</span>
                    <span class="toggle-desc">Marque para permitir a extensão em páginas que não batem com a heurística interna.</span>
                  </span>
                  <span class="switch"><span class="switch-track" aria-hidden="true"></span></span>
                </label>
                <label class="field">
                  <span>Modo de câmbio</span>
                  <select><option>Manual</option></select>
                </label>
                <label class="field field-wide">
                  <span>Taxa USD → BRL</span>
                  <input value="5,50" />
                </label>
              </div>

              <section class="site-block">
                <div class="site-block__header">
                  <h2>Desativar sites manualmente</h2>
                  <p>Desmarque o site para desligar a extensão naquela loja.</p>
                </div>
                <div class="site-block__body">
                  <div id="siteToggles" class="site-grid">
                    <label class="site-card"><span><strong>Amazon</strong><span>Ativo</span></span><span class="switch"><span class="switch-track" aria-hidden="true"></span></span></label>
                    <label class="site-card"><span><strong>Mercado Livre</strong><span>Ativo</span></span><span class="switch"><span class="switch-track" aria-hidden="true"></span></span></label>
                    <label class="site-card"><span><strong>Magazine Luiza</strong><span>Ativo</span></span><span class="switch"><span class="switch-track" aria-hidden="true"></span></span></label>
                    <label class="site-card"><span><strong>AliExpress</strong><span>Ativo</span></span><span class="switch"><span class="switch-track" aria-hidden="true"></span></span></label>
                    <label class="site-card"><span><strong>Shopee</strong><span>Ativo</span></span><span class="switch"><span class="switch-track" aria-hidden="true"></span></span></label>
                    <label class="site-card"><span><strong>Steam</strong><span>Ativo</span></span><span class="switch"><span class="switch-track" aria-hidden="true"></span></span></label>
                  </div>
                </div>
                <button class="site-block__toggle" type="button">Mostrar mais</button>
              </section>
            </div>
          </section>
        </main>
      </body>
    </html>`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
