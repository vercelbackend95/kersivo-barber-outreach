import { FPS, HEIGHT, WIDTH } from './theme';

export { FPS, WIDTH, HEIGHT };

export const BARBER_MATH_DURATION_SECONDS = 15.5;
export const BARBER_MATH_DURATION_FRAMES = FPS * BARBER_MATH_DURATION_SECONDS;

/** Published-rate example costs for a 4-chair shop */
export const BARBER_MATH_COSTS = {
  staff: 4,
  subscriptionExVat: 55,
  subscriptionIncVat: 66,
  marketplaceMonthly: 576,
  totalMonthly: 642,
  totalAnnual: 7704,
  hookAnnual: 8000,
  kersivoMonthly: 39,
  kersivoAnnual: 468,
  savedMonthly: 603,
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

/** Payoff scene — £8K strike then dual reveal */
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
