import { FPS, HEIGHT, WIDTH } from './theme';

export { FPS, WIDTH, HEIGHT };

/**
 * CLAIMS FROZEN (Claims Audit 13 Jul 2026).
 * Do not use BarberMathReel (or former competitor savings figures) in Google Ads / paid social
 * until rebuilt with dated official competitor evidence + owner/legal approval.
 * Previous unverified corridor: marketplace £576/mo, saved £603/mo — removed.
 */
export const BARBER_MATH_CLAIMS_FROZEN = true as const;

export const BARBER_MATH_DURATION_SECONDS = 15.5;
export const BARBER_MATH_DURATION_FRAMES = FPS * BARBER_MATH_DURATION_SECONDS;

/** Safe KERSIVO-only figures while competitor savings maths remain frozen. */
export const BARBER_MATH_COSTS = {
  staff: 4,
  subscriptionExVat: 0,
  subscriptionIncVat: 0,
  marketplaceMonthly: 0,
  totalMonthly: 39,
  totalAnnual: 468,
  hookAnnual: 468,
  kersivoMonthly: 39,
  kersivoAnnual: 468,
  savedMonthly: 0,
} as const;

/** Scene durations in frames */
export const BARBER_MATH_SCENE = {
  hook: 90,
  build: 180,
  payoff: 105,
  cta: 90,
} as const;

/** Hook scene pound counter timing — fast count for pattern interrupt */
export const POUND_COUNTER_TIMING = {
  COUNT_END: 18,
  HIT_FRAME: 18,
  STRIKE_END: 28,
} as const;

/** Receipt row mini counter */
export const RECEIPT_COUNTER_TIMING = {
  COUNT_END: 20,
  HIT_FRAME: 20,
  STRIKE_END: 28,
} as const;

/** Payoff scene — strike then dual reveal */
export const PAYOFF_TIMING = {
  STRIKE_START: 24,
  STRIKE_END: 36,
  ZERO_REVEAL: 38,
} as const;

/** Build scene — compare strip beat */
export const COMPARE_STRIP_TIMING = {
  START: 96,
  HIT: 108,
} as const;
