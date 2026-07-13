import { FPS, HEIGHT, WIDTH } from './theme';

export { FPS, WIDTH, HEIGHT };

export const VIRAL_CTA_BUMPER_DURATION_SECONDS = 2;
export const VIRAL_CTA_BUMPER_DURATION_FRAMES = FPS * VIRAL_CTA_BUMPER_DURATION_SECONDS;

export const VIRAL_CTA_BUMPER_DEFAULTS = {
  headline: 'Let them book themselves.',
  subline: '0% KERSIVO commission on bookings.',
  url: 'kersivo.co.uk',
} as const;

/** Staggered fade-in (frames @ 30 fps) */
export const VIRAL_CTA_BUMPER_TIMING = {
  headlineStart: 0,
  headlineEnd: 8,
  sublineStart: 8,
  sublineEnd: 16,
  urlStart: 16,
  urlEnd: 24,
  holdUntil: VIRAL_CTA_BUMPER_DURATION_FRAMES,
} as const;

export const VIRAL_CTA_BUMPER_COLORS = {
  bg: '#000000',
  fg: '#f1eee8',
  muted: '#b7bdc7',
} as const;
