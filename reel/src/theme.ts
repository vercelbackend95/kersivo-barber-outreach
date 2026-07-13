/** Mirrors src/styles/tokens.css */
export const colors = {
  bg: '#0b0d10',
  fg: '#f1eee8',
  muted: '#b7bdc7',
  accent: '#d72638',
  accentHover: '#ff2e45',
  surface: '#11151b',
  surface2: '#171c23',
  border: '#252c36',
} as const;

export const fonts = {
  heading: 'Bebas Neue',
  body: 'Inter',
} as const;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_SECONDS = 16;
export const DURATION_FRAMES = FPS * DURATION_SECONDS;

/** Scene durations in frames */
export const SCENE = {
  hook: 120,
  dualZero: 99,
  value: 132,
  cta: 129,
} as const;

/** Hook scene percent counter timing (3.5s scene) */
export const HOOK_COUNTER_TIMING = {
  COUNT_END: 22,
  HIT_FRAME: 22,
  STRIKE_END: 32,
} as const;

/** PercentCounterOverlay — FROZEN: do not use 0%→30% strike in paid ads (Claims Audit 13 Jul 2026). */
export const PERCENT_COUNTER_CLAIMS_FROZEN = true as const;
export const PERCENT_COUNTER_TIMING = {
  /** Frame where count-up ends and 30% is reached (1.0 s) */
  COUNT_END: 30,
  /** Same as COUNT_END — strike starts here */
  HIT_FRAME: 30,
  /** Strike animation end (0.3 s after hit) */
  STRIKE_END: 39,
  /** Post-strike hold end (+0.2 s after strike) */
  POST_STRIKE_END: 45,
  /** Total hold at 30% (0.8 s after hit) */
  HOLD_END: 54,
} as const;

export const PERCENT_COUNTER_DURATION = PERCENT_COUNTER_TIMING.HOLD_END;

/** Premium visual polish — typography, shadows, GPU compositing */
export const visualQuality = {
  text: {
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const,
    textRendering: 'optimizeLegibility' as const,
  },
  headingShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 80px rgba(215,38,56,0.08)',
  accentShadow: '0 4px 28px rgba(215,38,56,0.4), 0 2px 12px rgba(0,0,0,0.45)',
  bodyShadow: '0 1px 12px rgba(0,0,0,0.35)',
  gpu: {
    backfaceVisibility: 'hidden' as const,
    willChange: 'transform' as const,
  },
} as const;

/** Snap transform values to half-pixels for sharper static holds */
export function snapTransform(value: number): number {
  return Math.round(value * 2) / 2;
}
