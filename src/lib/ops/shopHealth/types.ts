/**
 * Shop health ("green light") types. Docs: docs/ops/shop-health.md.
 *
 * A check reads a ShopHealthContext (loaded once per run by context.ts) and returns an outcome; the runner
 * (run.ts) adds id/area/title/severity, applies the per-check timeout and turns a thrown check into
 * "inconclusive". The light is computed by overall.ts.
 */
import type { KersivoAccess } from '@/lib/shop/kersivoAccess';
import type { PublicBookingIntakeStatus } from '@/lib/setup/shopPublicBookingGate';
import type { PublicBookingDestination } from '@/lib/shop/publicBookingDestination';

export type ShopHealthArea = 'setup' | 'booking' | 'payments' | 'retail' | 'website' | 'messaging';
export type ShopHealthSeverity = 'critical' | 'warning' | 'info';
export type ShopHealthStatus = 'pass' | 'warn' | 'fail' | 'skip' | 'after_launch' | 'inconclusive';
export type ShopHealthMode = 'LIVE' | 'PRELAUNCH';
export type ShopHealthOverall = 'GREEN' | 'AMBER' | 'RED' | 'GREY';
export type ShopHealthTrigger = 'CRON' | 'MANUAL' | 'LAUNCH';

export const SHOP_HEALTH_AREAS: readonly ShopHealthArea[] = ['setup', 'booking', 'payments', 'retail', 'website', 'messaging'];

export const SHOP_HEALTH_AREA_LABELS: Record<ShopHealthArea, string> = {
  setup: 'Setup',
  booking: 'Booking',
  payments: 'Payments',
  retail: 'Products',
  website: 'Website',
  messaging: 'Messages',
};

export type ShopHealthEvidence = Record<string, string | number | boolean | null | undefined | string[]>;

export type ShopHealthCheckResult = {
  id: string;
  area: ShopHealthArea;
  title: string;
  severity: ShopHealthSeverity;
  status: ShopHealthStatus;
  message: string;
  fix?: string;
  evidence?: ShopHealthEvidence;
};

/** What a check's run() returns; the runner adds the identity fields. */
export type ShopHealthOutcome = Pick<ShopHealthCheckResult, 'status' | 'message' | 'fix' | 'evidence'>;

/**
 * yes: run it. no: does not apply (status "skip"). after_launch: applies only once the shop is live and
 * this is a PRELAUNCH run (status "after_launch", not counted in readiness).
 */
export type ShopHealthApplies = 'yes' | 'no' | 'after_launch';

export type ShopHealthCheck = {
  id: string;
  area: ShopHealthArea;
  title: string;
  severity: ShopHealthSeverity;
  /** config: DB only, fast, also on page load. probe: dry-run booking, availability, HTTP and Stripe (cron / Run now). */
  kind: 'config' | 'probe';
  appliesWhen(ctx: ShopHealthContext): ShopHealthApplies;
  run(ctx: ShopHealthContext): ShopHealthOutcome | Promise<ShopHealthOutcome>;
};

export type HealthShop = {
  id: string;
  name: string;
  bookingSlug: string | null;
  timezone: string;
  shopPaidAt: Date | null;
  smsRemindersEnabled: boolean;
  goLiveAt: Date | null;
  sitePreviewUrl: string | null;
  depositsEnabled: boolean;
  bookingPaymentMode: string;
  retailEnabled: boolean;
  retailTestOrderCompletedAt: Date | null;
  stripeConnectAccountId: string | null;
  stripeConnectAccountType: string | null;
  stripeConnectChargesEnabled: boolean;
  stripeConnectDetailsSubmitted: boolean;
  stripeConnectDisconnectedAt: Date | null;
  pendingConfirmationMins: number;
  publicActivityPaused: boolean;
  publicActivityPausedAt: Date | null;
  publicActivityPauseFrom: Date | null;
  publicActivityPauseUntil: Date | null;
  publicActivityPauseReason: string | null;
};

export type HealthService = {
  id: string;
  name: string;
  pricePence: number;
  durationMinutes: number;
  /** Active barbers linked to this service. */
  barberIds: string[];
};

export type HealthBarber = {
  id: string;
  name: string;
  /** Active services linked to this barber. */
  serviceIds: string[];
  activeRuleCount: number;
};

export type HealthProduct = {
  id: string;
  name: string;
  pricePence: number;
  hasImage: boolean;
  hasDescription: boolean;
};

export type HealthMessagingStats = {
  /** SMS rows for this shop in the last 7 days, newest first (status only). */
  smsRecent: Array<'QUEUED' | 'SENT' | 'FAILED'>;
  emailFailed7d: number;
  emailStuck7d: number;
};

export type ShopHealthContext = {
  now: Date;
  mode: ShopHealthMode;
  shop: HealthShop;
  access: KersivoAccess;
  intake: PublicBookingIntakeStatus;
  destination: PublicBookingDestination;
  /** VERIFIED_LIVE own-domain booking URL, if any. */
  verifiedDestinationUrl: string | null;
  openDays: number;
  /**
   * Any ShopOpeningHours row exists. With none, slots follow the barbers' availability rules alone
   * (booking/service.ts); with rows, a day without an active row is closed.
   */
  hoursSaved: boolean;
  services: HealthService[];
  barbers: HealthBarber[];
  products: HealthProduct[];
  profile: { hasAddressOrPostcode: boolean; hasPhone: boolean } | null;
  stuckPendingPayments: number;
  messaging: HealthMessagingStats;
};
