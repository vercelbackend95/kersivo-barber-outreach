/**
 * Config checks: DB only (from the loaded context), fast, safe to run on page load.
 * Every message and fix is written for the KERSIVO operator, in British English.
 */
import { hasKersivoCapability } from '@/lib/shop/kersivoAccess';
import { canSellRetail, evaluateRetailSelling } from '@/lib/shop/cardPaymentsGate';
import { isPauseActiveNow, pauseReasonMessage } from '@/lib/admin/shopPublicActivity';
import type { PublicBookingIntakeReason } from '@/lib/setup/shopPublicBookingGate';
import type { ShopHealthApplies, ShopHealthCheck, ShopHealthContext } from '../types';

const live = (ctx: ShopHealthContext): ShopHealthApplies => (ctx.mode === 'LIVE' ? 'yes' : 'after_launch');
const always = (): ShopHealthApplies => 'yes';
const when = (condition: boolean): ShopHealthApplies => (condition ? 'yes' : 'no');

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listNames = (names: string[], max = 3) =>
  names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;

export function depositsOn(ctx: ShopHealthContext): boolean {
  return ctx.shop.depositsEnabled || (ctx.shop.bookingPaymentMode !== 'NONE' && ctx.shop.bookingPaymentMode !== '');
}

/** Stripe Connect matters when the shop takes any card payment: deposits / paid booking, retail, or Starter. */
export function paymentsApply(ctx: ShopHealthContext): boolean {
  return depositsOn(ctx) || ctx.shop.retailEnabled || ctx.access.state === 'FREE_BOOKING';
}

/** A website is expected when the shop has a site URL or is on Full KERSIVO. */
export function websiteExpected(ctx: ShopHealthContext): boolean {
  return Boolean(ctx.shop.sitePreviewUrl?.trim() || ctx.verifiedDestinationUrl) || ctx.access.state === 'FULL_KERSIVO';
}

export const INTAKE_REASON_MESSAGES: Record<PublicBookingIntakeReason, { message: string; fix: string }> = {
  ok: { message: 'Online booking is accepting new bookings.', fix: '' },
  no_public_booking_entitlement: {
    message: 'Online booking is off: the shop has no active plan that includes public booking.',
    fix: 'Check the shop’s subscription (Full KERSIVO or Starter) and its billing status.',
  },
  shop_missing: { message: 'The shop record could not be found.', fix: 'Check the shop id.' },
  stripe_not_ready: {
    message: 'Starter online booking is paused: Stripe Connect is not ready to take payments.',
    fix: 'Ask the owner to finish Stripe Connect onboarding (Standard account, charges enabled).',
  },
  no_active_services: {
    message: 'Starter online booking is paused: there are no active services.',
    fix: 'Add or reactivate at least one service.',
  },
  service_below_minimum: {
    message: 'Starter online booking is paused: at least one active service is priced under £5.',
    fix: 'Raise the price of that service to £5 or more, or deactivate it.',
  },
  too_many_bookable_barbers: {
    message: 'Starter online booking is paused: more bookable barbers than Starter allows (up to 4).',
    fix: 'Deactivate barbers down to 4, or move the shop to Full KERSIVO.',
  },
};

export const setupHours: ShopHealthCheck = {
  id: 'setup.hours',
  area: 'setup',
  title: 'Opening hours',
  severity: 'critical',
  kind: 'config',
  appliesWhen: always,
  run: (ctx) =>
    ctx.openDays > 0
      ? { status: 'pass', message: `Open ${plural(ctx.openDays, 'day')} a week.`, evidence: { openDays: ctx.openDays } }
      : {
          status: 'fail',
          message: 'No opening hours saved, so customers cannot book.',
          fix: 'Add opening hours in the shop settings (at least one open day).',
          evidence: { openDays: 0 },
        },
};

export const setupServices: ShopHealthCheck = {
  id: 'setup.services',
  area: 'setup',
  title: 'Services',
  severity: 'critical',
  kind: 'config',
  appliesWhen: always,
  run: (ctx) => {
    const bookable = ctx.services.filter((s) => s.durationMinutes > 0 && s.pricePence > 0);
    if (bookable.length > 0) {
      return { status: 'pass', message: `${plural(bookable.length, 'active service')} with a price and duration.`, evidence: { activeServices: ctx.services.length } };
    }
    return {
      status: 'fail',
      message: ctx.services.length
        ? 'No active service has both a price and a duration.'
        : 'No active services, so there is nothing to book.',
      fix: 'Add a service with a duration and a price, and make sure it is active.',
      evidence: { activeServices: ctx.services.length },
    };
  },
};

