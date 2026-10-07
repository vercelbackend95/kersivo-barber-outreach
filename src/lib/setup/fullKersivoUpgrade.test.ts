import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { resolveFullUpgradeEligibility } from './fullKersivoUpgrade';
import { resolveKersivoAccess } from '@/lib/shop/kersivoAccess';
import { resolveLiveBookingPayment } from '@/lib/booking/bookingPaymentsGate';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

const NOW = new Date('2026-10-04T12:00:00Z');
const FUTURE = new Date('2026-10-30T12:00:00Z');
const PAST = new Date('2026-09-01T12:00:00Z');
const FREE_MARKER = new Date('2026-08-01T09:00:00Z');

const freeShop = {
  id: 'shop-1',
  shopPaidAt: null,
  smsRemindersEnabled: false,
  freeBookingActivatedAt: FREE_MARKER,
};
const setupShop = { ...freeShop, freeBookingActivatedAt: null };

function dbWith(shop: Record<string, unknown> | null, subscription: Record<string, unknown> | null) {
  return {
    shopSettings: { findUnique: vi.fn(async () => shop) },
    saasSubscription: { findFirst: vi.fn(async () => subscription) },
  } as never;
}

describe('Full KERSIVO entitlement after upgrade (central resolver)', () => {
  it('R: Free marker + active subscription → FULL_KERSIVO (Full wins, marker may remain)', () => {
    const access = resolveKersivoAccess(freeShop, { status: 'ACTIVE', currentPeriodEnd: FUTURE }, NOW);
    expect(access.state).toBe('FULL_KERSIVO');
  });

  it('S: Starter marker + ended Full without an explicit Starter choice → SETUP', () => {
    for (const postFullPlan of [undefined, 'UNDECIDED', 'CHOICE_REQUIRED', 'LEAVE']) {
      const access = resolveKersivoAccess(
        freeShop,
        { status: 'CANCELED', currentPeriodEnd: PAST, postFullPlan },
        NOW,
      );
      expect(access.state, String(postFullPlan)).toBe('SETUP');
    }
  });

  it('a shop leaving KERSIVO cannot start a Full checkout', async () => {
    const result = await resolveFullUpgradeEligibility(
      'shop-1',
      NOW,
      dbWith({ ...freeShop, departure: { status: 'WINDING_DOWN' } }, null),
    );
    expect(result).toEqual({ ok: false, reason: 'departure_in_progress' });
  });

  it('S2: ended Full + explicit Starter choice → FREE_BOOKING', () => {
    const access = resolveKersivoAccess(
      freeShop,
      { status: 'CANCELED', currentPeriodEnd: PAST, postFullPlan: 'STARTER', postFullTermsVersion: 'LEGACY_EFFECTIVE_PRE_V119' },
      NOW,
    );
    expect(access.state).toBe('FREE_BOOKING');
  });

  it('T: SETUP + active subscription → FULL_KERSIVO (no Free marker needed)', () => {
    const access = resolveKersivoAccess(setupShop, { status: 'ACTIVE', currentPeriodEnd: FUTURE }, NOW);
    expect(access.state).toBe('FULL_KERSIVO');
  });

  it('U: SETUP + no subscription → SETUP (an unpaid PENDING attempt grants nothing)', () => {
    expect(resolveKersivoAccess(setupShop, null, NOW).state).toBe('SETUP');
    expect(resolveKersivoAccess(setupShop, { status: 'PENDING', currentPeriodEnd: null }, NOW).state).toBe(
      'SETUP',
    );
  });
});

