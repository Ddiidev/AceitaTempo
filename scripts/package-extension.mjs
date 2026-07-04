import fsp from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

const target = (process.argv[2] || 'chrome').toLowerCase();
const PACKAGE_TARGETS = {
  chrome: {
    manifest: 'manifest.json',
    staging: path.join(DIST_DIR, 'aceita-tempo-chrome'),
    zip: path.join(DIST_DIR, 'aceita-tempo-chrome.zip'),
  },
  firefox: {
    manifest: 'manifest.firefox.json',
    staging: path.join(DIST_DIR, 'aceita-tempo-firefox'),
    zip: path.join(DIST_DIR, 'aceita-tempo-firefox.zip'),
  },
};

const packageTarget = PACKAGE_TARGETS[target];

if (!packageTarget) {
  throw new Error(`Unknown package target: ${target}`);
}

const STAGING_DIR = packageTarget.staging;
const ZIP_PATH = packageTarget.zip;

const INCLUDE = [
  packageTarget.manifest,
  'background.js',
  'options.html',
  'options.css',
  'options.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'src/content.js',
  'src/price-utils.js',
  'src/social-awareness.js',
  'src/site-config.js',
  'src/affiliate.js',
  'src/i18n-utils.js',
  'onboarding.html',
  'onboarding.css',
  'onboarding.js',
  'pix-qrcode.png',
  'assets/onboarding-demo-product.png',
  'assets/onboarding-demo-tooltip.png',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  '_locales/en/messages.json',
  '_locales/pt_BR/messages.json',
];

async function cleanDir(target) {
  await fsp.rm(target, { recursive: true, force: true });
  await fsp.mkdir(target, { recursive: true });
}

async function copyTrackedFile(relative) {
  const source = path.join(ROOT, relative);
  const destination = path.join(STAGING_DIR, relative === packageTarget.manifest ? 'manifest.json' : relative);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.copyFile(source, destination);
}

function createZip() {
  if (process.platform === 'win32') {
    // Windows PowerShell
    return spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      `$ErrorActionPreference = 'Stop'; Compress-Archive -Path (Join-Path '${STAGING_DIR.replace(/'/g, "''")}' '*') -DestinationPath '${ZIP_PATH.replace(/'/g, "''")}' -Force`,
    ], { stdio: 'inherit', shell: false });
  }

  // macOS / Linux: native zip
  return spawnSync('zip', ['-r', ZIP_PATH, '.'], {
    stdio: 'inherit',
    shell: false,
    cwd: STAGING_DIR,
  });
}

async function main() {
  await cleanDir(STAGING_DIR);
  await fsp.rm(ZIP_PATH, { force: true });

  for (const relative of INCLUDE) {
    await copyTrackedFile(relative);
  }

  const zipResult = createZip();

  if (zipResult.status !== 0) {
    throw new Error('Failed to create zip package');
  }

  console.log(`created ${path.relative(ROOT, ZIP_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
