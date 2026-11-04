import { describe, expect, it } from 'vitest';
import { healthyContext } from '../fixtures';
import { runCheck } from '../run';
import {
  CONFIG_CHECKS,
  bookingGate,
  bookingPaused,
  bookingStuckPayments,
  messagingEmail,
  messagingSms,
  paymentsConnect,
  retailCanSell,
  retailProductQuality,
  retailProducts,
  retailTestOrder,
  setupBarbers,
  setupBusiness,
  setupHours,
  setupServiceCoverage,
  setupServices,
  websitePlan,
} from './config';
import type { ShopHealthCheck, ShopHealthContext } from '../types';

const run = (check: ShopHealthCheck, ctx: ShopHealthContext) => runCheck(check, ctx);

describe('config checks on a healthy live shop', () => {
  it('every config check passes', async () => {
    const ctx = healthyContext();
    for (const check of CONFIG_CHECKS) {
      const result = await run(check, ctx);
      expect({ id: check.id, status: result.status }).toEqual({ id: check.id, status: check.id === 'booking.stuck_payments' ? 'skip' : 'pass' });
    }
  });

  it('ids are unique and every message is non-empty', async () => {
    const ids = CONFIG_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CONFIG_CHECKS) expect((await run(check, healthyContext())).message.length).toBeGreaterThan(5);
  });
});

describe('setup checks', () => {
  it('setup.hours fails with no open day', async () => {
    const r = await run(setupHours, healthyContext({ openDays: 0 }));
    expect(r).toMatchObject({ status: 'fail', severity: 'critical' });
    expect(r.fix).toMatch(/opening hours/);
  });

  it('setup.services needs a price and a duration', async () => {
    expect((await run(setupServices, healthyContext({ services: [] }))).status).toBe('fail');
    const r = await run(setupServices, healthyContext({ services: [{ id: 's', name: 'Free chat', pricePence: 0, durationMinutes: 15, barberIds: [] }] }));
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/price and a duration/);
  });

  it('setup.barbers needs a linked service and availability rules', async () => {
    const r = await run(setupBarbers, healthyContext({ barbers: [{ id: 'b', name: 'Sam', serviceIds: ['svc_1'], activeRuleCount: 0 }] }));
    expect(r.status).toBe('fail');
    expect(r.evidence).toMatchObject({ withoutAvailability: ['Sam'] });
    expect((await run(setupBarbers, healthyContext({ barbers: [] }))).message).toBe('No active barbers.');
  });

  it('setup.service_coverage names the uncovered services (warning)', async () => {
    const r = await run(
      setupServiceCoverage,
      healthyContext({ services: [{ id: 's2', name: 'Beard trim', pricePence: 1000, durationMinutes: 15, barberIds: [] }] }),
    );
    expect(r).toMatchObject({ status: 'fail', severity: 'warning' });
    expect(r.message).toContain('Beard trim');
    expect((await run(setupServiceCoverage, healthyContext({ services: [] }))).status).toBe('skip');
  });

  it('setup.business lists what is missing', async () => {
    const r = await run(setupBusiness, healthyContext({ profile: { hasAddressOrPostcode: false, hasPhone: false } }));
    expect(r.message).toBe('Missing address or postcode and phone number.');
    expect((await run(setupBusiness, healthyContext({ profile: null }))).status).toBe('fail');
  });
});

describe('live-only checks', () => {
  it('are "after launch" in a PRELAUNCH run', async () => {
    const ctx = healthyContext({ mode: 'PRELAUNCH' });
    for (const check of [bookingGate, bookingPaused, websitePlan]) {
      expect((await run(check, ctx)).status).toBe('after_launch');
    }
  });

  it('booking.gate fails with the gate reason in operator English', async () => {
    const r = await run(bookingGate, healthyContext({ intake: { accepting: false, reason: 'service_below_minimum', starterReadiness: null } }));
    expect(r.status).toBe('fail');
    expect(r.message).toBe('Starter online booking is paused: at least one active service is priced under £5.');
    expect(r.evidence).toMatchObject({ reason: 'service_below_minimum' });
  });

  it('booking.paused fails while a pause covers today, passes outside the window', async () => {
    const paused = healthyContext({
      shop: {
        publicActivityPaused: true,
        publicActivityPauseFrom: new Date('2026-11-01T12:00:00Z'),
        publicActivityPauseUntil: new Date('2026-11-10T12:00:00Z'),
        publicActivityPauseReason: 'Closed for refurbishment',
      },
    });
    const r = await run(bookingPaused, paused);
    expect(r.status).toBe('fail');
    expect(r.message).toContain('Closed for refurbishment');
    const later = healthyContext({
      shop: {
        publicActivityPaused: true,
        publicActivityPauseFrom: new Date('2026-12-01T12:00:00Z'),
        publicActivityPauseUntil: new Date('2026-12-10T12:00:00Z'),
      },
    });
    expect((await run(bookingPaused, later)).status).toBe('pass');
  });

  it('website.plan is skipped for a Starter shop without a site, fails for a site without BRANDED_SITE', async () => {
    const starter = healthyContext({
      access: { state: 'FREE_BOOKING', capabilities: ['PUBLIC_BOOKING'] },
      shop: { sitePreviewUrl: null },
    });
    expect((await run(websitePlan, starter)).status).toBe('skip');
    const lostPlan = healthyContext({ access: { state: 'FREE_BOOKING', capabilities: ['PUBLIC_BOOKING'] } });
    expect((await run(websitePlan, lostPlan)).status).toBe('fail');
  });
});

