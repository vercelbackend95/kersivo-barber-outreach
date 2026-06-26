/**
 * Renders PercentCounterOverlay with transparent background for CapCut.
 * Outputs WebM (VP9 + alpha) and MOV (ProRes 4444) fallbacks.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'videos');
const webmOut = join(outDir, 'percent-counter-overlay.webm');
const movOut = join(outDir, 'percent-counter-overlay.mov');
const webmTemp = join(outDir, 'percent-counter-overlay-2x.webm');
const movTemp = join(outDir, 'percent-counter-overlay-2x.mov');

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error('[reel:render-counter] FFmpeg not found on PATH. Install from https://ffmpeg.org/');
    process.exit(1);
  }
  console.log('[reel:render-counter] FFmpeg OK');
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function renderTransparent(tempFile, codec, proresProfile) {
  const renderArgs = [
    'remotion',
    'render',
    'PercentCounterOverlay',
    tempFile,
    '--scale',
    '2',
    '--image-format',
    'png',
    '--muted',
    '--transparent',
    '--codec',
    codec,
  ];

  if (codec !== 'prores') {
    renderArgs.push('--crf', '14');
  }

  if (proresProfile) {
    renderArgs.push('--prores-profile', proresProfile);
  }

  console.log(`[reel:render-counter] Rendering 2x ${codec}:`, tempFile);
  run('npx', renderArgs, reelRoot);
}

async function downscaleWebm(tempFile, outFile) {
  console.log('[reel:render-counter] Downscaling WebM to 1080x1920:', outFile);
  run(
    'ffmpeg',
    [
      '-y',
      '-i',
      tempFile,
      '-vf',
      'scale=1080:1920:flags=lanczos',
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '14',
      '-b:v',
      '0',
      '-pix_fmt',
      'yuva420p',
      '-an',
      outFile,
    ],
    reelRoot,
  );
}

async function downscaleMov(tempFile, outFile) {
  console.log('[reel:render-counter] Downscaling MOV to 1080x1920:', outFile);
  run(
    'ffmpeg',
    [
      '-y',
      '-i',
      tempFile,
      '-vf',
      'scale=1080:1920:flags=lanczos',
      '-c:v',
      'prores_ks',
      '-profile:v',
      '4',
      '-pix_fmt',
      'yuva444p10le',
      '-an',
      outFile,
    ],
    reelRoot,
  );
}

async function removeTemp(file) {
  try {
    await unlink(file);
  } catch {
    /* temp file may already be gone */
  }
}

async function main() {
  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  await renderTransparent(webmTemp, 'vp9');
  await downscaleWebm(webmTemp, webmOut);
  await removeTemp(webmTemp);

  await renderTransparent(movTemp, 'prores', '4444');
  await downscaleMov(movTemp, movOut);
  await removeTemp(movTemp);

  console.log('[reel:render-counter] Done:');
  console.log('  WebM:', webmOut);
  console.log('  MOV: ', movOut);
}

main().catch((err) => {
  console.error('[reel:render-counter] Failed:', err);
  process.exit(1);
});
