import fsp from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const STAGING_DIR = path.join(DIST_DIR, 'aceita-tempo');
const ZIP_PATH = path.join(DIST_DIR, 'aceita-tempo.zip');

const INCLUDE = [
  'manifest.json',
  'background.js',
  'options.html',
  'options.css',
  'options.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'src/content.js',
  'src/price-utils.js',
  'src/site-config.js',
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
  const destination = path.join(STAGING_DIR, relative);
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
