export type OnboardingBarber = {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  /** When false, seat is calendar-off. Solo / single card is always forced on by the API. */
  onlineBookings?: boolean;
  /** Roster intent for extra seats (index > 0). Ignored for Owner card. */
  intendedRole?: 'MANAGER' | 'BARBER';
};

export type OnboardingService = {
  id?: string;
  key: string;
  name: string;
  pricePence: number;
  durationMinutes: number;
  selected: boolean;
  isCustom?: boolean;
};

export type OnboardingHoursRow = {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
};

export type OnboardingState = {
  shop: {
    id: string;
    name: string;
    townCity: string | null;
    logoUrl: string | null;
  };
  onboardingCompleted: boolean;
  onboardingCurrentStep: number;
  onboardingCompletedAt: string | null;
  barbers: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    intendedRole?: 'MANAGER' | 'BARBER';
  }>;
  services: Array<{
    id: string;
    name: string;
    pricePence: number;
    durationMinutes: number;
    isActive: boolean;
    displayOrder: number;
    category: string | null;
  }>;
  hours: OnboardingHoursRow[];
  shopHours?: OnboardingHoursRow[];
  /** Server-resolved product access; never infer entitlement from onboardingCompleted. */
  productAccess?: {
    state: 'SETUP' | 'FREE_BOOKING' | 'FULL_KERSIVO';
    capabilities: Record<string, boolean>;
  };
  /** Signed-in SETUP shop that finished setup but has not chosen a plan yet. */
  freeActivationRequired?: boolean;
  /** SETUP shop with an unfinished (PENDING) Full KERSIVO checkout. */
  fullCheckoutPending?: boolean;
  /** SETUP shop whose Full subscription ended/cancelled: Starter uses the post-Full plan choice. */
  postFullPlanChoiceRequired?: boolean;
  /** Existing Full subscription has a billing problem and must be recovered/cancelled before a new plan choice. */
  billingRecoveryRequired?: boolean;
  /** Max barbers accepting online bookings, or null when unlimited. */
  freeBookableBarberLimit?: number | null;
  /** Real public booking page when the shop accepts public bookings. */
  bookingUrl?: string | null;
  /** Present on the /complete response only. */
  activation?: 'activated' | 'already_free' | 'full_kersivo';
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

export const SERVICE_PRESETS: Array<{
  key: string;
  name: string;
  pricePence: number;
  durationMinutes: number;
}> = [
  { key: 'haircut', name: 'Haircut', pricePence: 2500, durationMinutes: 30 },
  { key: 'skin-fade', name: 'Skin Fade', pricePence: 3000, durationMinutes: 45 },
  { key: 'beard-trim', name: 'Beard Trim', pricePence: 1500, durationMinutes: 20 },
  { key: 'haircut-beard', name: 'Haircut & Beard', pricePence: 3500, durationMinutes: 45 },
  { key: 'kids-haircut', name: "Kids' Haircut", pricePence: 1800, durationMinutes: 30 },
];

export const DAY_LABELS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_HOURS: OnboardingHoursRow[] = [
  { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' }, // Monday
  { dayOfWeek: 2, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 4, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 5, active: true, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 6, active: true, startTime: '09:00', endTime: '16:00' }, // Saturday
  { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' }, // Sunday
];

export function formatGbp(pricePence: number) {
  return `£${(pricePence / 100).toFixed(pricePence % 100 === 0 ? 0 : 2)}`;
}

export function parseGbpToPence(value: string) {
  const cleaned = value.replace(/[£,\s]/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return Math.round(parsed * 100);
}

export function orderedHoursForDisplay(hours: OnboardingHoursRow[]) {
  const dayOrder = [1, 2, 3, 4, 5, 6, 7];
  return dayOrder.map((dayOfWeek) => {
    const row = hours.find((item) => item.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      label: DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`,
      active: row?.active ?? false,
      startTime: row?.startTime ?? '09:00',
      endTime: row?.endTime ?? '18:00',
    };
  });
}

/** Cards that will accept online bookings when saved (a single card is always bookable). */
export function countBookableBarberCards(barbers: Array<{ onlineBookings?: boolean }>): number {
  if (barbers.length === 1) return 1;
  return barbers.filter((barber) => barber.onlineBookings !== false).length;
}

export type OnboardingPlanChoice = 'STARTER' | 'FULL';

export const STARTER_PLAN_CARD = {
  name: 'KERSIVO Starter',
  price: '£0/month',
  tagline: 'Start taking bookings with the core tools you need to run your diary.',
  points: [
    'Hosted booking page',
    'Up to 4 bookable barbers',
    'Bookings and availability',
    '90-day booking history',
    'Clients Core',
    'Email reminders',
    '0% KERSIVO commission',
  ],
  cta: 'Start with KERSIVO Starter',
} as const;

export const FULL_PLAN_CARD = {
  name: 'Full KERSIVO',
  price: '£39/month',
  priceNote: 'per location',
  tagline: 'Own the full customer experience with your website, brand and complete business toolkit.',
  points: [
    'Full branded website',
    'Own domain',
    'Full booking history',
    'Advanced Clients / CRM',
    'Reports',
    'Retail',
    'SMS reminders',
    'Live KERSIVO Assistant',
    '0% KERSIVO commission',
  ],
  cta: 'Choose Full KERSIVO',
} as const;

export const PLAN_CHOICE_STRIPE_FEES_COPY = 'Stripe processing fees apply to online card payments.';

export const BILLING_RECOVERY_COPY =
  'Your existing Full KERSIVO subscription needs attention before you can choose another plan. Open billing to update payment details or cancel the subscription.';

export const STARTER_PAY_AT_SHOP_COPY =
  'Starter works with Pay at shop — no Stripe account needed. Connect Stripe later in Settings if you want deposits or card payments.';

export const FULL_CHECKOUT_CANCELLED_COPY =
  'Full KERSIVO checkout was not completed and you have not been charged. Choose a plan to continue.';

export const FULL_CHECKOUT_PENDING_COPY =
  'A Full KERSIVO checkout is still open. If you have just paid, it can take a moment to confirm — refresh shortly. Choosing Full KERSIVO again resumes the same checkout.';

export const ONBOARDING_PLAN_STORAGE_KEY = 'kersivo_onboarding_plan_choice';

export const FREE_BOOKABLE_BARBER_LIMIT_COPY =
  'KERSIVO Starter includes up to 4 barbers taking online bookings.';

export async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') return payload.error;
    return 'Something went wrong. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}
