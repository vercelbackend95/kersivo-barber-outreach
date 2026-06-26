/**
 * Renders SpinningChairClip to MP4 for NoShowReel B-roll slot.
 * Output: public/reel-assets/broll/spinning-chair.mp4
 */
import { spawnSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'reel-assets', 'broll');
const outFile = join(outDir, 'spinning-chair.mp4');
const tempFile = join(outDir, 'spinning-chair-2x.mp4');

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error('[reel:render:spinning-chair] FFmpeg not found on PATH.');
    process.exit(1);
  }
}

async function main() {
  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  const renderArgs = [
    'remotion',
    'render',
    'SpinningChairClip',
    tempFile,
    '--scale',
    '2',
    '--crf',
    '10',
    '--image-format',
    'png',
    '--muted',
  ];

  console.log('[reel:render:spinning-chair] Rendering 2x:', tempFile);
  const renderResult = spawnSync('npx', renderArgs, {
    cwd: reelRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  console.log('[reel:render:spinning-chair] Downscaling:', outFile);
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
    { stdio: 'inherit', shell: true },
  );

  if (downscaleResult.status !== 0) {
    process.exit(downscaleResult.status ?? 1);
  }

  try {
    await unlink(tempFile);
  } catch {
    /* ok */
  }

  console.log('[reel:render:spinning-chair] Done:', outFile);
}

main().catch((err) => {
  console.error('[reel:render:spinning-chair] Failed:', err);
  process.exit(1);
});
