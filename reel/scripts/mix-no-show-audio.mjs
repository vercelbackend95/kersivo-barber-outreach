/**
 * Mixes beat + SFX onto the muted no-show reel render.
 * Requires FFmpeg on PATH and audio files in public/reel-assets/audio/.
 */
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reelRoot = join(__dirname, '..');
const root = join(reelRoot, '..');
const videoIn = join(root, 'public', 'videos', 'no-show-reel.mp4');
const videoOut = join(root, 'public', 'videos', 'no-show-reel-final.mp4');
const audioDir = join(root, 'public', 'reel-assets', 'audio');

const FPS = 30;

/** Frame-accurate offsets in seconds */
const CUES = {
  beat: 0,
  tick: 0,
  buzzer: 45 / FPS,
  cashFail: 90 / FPS,
  ding: 180 / FPS,
};

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) {
    console.error('[reel:mix:no-show] FFmpeg not found on PATH.');
    process.exit(1);
  }
}

async function main() {
  checkFfmpeg();

  if (!(await fileExists(videoIn))) {
    console.error(`[reel:mix:no-show] Missing video: ${videoIn}`);
    console.error('Run: npm run reel:render:no-show');
    process.exit(1);
  }

  const beat = join(audioDir, 'beat.mp3');
  const tick = join(audioDir, 'tick.mp3');
  const buzzer = join(audioDir, 'buzzer.mp3');
  const cashFail = join(audioDir, 'cash-fail.mp3');
  const ding = join(audioDir, 'ding.mp3');

  const inputs = ['-i', videoIn];
  const filterParts = [];
  const audioLabels = [];
  let inputIndex = 1;

  const addAudio = async (path, delaySec, volume = 1) => {
    if (!(await fileExists(path))) {
      console.warn(`[reel:mix:no-show] Skipping missing: ${path}`);
      return;
    }
    inputs.push('-i', path);
    const delayMs = Math.round(delaySec * 1000);
    const label = `a${inputIndex}`;
    filterParts.push(
      `[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=${volume}[${label}]`,
    );
    audioLabels.push(`[${label}]`);
    inputIndex += 1;
  };

  await addAudio(beat, CUES.beat, 0.65);
  await addAudio(tick, CUES.tick, 0.35);
  await addAudio(buzzer, CUES.buzzer, 0.9);
  await addAudio(cashFail, CUES.cashFail, 0.85);
  await addAudio(ding, CUES.ding, 0.8);

  if (audioLabels.length === 0) {
    console.error('[reel:mix:no-show] No audio files found. See public/reel-assets/audio/README.md');
    process.exit(1);
  }

  const filterComplex =
    audioLabels.length === 1
      ? `${filterParts[0].replace(/\[a\d+\]$/, '[outa]')}`
      : `${filterParts.join(';')};${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=first:dropout_transition=0[outa]`;

  const args = [
    '-y',
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    '0:v',
    '-map',
    '[outa]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    videoOut,
  ];

  console.log('[reel:mix:no-show] Mixing audio →', videoOut);
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit', shell: true });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log('[reel:mix:no-show] Done:', videoOut);
}

main().catch((err) => {
  console.error('[reel:mix:no-show] Failed:', err);
  process.exit(1);
});