describe('resolveFullUpgradeEligibility', () => {
  it('allows SETUP and Free Booking shops', async () => {
    await expect(resolveFullUpgradeEligibility('shop-1', NOW, dbWith(setupShop, null))).resolves.toEqual({
      ok: true,
      state: 'SETUP',
    });
    await expect(resolveFullUpgradeEligibility('shop-1', NOW, dbWith(freeShop, null))).resolves.toEqual({
      ok: true,
      state: 'FREE_BOOKING',
    });
  });

  it('reads only the latest non-PENDING subscription for this shop', async () => {
    const db = dbWith(freeShop, null) as unknown as {
      saasSubscription: { findFirst: ReturnType<typeof vi.fn> };
    };
    await resolveFullUpgradeEligibility('shop-1', NOW, db as never);
    expect(db.saasSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1', status: { not: 'PENDING' } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('does not trust a stale shopPaidAt once the subscription has ended', async () => {
    const stale = { ...freeShop, shopPaidAt: PAST };
    await expect(
      resolveFullUpgradeEligibility(
        'shop-1',
        NOW,
        dbWith(stale, {
          status: 'CANCELED',
          currentPeriodEnd: PAST,
          postFullPlan: 'STARTER',
          postFullTermsVersion: 'LEGACY_EFFECTIVE_PRE_V119',
        }),
      ),
    ).resolves.toEqual({ ok: true, state: 'FREE_BOOKING' });
  });

  it.each(['LEAVE', 'CHOICE_REQUIRED', 'UNDECIDED', undefined])(
    'ended Full + %s before the ShopDeparture row exists → no new Full checkout',
    async (postFullPlan) => {
      await expect(
        resolveFullUpgradeEligibility(
          'shop-1',
          NOW,
          dbWith(freeShop, { status: 'CANCELED', currentPeriodEnd: PAST, postFullPlan }),
        ),
      ).resolves.toEqual({ ok: false, reason: 'departure_in_progress' });
    },
  );

  it('ended Full + explicit STARTER → active Starter may still upgrade to Full', async () => {
    await expect(
      resolveFullUpgradeEligibility(
        'shop-1',
        NOW,
        dbWith(freeShop, {
          status: 'CANCELED',
          currentPeriodEnd: PAST,
          postFullPlan: 'STARTER',
          postFullTermsVersion: 'LEGACY_EFFECTIVE_PRE_V119',
        }),
      ),
    ).resolves.toEqual({ ok: true, state: 'FREE_BOOKING' });
  });

  it('selects postFullTermsVersion so legacy-effective Starter resolves correctly', async () => {
    const db = dbWith(freeShop, null) as unknown as {
      saasSubscription: { findFirst: ReturnType<typeof vi.fn> };
    };
    await resolveFullUpgradeEligibility('shop-1', NOW, db as never);
    expect(db.saasSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ postFullTermsVersion: true }) }),
    );
  });

  it('active paid Full with LEAVE scheduled stays already_full (not departure logic)', async () => {
    await expect(
      resolveFullUpgradeEligibility(
        'shop-1',
        NOW,
        dbWith(freeShop, { status: 'ACTIVE', currentPeriodEnd: FUTURE, cancelAtPeriodEnd: true, postFullPlan: 'LEAVE' }),
      ),
    ).resolves.toEqual({ ok: false, reason: 'already_full' });
  });

  it.each([
    ['ACTIVE', { status: 'ACTIVE', currentPeriodEnd: FUTURE }, 'already_full'],
    ['cancelAtPeriodEnd', { status: 'ACTIVE', currentPeriodEnd: FUTURE, cancelAtPeriodEnd: true }, 'already_full'],
    ['PAST_DUE in grace', { status: 'PAST_DUE', currentPeriodEnd: FUTURE, pastDueSince: NOW }, 'billing_recovery'],
    ['PAST_DUE after grace', { status: 'PAST_DUE', currentPeriodEnd: FUTURE, pastDueSince: PAST }, 'billing_recovery'],
    ['SUSPENDED', { status: 'SUSPENDED', currentPeriodEnd: FUTURE }, 'billing_recovery'],
  ])('%s → %s', async (_label, subscription, reason) => {
    await expect(
      resolveFullUpgradeEligibility('shop-1', NOW, dbWith(freeShop, subscription)),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('demo shops and missing shops are not purchasable', async () => {
    await expect(resolveFullUpgradeEligibility(DEMO_SHOP_ID, NOW, dbWith(freeShop, null))).resolves.toEqual({
      ok: false,
      reason: 'not_purchasable',
    });
    await expect(resolveFullUpgradeEligibility('shop-1', NOW, dbWith(null, null))).resolves.toEqual({
      ok: false,
      reason: 'shop_not_found',
    });
  });
});

describe('booking payment continuity across the upgrade', () => {
  const shop = {
    id: 'shop-1',
    stripeConnectAccountId: 'acct_shop_1',
    stripeConnectChargesEnabled: true,
  };
  const before = resolveKersivoAccess(freeShop, null, NOW);
  const after = resolveKersivoAccess(freeShop, { status: 'ACTIVE', currentPeriodEnd: FUTURE }, NOW);

  it('V: a booking taken while on Starter has a 0% KERSIVO fee snapshot', () => {
    const decision = resolveLiveBookingPayment({
      mode: 'FULL',
      servicePricePence: 2500,
      shop,
      access: before,
    });
    expect(decision).toMatchObject({
      outcome: 'collect',
      snapshot: { kersivoPlatformFeeBps: 0, kersivoPlatformFeePence: 0, paymentAmountPence: 2500 },
    });
  });

  it('V/X/Y: no upgrade or entitlement path rewrites booking fee snapshots, payment mode or Connect', () => {
    const files = [
      'src/pages/api/admin/subscription/upgrade-checkout.ts',
      'src/lib/setup/authenticatedSaasCheckout.ts',
      'src/lib/setup/fullKersivoUpgrade.ts',
      'src/pages/api/setup/claim-paid-subscription.ts',
      'src/lib/shop/markShopPaid.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/kersivoPlatformFee(Bps|Pence)/);
      expect(source, file).not.toMatch(/bookingPaymentMode/);
      expect(source, file).not.toMatch(/stripeConnect/);
      expect(source, file).not.toMatch(/\bbooking\.(update|updateMany|create)/);
      expect(source, file).not.toMatch(/data:\s*\{[^}]*freeBookingActivatedAt/s);
    }
  });

  it('W: a booking taken after Full is active has a 0% KERSIVO fee', () => {
    const decision = resolveLiveBookingPayment({
      mode: 'FULL',
      servicePricePence: 2500,
      shop,
      access: after,
    });
    expect(decision).toMatchObject({
      outcome: 'collect',
      snapshot: { kersivoPlatformFeeBps: 0, kersivoPlatformFeePence: 0, paymentAmountPence: 2500 },
    });
  });

  it.each(['NONE', 'DEPOSIT', 'FULL'] as const)(
    'X/Y: bookingPaymentMode %s and the Connect account are the same before and after',
    (mode) => {
      const pre = resolveLiveBookingPayment({ mode, servicePricePence: 2500, shop, access: before });
      const post = resolveLiveBookingPayment({ mode, servicePricePence: 2500, shop, access: after });
      expect(post.outcome).toBe(pre.outcome);
      if (pre.outcome === 'collect' && post.outcome === 'collect') {
        expect(post.stripeConnectAccountId).toBe('acct_shop_1');
        expect(pre.stripeConnectAccountId).toBe('acct_shop_1');
        expect(post.snapshot.bookingPaymentType).toBe(pre.snapshot.bookingPaymentType);
        expect(post.snapshot.paymentAmountPence).toBe(pre.snapshot.paymentAmountPence);
      }
    },
  );
});
