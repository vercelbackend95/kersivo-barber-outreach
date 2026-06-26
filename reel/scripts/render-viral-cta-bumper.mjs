/**
 * Renders ViralCtaBumper — 2s universal end card for CapCut append.
 * Output: public/videos/viral-cta-bumper.mp4
 *
 * Custom headline:
 *   node scripts/render-viral-cta-bumper.mjs --props='{"headline":"Stop chasing appointments at midnight."}'
 */
import { spawnSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'videos');
const outFile = join(outDir, 'viral-cta-bumper.mp4');
const tempFile = join(outDir, 'viral-cta-bumper-2x.mp4');

function parsePropsArg() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--props=')) {
      return arg.slice('--props='.length);
    }
  }
  return null;
}

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('[reel:render:viral-cta] FFmpeg not found on PATH.');
    process.exit(1);
  }
}

async function main() {
  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  const propsJson = parsePropsArg();
  const renderArgs = [
    'remotion',
    'render',
    'ViralCtaBumper',
    tempFile,
    '--scale',
    '2',
    '--crf',
    '10',
    '--image-format',
    'png',
    '--muted',
  ];

  if (propsJson) {
    renderArgs.push('--props', propsJson);
  }

  console.log('[reel:render:viral-cta] Rendering 2x:', tempFile);
  const renderResult = spawnSync('npx', renderArgs, {
    cwd: reelRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  console.log('[reel:render:viral-cta] Downscaling:', outFile);
  const downscaleResult = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      tempFile,
      '-vf',
      'scale=1080:1920:flags=lanczos,unsharp=3:3:0.35:3:3:0.0',
      '-c:v',
      'libx264',
      '-crf',
      '10',
      '-preset',
      'slow',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      outFile,
    ],
    { stdio: 'inherit' },
  );

  if (downscaleResult.status !== 0) {
    process.exit(downscaleResult.status ?? 1);
  }

  try {
    await unlink(tempFile);
  } catch {
    /* ok */
  }

  console.log('[reel:render:viral-cta] Done:', outFile);
}

main().catch((err) => {
  console.error('[reel:render:viral-cta] Failed:', err);
  process.exit(1);
});
