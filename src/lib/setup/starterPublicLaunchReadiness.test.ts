import { describe, expect, it } from 'vitest';
import {
  resolveBookingPaymentSettlement,
  resolveStoredBookingPayment,
} from '@/lib/booking/bookingPaymentPolicy';
import { resolveBookingPaymentAccount } from '@/lib/booking/bookingPaymentAccount';
import { resolveGoogleBookingDestination } from '@/lib/shop/googleBooking';
import { hasKersivoCapability, resolveKersivoAccess } from '@/lib/shop/kersivoAccess';
import { resolvePublicBookingDestination } from '@/lib/shop/publicBookingDestination';
import { evaluateBookingPayments } from '@/lib/booking/bookingPaymentsGate';
import { accessForState } from '@/lib/shop/kersivoAccess';
import {
  evaluateStarterPublicLaunchReadiness,
  isStarterStripeAccountType,
  type StarterReadinessService,
} from './starterPublicLaunchReadiness';

const readyShop = {
  id: 'shop_1',
  stripeConnectAccountId: 'acct_standard',
  stripeConnectChargesEnabled: true,
  stripeConnectDisconnectedAt: null,
  stripeConnectAccountType: 'STANDARD' as string | null,
};

const services: StarterReadinessService[] = [
  { id: 'svc_cut', name: 'Skin Fade', pricePence: 2500, isActive: true },
  { id: 'svc_beard', name: 'Beard Trim', pricePence: 500, isActive: true },
];

const endedFullWithStarter = {
  status: 'CANCELED',
  currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  postFullPlan: 'STARTER',
  postFullTermsVersion: 'LEGACY_EFFECTIVE_PRE_V119',
};

const shopEntitlement = {
  id: 'shop_1',
  shopPaidAt: null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: null,
  departure: null,
};

