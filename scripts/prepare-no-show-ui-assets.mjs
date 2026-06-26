/**
 * Generates No-Show Reel UI assets: iPhone 15 Pro frame, blurred shop bg.
 * Clock face uses images/Ilustracje/zegar.png (synced via reel:fetch-assets).
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'reel-assets');

function iphoneFrameSvg() {
  const W = 590;
  const H = 1278;
  const rx = 62;
  const bezel = 14;
  const screenX = bezel + 8;
  const screenY = bezel + 22;
  const screenW = W - (screenX + bezel + 8);
  const screenH = H - (screenY + bezel + 14);
  const screenRx = 48;
  const islandW = 126;
  const islandH = 37;
  const islandX = (W - islandW) / 2;
  const islandY = screenY + 12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="titanium" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3a3a3c"/>
      <stop offset="50%" stop-color="#1c1c1e"/>
      <stop offset="100%" stop-color="#2c2c2e"/>
    </linearGradient>
    <mask id="screenCut">
      <rect width="${W}" height="${H}" fill="white"/>
      <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${screenRx}" fill="black"/>
    </mask>
  </defs>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="${rx}" fill="url(#titanium)" mask="url(#screenCut)"/>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${rx + 2}" fill="none" stroke="#5a5a5c" stroke-width="1.5"/>
  <rect x="${islandX}" y="${islandY}" width="${islandW}" height="${islandH}" rx="19" fill="#000"/>
  <rect x="${islandX + islandW * 0.62}" y="${islandY + 10}" width="12" height="12" rx="6" fill="#1a1a2e" opacity="0.9"/>
</svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const framePath = join(outDir, 'iphone-15-pro-frame.png');
  await sharp(Buffer.from(iphoneFrameSvg())).png().toFile(framePath);
  console.log('[no-show-ui] Wrote', framePath);

  const srcBg = join(outDir, 'shop-screenshot.jpg');
  const blurPath = join(outDir, 'barbershop-screen-bg.jpg');
  await sharp(srcBg)
    .resize(1179, 2556, { fit: 'cover', position: 'centre' })
    .blur(14)
    .modulate({ brightness: 0.75, saturation: 0.85 })
    .jpeg({ quality: 88 })
    .toFile(blurPath);
  console.log('[no-show-ui] Wrote', blurPath);
}

main().catch((err) => {
  console.error('[no-show-ui] Failed:', err);
  process.exit(1);
});
