import { spawnSync } from 'child_process';
import path from 'path';
import os from 'os';

const ROOT = process.cwd();
const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 800;

const FILES = [
  'store/screenshots/02-product.png',
  'store/screenshots/03-checkout.png',
];

function runPowerShell(script) {
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    script,
  ], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error('PowerShell image normalization failed');
  }
}

function buildScript(file) {
  const normalized = path.join(ROOT, file).replace(/'/g, "''");
  const tempPath = path.join(os.tmpdir(), `aceita-tempo-${path.basename(file)}`).replace(/'/g, "''");
  return `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing
    $path = '${normalized}'
    $temp = '${tempPath}'
    $img = [System.Drawing.Image]::FromFile($path)
    try {
      $targetWidth = ${TARGET_WIDTH}
      $targetHeight = ${TARGET_HEIGHT}
      $scale = [Math]::Min($targetWidth / $img.Width, $targetHeight / $img.Height)
      $scaledWidth = [int][Math]::Round($img.Width * $scale)
      $scaledHeight = [int][Math]::Round($img.Height * $scale)
      $offsetX = [int](($targetWidth - $scaledWidth) / 2)
      $offsetY = [int](($targetHeight - $scaledHeight) / 2)

      $bitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.DrawImage($img, $offsetX, $offsetY, $scaledWidth, $scaledHeight)
      } finally {
        $graphics.Dispose()
      }

      $bitmap.Save($temp, [System.Drawing.Imaging.ImageFormat]::Png)
      $bitmap.Dispose()
    } finally {
      $img.Dispose()
    }
    Copy-Item -Force $temp $path
    Remove-Item -Force $temp
    Write-Host ("normalized {0} -> {1}x{2}" -f $path, $targetWidth, $targetHeight)
  `;
}

for (const file of FILES) {
  runPowerShell(buildScript(file));
}
