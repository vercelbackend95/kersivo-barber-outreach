import { FPS, HEIGHT, WIDTH } from './theme';

export { FPS, WIDTH, HEIGHT };

export const NO_SHOW_COLORS = {
  bg: '#000000',
  fg: '#ffffff',
  muted: '#aaaaaa',
  lossRed: '#D90429',
} as const;

export const NO_SHOW_DURATION_SECONDS = 12;
export const NO_SHOW_DURATION_FRAMES = FPS * NO_SHOW_DURATION_SECONDS;

/** Scene durations in frames */
export const NO_SHOW_SCENE = {
  booked: 45,
  noShow: 45,
  spinningBroll: 90,
  depositSms: 75,
  busyBroll: 60,
  cta: 45,
} as const;

/** 0.5s micro-cut length for aggressive hook pacing */
export const MICRO_CUT_FRAMES = 15;

/** Global frame offsets for audio mix script */
export const NO_SHOW_AUDIO_CUES = {
  tickStart: 0,
  buzzer: 45,
  cashFail: 90,
  ding: 180,
} as const;

export const NO_SHOW_VISUAL = {
  text: {
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const,
    textRendering: 'optimizeLegibility' as const,
  },
  gpu: {
    backfaceVisibility: 'hidden' as const,
    willChange: 'transform' as const,
  },
} as const;

export function snapNoShow(value: number): number {
  return Math.round(value * 2) / 2;
}
