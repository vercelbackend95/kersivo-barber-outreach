/**
 * Regenerates the static dashboard posters shown in the /fresha-alternative hero
 * before the live demo iframe loads (see FreshaHero.astro + deferredDemoFrame.ts).
 *
 * Why exact dimensions matter: the poster is swapped for the live iframe in a single
 * frame and rendered with `object-fit: none` (never scaled). It only lines up with
 * the live dashboard if it was rendered by the embed at the iframe's real CSS size,
 * in the same responsive mode (the embed switches from sidebar-only to sidebar + main
 * above 768px of iframe width, i.e. above an 800px page width). So for every poster
 * this script first measures the real iframe on the landing page at a representative
 * page viewport, then renders the embed route at exactly that size.
 *
 * If you add/remove a variant or change a page viewport, keep the <picture> media
 * queries in FreshaHero.astro in step with PAGE bands below.
 *
 * The embed is a deterministic showcase frozen at BLACKLINE_HERO_SHOWCASE_NOW
 * (src/lib/admin/heroShowcase.ts), so posters stay valid until that clock, the
 * BLACKLINE fixtures or the admin UI change — recapture after any of those.
 *
 * Prereq: a running build of the site, ideally production
 *   (`npx astro build` + a local server) or `npm run dev`.
 * Usage:  FRESHA_POSTER_BASE=http://127.0.0.1:4321 node scripts/capture-fresha-dashboard-posters.mjs
 * Set FRESHA_POSTER_CHANNEL=chrome to use an installed Chrome instead of Playwright's bundled Chromium.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images', 'fresha-alternative');
const base = (process.env.FRESHA_POSTER_BASE ?? 'http://127.0.0.1:4321').replace(/\/$/, '');
const EMBED_PATH = '/demo/admin?embed=hero&section=bookings_dashboard';
/** Mirrors HERO_SHOWCASE_READY_ATTRIBUTE in src/lib/admin/heroShowcase.ts. */
const HERO_READY_ATTRIBUTE = 'data-hero-showcase-ready';

/** One poster per page band; `page` is the representative page viewport inside the band. */
const VARIANTS = [
  { file: 'dashboard-poster-mobile.webp', band: '≤ 25rem', page: [390, 844], dpr: 2, quality: 62 },
  { file: 'dashboard-poster-mobile-wide.webp', band: '25–38rem', page: [430, 932], dpr: 2, quality: 62 },
  { file: 'dashboard-poster-tablet.webp', band: '38–50rem', page: [768, 1024], dpr: 2, quality: 58 },
  { file: 'dashboard-poster-desktop-compact.webp', band: '50–64rem', page: [1024, 768], dpr: 1, quality: 68 },
  { file: 'dashboard-poster-desktop.webp', band: '64–96.875rem', page: [1440, 900], dpr: 1, quality: 68 },
  { file: 'dashboard-poster-desktop-wide.webp', band: '> 96.875rem (iframe capped)', page: [1916, 914], dpr: 1, quality: 68 },
];

async function measureIframe(browser, [width, height]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(`${base}/fresha-alternative`, { waitUntil: 'domcontentloaded' });
  const size = await page.evaluate(() => {
    const frame = document.querySelector('.fresha-alt-hero__product-frame');
    return frame ? { width: frame.clientWidth, height: frame.clientHeight } : null;
  });
  await context.close();
  if (!size) throw new Error('Hero iframe not found on /fresha-alternative');
  return size;
}

async function captureEmbed(browser, size, dpr) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: dpr,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${base}${EMBED_PATH}`, { waitUntil: 'domcontentloaded' });
  // Same signal the landing page waits for before swapping the poster for the live frame.
  await page.waitForSelector(`html[${HERO_READY_ATTRIBUTE}]`, { timeout: 30000 });
  const png = await page.screenshot({ type: 'png' });
  await context.close();
  return png;
}

const channel = process.env.FRESHA_POSTER_CHANNEL?.trim();
const browser = await chromium.launch(channel ? { channel } : {});
await mkdir(outDir, { recursive: true });
try {
  for (const variant of VARIANTS) {
    const size = await measureIframe(browser, variant.page);
    const png = await captureEmbed(browser, size, variant.dpr);
    const info = await sharp(png)
      .webp({ quality: variant.quality, effort: 6, smartSubsample: true })
      .toFile(join(outDir, variant.file));
    console.log(
      `${variant.file}: page ${variant.page.join('x')} (${variant.band}) -> iframe ${size.width}x${size.height} @${variant.dpr}x -> ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`,
    );
  }
} finally {
  await browser.close();
}