describe('payments and retail', () => {
  it('payments.connect applies to deposits, retail or Starter only', async () => {
    const none = healthyContext({ shop: { retailEnabled: false } });
    expect((await run(paymentsConnect, none)).status).toBe('skip');
    const deposits = healthyContext({ shop: { retailEnabled: false, bookingPaymentMode: 'DEPOSIT', stripeConnectChargesEnabled: false } });
    const r = await run(paymentsConnect, deposits);
    expect(r).toMatchObject({ status: 'fail', severity: 'critical' });
    expect(r.message).toContain('charges are not enabled');
    const disconnected = healthyContext({ shop: { stripeConnectDisconnectedAt: new Date() } });
    expect((await run(paymentsConnect, disconnected)).message).toContain('disconnected');
  });

  it('booking.stuck_payments applies with deposits on and counts stuck holds', async () => {
    const r = await run(bookingStuckPayments, healthyContext({ shop: { depositsEnabled: true }, stuckPendingPayments: 2 }));
    expect(r).toMatchObject({ status: 'fail', severity: 'warning' });
    expect(r.message).toMatch(/^2 bookings/);
  });

  it('retail checks are skipped when retail is off', async () => {
    const ctx = healthyContext({ shop: { retailEnabled: false } });
    for (const check of [retailCanSell, retailProducts, retailProductQuality, retailTestOrder]) {
      expect((await run(check, ctx)).status).toBe('skip');
    }
  });

  it('retail.can_sell explains why the shop cannot sell', async () => {
    const r = await run(retailCanSell, healthyContext({ shop: { stripeConnectAccountId: null } }));
    expect(r.message).toBe('Customers cannot buy products: no Stripe account is connected.');
  });

  it('retail.products needs a priced active product', async () => {
    expect((await run(retailProducts, healthyContext({ products: [] }))).status).toBe('fail');
  });

  it('retail.product_quality names products without photo or description', async () => {
    const r = await run(
      retailProductQuality,
      healthyContext({ products: [{ id: 'p', name: 'Pomade', pricePence: 900, hasImage: false, hasDescription: true }] }),
    );
    expect(r).toMatchObject({ status: 'fail', severity: 'warning' });
    expect(r.message).toContain('Pomade');
  });

  it('retail.test_order is info only', async () => {
    const r = await run(retailTestOrder, healthyContext({ shop: { retailTestOrderCompletedAt: null } }));
    expect(r).toMatchObject({ status: 'warn', severity: 'info' });
  });
});

describe('messaging', () => {
  it('messaging.sms fails on 3 failures in a row', async () => {
    const r = await run(messagingSms, healthyContext({ messaging: { smsRecent: ['FAILED', 'FAILED', 'FAILED', 'SENT'] } }));
    expect(r.status).toBe('fail');
    expect(r.message).toBe('The last 3 SMS for this shop failed.');
  });

  it('messaging.sms fails at a 20% fail rate over enough messages', async () => {
    const recent = ['SENT', 'FAILED', 'SENT', 'SENT', 'SENT', 'FAILED', 'SENT', 'SENT', 'SENT', 'SENT'] as const;
    const r = await run(messagingSms, healthyContext({ messaging: { smsRecent: [...recent] } }));
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/^20% of SMS failed/);
    const fewer = await run(messagingSms, healthyContext({ messaging: { smsRecent: ['SENT', 'FAILED', 'SENT'] } }));
    expect(fewer.status).toBe('pass');
  });

  it('messaging.sms is skipped when SMS reminders are off', async () => {
    expect((await run(messagingSms, healthyContext({ shop: { smsRemindersEnabled: false } }))).status).toBe('skip');
  });

  it('messaging.email reports failed and stuck emails', async () => {
    const r = await run(messagingEmail, healthyContext({ messaging: { emailFailed7d: 1, emailStuck7d: 2 } }));
    expect(r.status).toBe('fail');
    expect(r.message).toBe('In the last 7 days: 1 email failed, 2 emails stuck in the queue for over 30 minutes.');
  });
});