export const setupBarbers: ShopHealthCheck = {
  id: 'setup.barbers',
  area: 'setup',
  title: 'Bookable barbers',
  severity: 'critical',
  kind: 'config',
  appliesWhen: always,
  run: (ctx) => {
    const bookable = ctx.barbers.filter((b) => b.serviceIds.length > 0 && b.activeRuleCount > 0);
    if (bookable.length > 0) {
      return { status: 'pass', message: `${plural(bookable.length, 'bookable barber')}.`, evidence: { bookable: bookable.map((b) => b.name) } };
    }
    if (ctx.barbers.length === 0) {
      return { status: 'fail', message: 'No active barbers.', fix: 'Add a barber and make them active.' };
    }
    const noServices = ctx.barbers.filter((b) => b.serviceIds.length === 0).map((b) => b.name);
    const noRules = ctx.barbers.filter((b) => b.activeRuleCount === 0).map((b) => b.name);
    return {
      status: 'fail',
      message: 'No barber can take bookings: each needs at least one active service and availability rules.',
      fix: 'Link services to a barber and set their working hours (availability rules).',
      evidence: { withoutServices: noServices, withoutAvailability: noRules },
    };
  },
};

export const setupServiceCoverage: ShopHealthCheck = {
  id: 'setup.service_coverage',
  area: 'setup',
  title: 'Every service has a barber',
  severity: 'warning',
  kind: 'config',
  appliesWhen: always,
  run: (ctx) => {
    const uncovered = ctx.services.filter((s) => s.barberIds.length === 0).map((s) => s.name);
    if (!ctx.services.length) return { status: 'skip', message: 'No active services yet.' };
    return uncovered.length === 0
      ? { status: 'pass', message: 'Every active service has at least one active barber.' }
      : {
          status: 'fail',
          message: `${plural(uncovered.length, 'service')} with no active barber: ${listNames(uncovered)}. Customers cannot book ${uncovered.length === 1 ? 'it' : 'them'}.`,
          fix: 'Link a barber to each service, or deactivate the service.',
          evidence: { services: uncovered },
        };
  },
};

export const setupBusiness: ShopHealthCheck = {
  id: 'setup.business',
  area: 'setup',
  title: 'Business details',
  severity: 'warning',
  kind: 'config',
  appliesWhen: always,
  run: (ctx) => {
    const missing: string[] = [];
    if (!ctx.profile?.hasAddressOrPostcode) missing.push('address or postcode');
    if (!ctx.profile?.hasPhone) missing.push('phone number');
    return missing.length === 0
      ? { status: 'pass', message: 'Address and phone number are set.' }
      : {
          status: 'fail',
          message: `Missing ${missing.join(' and ')}.`,
          fix: 'Add them in the shop’s business details (they appear on the website and in emails).',
          evidence: { missing },
        };
  },
};

export const bookingGate: ShopHealthCheck = {
  id: 'booking.gate',
  area: 'booking',
  title: 'Online booking accepted',
  severity: 'critical',
  kind: 'config',
  appliesWhen: live,
  run: (ctx) => {
    const copy = INTAKE_REASON_MESSAGES[ctx.intake.reason] ?? {
      message: `Online booking is not accepting bookings (${ctx.intake.reason}).`,
      fix: 'Check the shop’s plan and setup.',
    };
    return ctx.intake.accepting
      ? { status: 'pass', message: copy.message, evidence: { plan: ctx.access.state } }
      : { status: 'fail', message: copy.message, fix: copy.fix, evidence: { reason: ctx.intake.reason, plan: ctx.access.state } };
  },
};

export const bookingPaused: ShopHealthCheck = {
  id: 'booking.paused',
  area: 'booking',
  title: 'Online booking not paused',
  severity: 'critical',
  kind: 'config',
  appliesWhen: live,
  run: (ctx) =>
    isPauseActiveNow(ctx.shop, ctx.now)
      ? {
          status: 'fail',
          message: `Bookings and retail are paused today: “${pauseReasonMessage(ctx.shop).replace(/[.!?]\s*$/, '')}”.`,
          fix: 'If the pause is intended (e.g. a holiday) no action is needed; otherwise the owner can lift it in the dashboard.',
          evidence: {
            pauseFrom: ctx.shop.publicActivityPauseFrom?.toISOString() ?? null,
            pauseUntil: ctx.shop.publicActivityPauseUntil?.toISOString() ?? null,
          },
        }
      : { status: 'pass', message: 'Online booking is not paused.' },
};

export const bookingStuckPayments: ShopHealthCheck = {
  id: 'booking.stuck_payments',
  area: 'booking',
  title: 'Payment holds clear',
  severity: 'warning',
  kind: 'config',
  appliesWhen: (ctx) => when(depositsOn(ctx)),
  run: (ctx) =>
    ctx.stuckPendingPayments === 0
      ? { status: 'pass', message: 'No booking is stuck waiting for payment.' }
      : {
          status: 'fail',
          message: `${plural(ctx.stuckPendingPayments, 'booking')} still waiting for payment more than 30 minutes after the hold expired. These slots may be blocked.`,
          fix: 'Check the expire-deposit-holds cron and the Stripe webhook log.',
          evidence: { stuck: ctx.stuckPendingPayments },
        },
};

