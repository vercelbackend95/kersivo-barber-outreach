/**
 * Composite English iOS lock screen over oj.mov phone display.
 * Output: public/videos/oj-fixed.mov
 */
import { spawnSync } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const outDir = join(reelRoot, '..', 'public', 'videos');
const outFile = join(outDir, 'oj-fixed.mov');
const tempFile = join(outDir, 'oj-fixed-temp.mov');

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('[reel:render:oj-fix] FFmpeg not found on PATH.');
    process.exit(1);
  }
}

async function main() {
  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  const renderArgs = [
    'remotion',
    'render',
    'OjPhoneFix',
    tempFile,
    '--codec',
    'h264',
    '--crf',
    '16',
    '--image-format',
    'png',
  ];

  console.log('[reel:render:oj-fix] Rendering:', tempFile);
  const renderResult = spawnSync('npx', renderArgs, {
    cwd: reelRoot,
    stdio: 'inherit',
    shell: true,
  });

  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  console.log('[reel:render:oj-fix] Re-muxing with faststart:', outFile);
  const remuxResult = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      tempFile,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outFile,
    ],
    { stdio: 'inherit' },
  );

  if (remuxResult.status !== 0) {
    process.exit(remuxResult.status ?? 1);
  }

  try {
    await unlink(tempFile);
  } catch {
    /* ok */
  }

  console.log('[reel:render:oj-fix] Done:', outFile);
}

main().catch((err) => {
  console.error('[reel:render:oj-fix] Failed:', err);
  process.exit(1);
});