describe('evaluateStarterPublicLaunchReadiness', () => {
  it('is ready with a payment-ready Stripe account and every active service at least £5', () => {
    expect(evaluateStarterPublicLaunchReadiness({ shop: readyShop, services })).toMatchObject({
      ready: true,
      reasons: [],
      stripe: { ready: true, accountLinked: true, disconnected: false, blocker: null },
      activeServiceCount: 2,
      minimumServicePricePence: 500,
      servicesBelowMinimum: [],
    });
  });

  it('blocks with too_many_bookable_barbers above 4 bookable barbers; 4 is allowed', () => {
    const over = evaluateStarterPublicLaunchReadiness({ shop: readyShop, services, activeBookableBarberCount: 5 });
    expect(over).toMatchObject({
      ready: false,
      reasons: ['too_many_bookable_barbers'],
      activeBookableBarberCount: 5,
      bookableBarberLimit: 4,
    });
    expect(
      evaluateStarterPublicLaunchReadiness({ shop: readyShop, services, activeBookableBarberCount: 4 }).ready,
    ).toBe(true);
  });

  it('names every active service below £5 and never mutates the service input', () => {
    const input: StarterReadinessService[] = [
      ...services,
      { id: 'svc_lineup', name: 'Line-up', pricePence: 300, isActive: true },
      { id: 'svc_free', name: 'Consultation', pricePence: 0, isActive: true },
    ];
    const snapshot = structuredClone(input);

    const readiness = evaluateStarterPublicLaunchReadiness({ shop: readyShop, services: input });

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toEqual(['service_below_minimum']);
    expect(readiness.servicesBelowMinimum).toEqual([
      { id: 'svc_lineup', name: 'Line-up', pricePence: 300 },
      { id: 'svc_free', name: 'Consultation', pricePence: 0 },
    ]);
    expect(input).toEqual(snapshot);
  });

  it('the owner resolves a £5 blocker by raising the price or making the service inactive', () => {
    const blocked = [...services, { id: 'svc_lineup', name: 'Line-up', pricePence: 300, isActive: true }];
    expect(evaluateStarterPublicLaunchReadiness({ shop: readyShop, services: blocked }).ready).toBe(false);

    const raised = blocked.map((s) => (s.id === 'svc_lineup' ? { ...s, pricePence: 500 } : s));
    expect(evaluateStarterPublicLaunchReadiness({ shop: readyShop, services: raised }).ready).toBe(true);

    const inactive = blocked.map((s) => (s.id === 'svc_lineup' ? { ...s, isActive: false } : s));
    expect(evaluateStarterPublicLaunchReadiness({ shop: readyShop, services: inactive }).ready).toBe(true);
  });

  it('requires at least one active service', () => {
    expect(evaluateStarterPublicLaunchReadiness({ shop: readyShop, services: [] })).toMatchObject({
      ready: false,
      reasons: ['no_active_services'],
    });
  });

  it.each([
    ['missing', { stripeConnectAccountId: null, stripeConnectChargesEnabled: false }, 'connect_missing'],
    [
      'explicitly disconnected (stale chargesEnabled=true)',
      { stripeConnectDisconnectedAt: new Date(), stripeConnectChargesEnabled: true },
      'connect_disconnected',
    ],
    ['chargesEnabled=false', { stripeConnectChargesEnabled: false }, 'connect_not_ready'],
  ])('pauses on Stripe %s', (_label, overrides, blocker) => {
    const readiness = evaluateStarterPublicLaunchReadiness({
      shop: { ...readyShop, ...overrides },
      services,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toEqual(['stripe_not_ready']);
    expect(readiness.stripe).toMatchObject({ ready: false, blocker });
  });

  describe('v1.19 Starter requires Stripe Connect Standard', () => {
    it('STANDARD + linked + charges enabled + not disconnected is Starter-ready', () => {
      expect(evaluateStarterPublicLaunchReadiness({ shop: readyShop, services }).stripe).toEqual({
        ready: true,
        accountLinked: true,
        disconnected: false,
        requiresStandard: false,
        blocker: null,
      });
    });

    it('legacy EXPRESS with charges enabled is NOT Starter-ready', () => {
      const readiness = evaluateStarterPublicLaunchReadiness({
        shop: { ...readyShop, stripeConnectAccountId: 'acct_legacy_express', stripeConnectAccountType: 'EXPRESS' },
        services,
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.reasons).toEqual(['stripe_not_ready']);
      expect(readiness.stripe).toMatchObject({
        ready: false,
        accountLinked: true,
        requiresStandard: true,
        blocker: 'connect_requires_standard',
      });
    });

    it('legacy EXPRESS with stale ready flags (charges + details) is still NOT Starter-ready', () => {
      const readiness = evaluateStarterPublicLaunchReadiness({
        shop: {
          ...readyShop,
          stripeConnectAccountType: 'EXPRESS',
          stripeConnectChargesEnabled: true,
          stripeConnectDetailsSubmitted: true,
        } as typeof readyShop,
        services,
      });
      expect(readiness.stripe.blocker).toBe('connect_requires_standard');
      expect(readiness.ready).toBe(false);
    });

    it.each([null, 'UNKNOWN', 'CUSTOM'])('account type %s fails closed', (type) => {
      const readiness = evaluateStarterPublicLaunchReadiness({
        shop: { ...readyShop, stripeConnectAccountType: type },
        services,
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.stripe.blocker).toBe('connect_requires_standard');
    });

    it('a disconnected Express account reports the disconnect (reconnect creates Standard)', () => {
      const readiness = evaluateStarterPublicLaunchReadiness({
        shop: { ...readyShop, stripeConnectAccountType: 'EXPRESS', stripeConnectDisconnectedAt: new Date() },
        services,
      });
      expect(readiness.stripe).toMatchObject({ requiresStandard: false, blocker: 'connect_disconnected' });
    });

    it('becomes ready again once a new Standard connection is payment-ready', () => {
      const express = { ...readyShop, stripeConnectAccountId: 'acct_legacy_express', stripeConnectAccountType: 'EXPRESS' };
      expect(evaluateStarterPublicLaunchReadiness({ shop: express, services }).ready).toBe(false);

      const onboarding = {
        ...readyShop,
        stripeConnectAccountId: 'acct_new_standard',
        stripeConnectAccountType: 'STANDARD',
        stripeConnectChargesEnabled: false,
      };
      expect(evaluateStarterPublicLaunchReadiness({ shop: onboarding, services }).stripe.blocker).toBe(
        'connect_not_ready',
      );

      const ready = { ...onboarding, stripeConnectChargesEnabled: true };
      expect(evaluateStarterPublicLaunchReadiness({ shop: ready, services }).ready).toBe(true);
    });

    it('isStarterStripeAccountType accepts only STANDARD', () => {
      expect(isStarterStripeAccountType('STANDARD')).toBe(true);
      for (const type of ['EXPRESS', 'UNKNOWN', 'CUSTOM', '', null, undefined]) {
        expect(isStarterStripeAccountType(type)).toBe(false);
      }
    });
  });

  it('reports Stripe and service blockers together so the owner sees every fix', () => {
    const readiness = evaluateStarterPublicLaunchReadiness({
      shop: { ...readyShop, stripeConnectAccountId: null },
      services: [{ id: 'svc_lineup', name: 'Line-up', pricePence: 300, isActive: true }],
    });
    expect(readiness.reasons).toEqual(['stripe_not_ready', 'service_below_minimum']);
  });

  it('evaluates under Starter rules even while the shop is still on Full (downgrade preview)', () => {
    // No access input: the preview never inherits Full Pay-at-shop allowances.
    const readiness = evaluateStarterPublicLaunchReadiness({
      shop: { ...readyShop, stripeConnectAccountId: null, stripeConnectChargesEnabled: false },
      services,
    });
    expect(readiness.stripe.blocker).toBe('connect_missing');
  });
});

describe('Full → Starter / v1.18 cutover lifecycle invariants', () => {
  it('Starter entitlement stays active (not SETUP) while public launch readiness fails', () => {
    const access = resolveKersivoAccess(shopEntitlement, endedFullWithStarter);
    const readiness = evaluateStarterPublicLaunchReadiness({
      shop: { ...readyShop, stripeConnectDisconnectedAt: new Date() },
      services: [{ id: 'svc_lineup', name: 'Line-up', pricePence: 300, isActive: true }],
    });

    expect(readiness.ready).toBe(false);
    expect(access.state).toBe('FREE_BOOKING');
    for (const capability of ['BOOKING_CORE', 'MANUAL_BOOKINGS', 'CLIENTS_CORE', 'TEAM', 'SERVICES'] as const) {
      expect(hasKersivoCapability(access, capability)).toBe(true);
    }
  });

  it('an existing v1.18 Starter shop keeps Starter entitlement at cutover even without Stripe', () => {
    const access = resolveKersivoAccess({
      ...shopEntitlement,
      freeBookingActivatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    const readiness = evaluateStarterPublicLaunchReadiness({
      shop: { ...readyShop, stripeConnectAccountId: null, stripeConnectChargesEnabled: false },
      services,
    });
    expect(access.state).toBe('FREE_BOOKING');
    expect(readiness).toMatchObject({ ready: false, reasons: ['stripe_not_ready'] });
  });

  it('QR and Google keep the stable hosted /book/{slug} destination while intake is paused', () => {
    const shop = { id: 'shop_1', bookingSlug: 'fade-lab' };
    const ownDomain = { shopId: 'shop_1', status: 'VERIFIED_LIVE', url: 'https://fadelab.co.uk/book' };

    expect(
      resolvePublicBookingDestination({ state: 'FREE_BOOKING', shop, fullDestination: ownDomain }),
    ).toEqual({ kind: 'hosted', path: '/book/fade-lab', source: 'starter_hosted' });
    expect(
      resolveGoogleBookingDestination({
        state: 'FREE_BOOKING',
        shop,
        fullDestination: ownDomain,
        publicSiteUrl: 'https://kersivo.co.uk',
      }),
    ).toEqual({ available: true, url: 'https://kersivo.co.uk/book/fade-lab', source: 'starter_hosted' });
  });

  it('historical Pay-at-shop (NONE) bookings stay NONE with nothing to charge or refund', () => {
    const historical = { bookingPaymentType: 'NONE' as const, paymentAmountPence: 0, paymentRequired: false };
    expect(resolveStoredBookingPayment(historical)).toEqual({ type: 'NONE', amountPence: 0 });
    for (const event of ['client_cancel_late', 'no_show', 'shop_cancel'] as const) {
      expect(
        resolveBookingPaymentSettlement({ bookingPaymentType: 'NONE', paymentAmountPence: 0, event }),
      ).toEqual({ refundPence: 0, retainedPence: 0 });
    }
  });

  it('Full KERSIVO keeps legacy Express booking-payment compatibility (generic gate unchanged)', () => {
    expect(
      evaluateBookingPayments({
        shop: { id: 'shop_1', stripeConnectAccountId: 'acct_legacy_express', stripeConnectChargesEnabled: true },
        access: accessForState('FULL_KERSIVO'),
      }),
    ).toEqual({ ok: true, reason: 'ok' });
  });

  it('historical Express payment snapshots keep refunding on their original account after reconnect', () => {
    expect(
      resolveBookingPaymentAccount({
        booking: { stripeConnectAccountIdAtPayment: 'acct_legacy_express', kersivoPlatformFeePence: 0 },
        currentShopAccountId: 'acct_new_standard',
      }),
    ).toEqual({ ok: true, accountId: 'acct_legacy_express', source: 'snapshot' });
  });
});