export const paymentsConnect: ShopHealthCheck = {
  id: 'payments.connect',
  area: 'payments',
  title: 'Stripe Connect',
  severity: 'critical',
  kind: 'config',
  appliesWhen: (ctx) => when(paymentsApply(ctx)),
  run: (ctx) => {
    const s = ctx.shop;
    const problems: string[] = [];
    if (!s.stripeConnectAccountId?.trim()) problems.push('no Stripe account connected');
    else {
      if (s.stripeConnectDisconnectedAt) problems.push('the account was disconnected from KERSIVO');
      if (!s.stripeConnectChargesEnabled) problems.push('charges are not enabled');
      if (!s.stripeConnectDetailsSubmitted) problems.push('account details are not submitted');
    }
    return problems.length === 0
      ? { status: 'pass', message: 'Stripe Connect is connected and can take payments.' }
      : {
          status: 'fail',
          message: `Customers cannot pay online: ${problems.join(', ')}.`,
          fix: 'Ask the owner to finish Stripe Connect onboarding in the dashboard (Payments).',
          evidence: {
            connected: Boolean(s.stripeConnectAccountId),
            chargesEnabled: s.stripeConnectChargesEnabled,
            detailsSubmitted: s.stripeConnectDetailsSubmitted,
            disconnected: Boolean(s.stripeConnectDisconnectedAt),
          },
        };
  },
};

const RETAIL_REASON_COPY: Record<string, string> = {
  demo_shop: 'this is a demo shop',
  unpaid_shop: 'the shop is not on a paid plan',
  connect_missing: 'no Stripe account is connected',
  connect_not_ready: 'Stripe charges are not enabled',
  retail_disabled: 'retail is switched off',
};

export const retailCanSell: ShopHealthCheck = {
  id: 'retail.can_sell',
  area: 'retail',
  title: 'Retail checkout',
  severity: 'critical',
  kind: 'config',
  appliesWhen: (ctx) => when(ctx.shop.retailEnabled),
  run: (ctx) => {
    if (!canSellRetail(ctx.shop)) {
      const { reason } = evaluateRetailSelling(ctx.shop);
      return {
        status: 'fail',
        message: `Customers cannot buy products: ${RETAIL_REASON_COPY[reason] ?? reason}.`,
        fix: 'Fix the payment setup (Stripe Connect and plan) or switch retail off.',
        evidence: { reason },
      };
    }
    if (isPauseActiveNow(ctx.shop, ctx.now)) {
      return {
        status: 'fail',
        message: 'Retail is paused together with bookings today.',
        fix: 'The owner can lift the pause in the dashboard.',
      };
    }
    return { status: 'pass', message: 'Retail checkout can take payments.' };
  },
};

export const retailProducts: ShopHealthCheck = {
  id: 'retail.products',
  area: 'retail',
  title: 'Products for sale',
  severity: 'critical',
  kind: 'config',
  appliesWhen: (ctx) => when(ctx.shop.retailEnabled),
  run: (ctx) => {
    const sellable = ctx.products.filter((p) => p.pricePence > 0);
    return sellable.length > 0
      ? { status: 'pass', message: `${plural(sellable.length, 'active product')} with a price.` }
      : {
          status: 'fail',
          message: 'Retail is on but there is no active product with a price.',
          fix: 'Add a product with a price, or switch retail off.',
          evidence: { activeProducts: ctx.products.length },
        };
  },
};

export const retailProductQuality: ShopHealthCheck = {
  id: 'retail.product_quality',
  area: 'retail',
  title: 'Product photos and descriptions',
  severity: 'warning',
  kind: 'config',
  appliesWhen: (ctx) => when(ctx.shop.retailEnabled),
  run: (ctx) => {
    if (!ctx.products.length) return { status: 'skip', message: 'No active products yet.' };
    const noImage = ctx.products.filter((p) => !p.hasImage).map((p) => p.name);
    const noDescription = ctx.products.filter((p) => !p.hasDescription).map((p) => p.name);
    if (!noImage.length && !noDescription.length) {
      return { status: 'pass', message: 'Every active product has a photo and a description.' };
    }
    const parts: string[] = [];
    if (noImage.length) parts.push(`${plural(noImage.length, 'product')} without a photo (${listNames(noImage)})`);
    if (noDescription.length) parts.push(`${plural(noDescription.length, 'product')} without a description (${listNames(noDescription)})`);
    return {
      status: 'fail',
      message: `${parts.join('; ')}.`,
      fix: 'Add a photo and a short description to each product.',
      evidence: { withoutPhoto: noImage, withoutDescription: noDescription },
    };
  },
};

