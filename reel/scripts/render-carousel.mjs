/**
 * Renders 5 Instagram carousel slides (1080×1080 PNG).
 * Output: public/images/insta/carousel/slide-0N-*.png
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'images', 'insta', 'carousel');

const SLIDES = [
  { index: 0, file: 'slide-01-hook.png' },
  { index: 1, file: 'slide-02-domain.png' },
  { index: 2, file: 'slide-03-stack.png' },
  { index: 3, file: 'slide-04-pricing.png' },
  { index: 4, file: 'slide-05-cta.png' },
];

async function renderSlide(slideIndex, outputFile) {
  const outFile = join(outDir, outputFile);
  const propsFile = join(outDir, `.props-slide-${slideIndex}.json`);

  await writeFile(propsFile, JSON.stringify({ slideIndex }), 'utf8');

  console.log(`[reel:render:carousel] Slide ${slideIndex + 1}/5 → ${outputFile}`);

  const renderResult = spawnSync(
    'npx',
    [
      'remotion',
      'still',
      'InstagramCarouselSlide',
      outFile,
      '--frame=0',
      `--props=${propsFile}`,
    ],
    { cwd: reelRoot, stdio: 'inherit', shell: true },
  );

  try {
    await unlink(propsFile);
  } catch {
    /* ok */
  }

  if (renderResult.status !== 0) {
    throw new Error(`Render failed for slide ${slideIndex}`);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const slide of SLIDES) {
    await renderSlide(slide.index, slide.file);
  }

  console.log('[reel:render:carousel] Done:', outDir);
}

main().catch((err) => {
  console.error('[reel:render:carousel] Failed:', err);
  process.exit(1);
});
