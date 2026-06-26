/**
 * Fetches reel assets from kersivo.co.uk and syncs missing files
 * into public/reel-assets/. Emits manifest.json for the Remotion composition.
 */
import { mkdir, writeFile, access, copyFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'reel-assets');
const publicDir = join(root, 'public');

const LIVE_BASE = 'https://kersivo.co.uk';

/** Curated assets used by the reel (primary source: local public/). */
const REEL_ASSETS = [
  'images/Ilustracje/0%.png',
  'images/Ilustracje/0%25.png',
  'images/Ilustracje/shoppyonline.png',
  'images/Ilustracje/8.png',
  'images/Ilustracje/newshop.png',
  'images/Ilustracje/barberwelcome.png',
  'images/Ilustracje/barberszyld.png',
  'images/Ilustracje/barber-chair.png',
  'images/Ilustracje/reminder.png',
  'images/Ilustracje/zegar.png',
  'images/Ilustracje/fotel.png',
  'images/Ilustracje/ddd.png',
  'images/Ilustracje/ccc.webm',
  'images/Ilustracje/fotel wideo.mp4',
  'images/insta/0% commission.jpg',
  'hero-assets/screens/feature261-shop-storefront.jpg',
];

function extractUrls(html, baseUrl) {
  const urls = new Set();
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  const cssUrlRe = /url\(["']?([^"')]+)["']?\)/gi;
  const linkRe = /<link[^>]+href=["']([^"']+)["']/gi;

  for (const re of [imgRe, cssUrlRe, linkRe]) {
    let m;
    while ((m = re.exec(html)) !== null) {
      try {
        const resolved = new URL(m[1], baseUrl).href;
        if (/\.(png|jpe?g|webp|svg|gif|woff2?)(\?|$)/i.test(resolved)) {
          urls.add(resolved);
        }
      } catch {
        /* skip invalid */
      }
    }
  }
  return [...urls];
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalPath(relativePath) {
  return join(publicDir, relativePath.replace(/^\//, ''));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    liveBase: LIVE_BASE,
    assets: [],
  };

  // Verify curated local assets; copy aliases for Remotion-friendly names
  const aliases = [
    { from: 'images/Ilustracje/0%.png', alias: 'zero-commission.png', fallback: '0%25.png' },
    { from: 'images/Ilustracje/shoppyonline.png', alias: 'shoppyonline.png' },
    { from: 'images/Ilustracje/8.png', alias: 'hero-booking.png' },
    { from: 'images/Ilustracje/newshop.png', alias: 'hero-newshop.png' },
    { from: 'images/Ilustracje/barberwelcome.png', alias: 'hero-barberwelcome.png' },
    { from: 'images/Ilustracje/barberszyld.png', alias: 'hero-barberszyld.png' },
    { from: 'images/Ilustracje/barber-chair.png', alias: 'barber-chair.png' },
    { from: 'images/Ilustracje/reminder.png', alias: 'reminder.png' },
    { from: 'images/Ilustracje/zegar.png', alias: 'zegar.png' },
    { from: 'images/Ilustracje/fotel.png', alias: 'fotel.png' },
    { from: 'images/Ilustracje/ddd.png', alias: 'ddd.png' },
    { from: 'images/Ilustracje/ccc.webm', alias: 'broll/ccc.webm' },
    { from: 'reel-assets/iphone-15-pro-frame.png', alias: 'iphone-15-pro-frame.png' },
    { from: 'reel-assets/barbershop-screen-bg.jpg', alias: 'barbershop-screen-bg.jpg' },
  ];

  for (const rel of REEL_ASSETS) {
    const localPath = await resolveLocalPath(rel);
    const exists = await fileExists(localPath);
    manifest.assets.push({
      path: rel,
      local: exists,
      resolved: localPath,
    });
    if (!exists) {
      console.warn(`[reel-assets] Missing local file: ${rel}`);
    }
  }

  for (const { from, alias, fallback } of aliases) {
    let src = await resolveLocalPath(from);
    if (!(await fileExists(src)) && fallback) {
      const fb = join(outDir, fallback);
      if (await fileExists(fb)) src = fb;
    }
    if (await fileExists(src)) {
      const dest = join(outDir, alias);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
      manifest.assets.push({ path: `reel-assets/${alias}`, alias: true, source: from });
    }
  }

  // Optional: fetch live homepage and download any missing image URLs
  try {
    const res = await fetch(LIVE_BASE, { signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const liveUrls = extractUrls(html, LIVE_BASE);

    for (const url of liveUrls) {
      const name = basename(new URL(url).pathname);
      if (!name || name === '/') continue;

      const dest = join(outDir, name);
      if (await fileExists(dest)) continue;

      try {
        const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!imgRes.ok) continue;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        await writeFile(dest, buf);
        manifest.assets.push({ path: `reel-assets/${name}`, fetched: true, source: url });
        console.log(`[reel-assets] Fetched: ${name}`);
      } catch {
        /* skip failed downloads */
      }
    }
  } catch (err) {
    console.warn('[reel-assets] Live fetch skipped:', err.message);
  }

  const manifestPath = join(outDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[reel-assets] Manifest written: ${manifestPath}`);
  console.log(`[reel-assets] ${manifest.assets.length} asset entries`);
}

main().catch((err) => {
  console.error('[reel-assets] Failed:', err);
  process.exit(1);
});
