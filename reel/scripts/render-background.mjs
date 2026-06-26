/**
 * Renders LampBackground to MP4. Requires FFmpeg on PATH.
 * Renders at 2x supersampling, then downscales to 1080x1920 for Instagram.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'videos');
const outFile = join(outDir, 'lamp-background.mp4');
const tempFile = join(outDir, 'lamp-background-2x.mp4');

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error('[reel:render-background] FFmpeg not found on PATH. Install from https://ffmpeg.org/');
    process.exit(1);
  }
  console.log('[reel:render-background] FFmpeg OK');
}

async function main() {
  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  const renderArgs = [
    'remotion',
    'render',
    'LampBackground',
    tempFile,
    '--scale',
    '2',
    '--crf',
    '14',
    '--image-format',
    'png',
    '--muted',
  ];

  console.log('[reel:render-background] Rendering 2x supersample:', tempFile);
  const renderResult = spawnSync('npx', renderArgs, {
    cwd: reelRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  console.log('[reel:render-background] Downscaling to 1080x1920:', outFile);
  const downscaleResult = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      tempFile,
      '-vf',
      'scale=1080:1920:flags=lanczos',
      '-c:v',
      'libx264',
      '-crf',
      '14',
      '-pix_fmt',
      'yuv420p',
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
    /* temp file may already be gone */
  }

  console.log('[reel:render-background] Done:', outFile);
}

main().catch((err) => {
  console.error('[reel:render-background] Failed:', err);
  process.exit(1);
});
