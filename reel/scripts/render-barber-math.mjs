/**
 * Renders BarberMathReel to MP4. Requires FFmpeg on PATH.
 * Renders at 2x supersampling, then downscales to 1080x1920 for Instagram.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'videos');
const outFile = join(outDir, 'barber-math-reel.mp4');
const tempFile = join(outDir, 'barber-math-reel-2x.mp4');

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error('[reel:render:barber-math] FFmpeg not found on PATH. Install from https://ffmpeg.org/');
    process.exit(1);
  }
  console.log('[reel:render:barber-math] FFmpeg OK');
}

async function main() {
  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  const renderArgs = [
    'remotion',
    'render',
    'BarberMathReel',
    tempFile,
    '--scale',
    '2',
    '--crf',
    '10',
    '--image-format',
    'png',
    '--muted',
  ];

  console.log('[reel:render:barber-math] Rendering 2x supersample:', tempFile);
  const renderResult = spawnSync('npx', renderArgs, {
    cwd: reelRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  console.log('[reel:render:barber-math] Downscaling to 1080x1920:', outFile);
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
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
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
    /* temp file may already be gone */
  }

  console.log('[reel:render:barber-math] Done:', outFile);
}

main().catch((err) => {
  console.error('[reel:render:barber-math] Failed:', err);
  process.exit(1);
});