export const retailTestOrder: ShopHealthCheck = {
  id: 'retail.test_order',
  area: 'retail',
  title: 'Retail test order',
  severity: 'info',
  kind: 'config',
  appliesWhen: (ctx) => when(ctx.shop.retailEnabled),
  run: (ctx) =>
    ctx.shop.retailTestOrderCompletedAt
      ? { status: 'pass', message: 'The owner completed a retail test order.' }
      : {
          status: 'warn',
          message: 'The owner has not completed a retail test order yet.',
          fix: 'Suggest the retail test order in the dashboard’s retail setup.',
        },
};

export const SMS_MIN_SAMPLE = 5;
export const SMS_MAX_FAIL_RATE = 0.2;

export const messagingSms: ShopHealthCheck = {
  id: 'messaging.sms',
  area: 'messaging',
  title: 'SMS reminders',
  severity: 'warning',
  kind: 'config',
  appliesWhen: (ctx) => when(ctx.shop.smsRemindersEnabled),
  run: (ctx) => {
    const settled = ctx.messaging.smsRecent.filter((s) => s !== 'QUEUED');
    const failed = settled.filter((s) => s === 'FAILED').length;
    const rate = settled.length ? failed / settled.length : 0;
    let streak = 0;
    for (const status of settled) {
      if (status !== 'FAILED') break;
      streak += 1;
    }
    const evidence = { sent7d: settled.length - failed, failed7d: failed, latestFailedInARow: streak };
    if (streak >= 3) {
      return {
        status: 'fail',
        message: `The last ${streak} SMS for this shop failed.`,
        fix: 'Check the SMS provider status and the shop’s phone numbers (docs/ops/messaging.md).',
        evidence,
      };
    }
    if (settled.length >= SMS_MIN_SAMPLE && rate >= SMS_MAX_FAIL_RATE) {
      return {
        status: 'fail',
        message: `${Math.round(rate * 100)}% of SMS failed in the last 7 days (${failed} of ${settled.length}).`,
        fix: 'Check the SMS provider status and the failed rows in /api/ops/outbound-failures.',
        evidence,
      };
    }
    return {
      status: 'pass',
      message: settled.length ? `${settled.length - failed} of ${settled.length} SMS sent in the last 7 days.` : 'No SMS in the last 7 days.',
      evidence,
    };
  },
};

export const messagingEmail: ShopHealthCheck = {
  id: 'messaging.email',
  area: 'messaging',
  title: 'Emails',
  severity: 'warning',
  kind: 'config',
  appliesWhen: always,
  run: (ctx) => {
    const { emailFailed7d, emailStuck7d } = ctx.messaging;
    if (!emailFailed7d && !emailStuck7d) return { status: 'pass', message: 'No failed or stuck emails in the last 7 days.' };
    const parts: string[] = [];
    if (emailFailed7d) parts.push(`${plural(emailFailed7d, 'email')} failed`);
    if (emailStuck7d) parts.push(`${plural(emailStuck7d, 'email')} stuck in the queue for over 30 minutes`);
    return {
      status: 'fail',
      message: `In the last 7 days: ${parts.join(', ')}.`,
      fix: 'Check the email outbox (docs/ops/email-outbox.md) and the failed rows in /api/ops/outbound-failures.',
      evidence: { failed7d: emailFailed7d, stuck7d: emailStuck7d },
    };
  },
};

export const websitePlan: ShopHealthCheck = {
  id: 'website.plan',
  area: 'website',
  title: 'Website included in plan',
  severity: 'critical',
  kind: 'config',
  appliesWhen: (ctx) => (ctx.mode === 'LIVE' ? when(websiteExpected(ctx)) : 'after_launch'),
  run: (ctx) =>
    hasKersivoCapability(ctx.access, 'BRANDED_SITE')
      ? { status: 'pass', message: 'The plan includes the branded website.' }
      : {
          status: 'fail',
          message: 'The shop has a website but its plan no longer includes it (no Full KERSIVO).',
          fix: 'Check the subscription; if the shop moved to Starter, take the website down or restore Full KERSIVO.',
          evidence: { plan: ctx.access.state },
        },
};

export const CONFIG_CHECKS: readonly ShopHealthCheck[] = [
  setupHours,
  setupServices,
  setupBarbers,
  setupServiceCoverage,
  setupBusiness,
  bookingGate,
  bookingPaused,
  bookingStuckPayments,
  paymentsConnect,
  retailCanSell,
  retailProducts,
  retailProductQuality,
  retailTestOrder,
  messagingSms,
  messagingEmail,
  websitePlan,
];
