/**
 * White background removal for chair B-roll → transparent WebM (VP9 alpha).
 *
 * Usage:
 *   node scripts/key-fotel-video.mjs
 *   node scripts/key-fotel-video.mjs --similarity=0.15 --blend=0.08
 */
import { spawnSync } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'public', 'images', 'Ilustracje', 'fotel wideo.mp4');
const outDir = join(root, 'public', 'reel-assets', 'broll');
const outputPath = join(outDir, 'fotel-wideo.webm');

function parseArgs() {
  let similarity = 0.12;
  let blend = 0.06;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--similarity=')) {
      similarity = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--blend=')) {
      blend = Number(arg.split('=')[1]);
    }
  }

  return { similarity, blend };
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('[fotel-video-key] FFmpeg not found on PATH.');
    process.exit(1);
  }
}

async function main() {
  const { similarity, blend } = parseArgs();

  if (!(await fileExists(inputPath))) {
    console.error('[fotel-video-key] Missing source:', inputPath);
    process.exit(1);
  }

  checkFfmpeg();
  await mkdir(outDir, { recursive: true });

  const colorkey = `colorkey=0xFFFFFF:${similarity}:${blend}`;
  const vf = [
    'scale=1080:1920:force_original_aspect_ratio=decrease',
    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xFFFFFF',
    colorkey,
    'format=rgba',
  ].join(',');

  console.log('[fotel-video-key] Input:', inputPath);
  console.log('[fotel-video-key] Output:', outputPath);
  console.log('[fotel-video-key] Filter:', vf);

  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vf',
      vf,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '18',
      '-b:v',
      '0',
      '-pix_fmt',
      'yuva420p',
      '-an',
      outputPath,
    ],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log('[fotel-video-key] Done:', outputPath);
}

main().catch((err) => {
  console.error('[fotel-video-key] Failed:', err);
  process.exit(1);
});
