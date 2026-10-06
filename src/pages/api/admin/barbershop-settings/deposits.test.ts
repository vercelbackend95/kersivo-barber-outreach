import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { ShopRole } from '@prisma/client';
import { accessForState, type KersivoProductState } from '@/lib/shop/kersivoAccess';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

const requireAdminContext = vi.fn();
const shopSettingsFindUnique = vi.fn();
const shopSettingsUpdate = vi.fn();
const shopSettingsUpdateMany = vi.fn();
const createConnectStandardAccount = vi.fn();
const createConnectAccountLink = vi.fn();
const retrieveConnectAccount = vi.fn();
const loadKersivoAccess = vi.fn();
const txShopFindUnique = vi.fn();
const txShopUpdate = vi.fn();
const txBookingUpdateMany = vi.fn();
const txQueryRaw = vi.fn(async (..._args: unknown[]) => []);
const recordAccountLifecycleEvent = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  requireAdminContext: (...args: unknown[]) => requireAdminContext(...args),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    shopSettings: {
      findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args),
      update: (...args: unknown[]) => shopSettingsUpdate(...args),
      updateMany: (...args: unknown[]) => shopSettingsUpdateMany(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: (...args: unknown[]) => txQueryRaw(...args),
        shopSettings: {
          findUnique: (...args: unknown[]) => txShopFindUnique(...args),
          update: (...args: unknown[]) => txShopUpdate(...args),
        },
        booking: { updateMany: (...args: unknown[]) => txBookingUpdateMany(...args) },
      }),
  },
}));

vi.mock('@/lib/setup/accountLifecycleAudit', () => ({
  ACCOUNT_LIFECYCLE_ACTIONS: { STARTER_STRIPE_STANDARD_SWITCHED: 'STARTER_STRIPE_STANDARD_SWITCHED' },
  recordAccountLifecycleEvent: (...args: unknown[]) => recordAccountLifecycleEvent(...args),
}));

vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shop/kersivoAccess')>()),
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));

vi.mock('@/lib/shop/stripeConnect', () => ({
  createConnectStandardAccount: (...args: unknown[]) => createConnectStandardAccount(...args),
  createConnectAccountLink: (...args: unknown[]) => createConnectAccountLink(...args),
  retrieveConnectAccount: (...args: unknown[]) => retrieveConnectAccount(...args),
  StripeConnectApiError: class StripeConnectApiError extends Error {
    status: number;
    code: string | null;
    constructor(message: string, status: number, code: string | null = null) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.co.uk',
}));

import { GET, PATCH, POST } from './deposits';

function accessFor(role: ShopRole, shopId = 'shop-1') {
  return {
    shopId,
    userId: 'u1',
    role,
    via: 'session' as const,
    emailVerified: true,
  };
}

function jsonCtx(method: string, body?: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/admin/barbershop-settings/deposits', {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
  } as unknown as APIContext;
}

const paidShop = {
  id: 'shop-1',
  shopPaidAt: new Date('2026-01-01T00:00:00.000Z') as Date | null,
  smsRemindersEnabled: true,
  depositsEnabled: false,
  bookingPaymentMode: 'NONE',
  stripeConnectAccountId: 'acct_existing' as string | null,
  stripeConnectAccountType: 'EXPRESS' as 'EXPRESS' | 'STANDARD' | null,
  stripeConnectChargesEnabled: true,
  stripeConnectDetailsSubmitted: true,
  stripeConnectDisconnectedAt: null as Date | null,
  cancellationWindowHours: 24,
  rescheduleWindowHours: 24,
  maxClientReschedules: 2,
  owner: { email: 'owner@example.com' },
};

const freeShop = { ...paidShop, shopPaidAt: null, smsRemindersEnabled: false };

function asState(state: KersivoProductState) {
  loadKersivoAccess.mockResolvedValue(accessForState(state));
}

describe('barbershop-settings/deposits (booking payments)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asState('FULL_KERSIVO');
    retrieveConnectAccount.mockResolvedValue({
      chargesEnabled: true,
      detailsSubmitted: true,
      accountType: 'STANDARD',
    });
    createConnectAccountLink.mockResolvedValue({ url: 'https://connect.stripe.com/setup/s/xxx' });
    shopSettingsUpdate.mockResolvedValue({});
  });

  describe('POST Connect onboarding', () => {
    it('rejects MANAGER with 403 and does not create a Connect account', async () => {
      requireAdminContext.mockResolvedValue(accessFor('MANAGER'));

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.permission).toBe('billing.manage');
      expect(createConnectStandardAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
      expect(shopSettingsFindUnique).not.toHaveBeenCalled();
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });

    it('rejects BARBER with 403', async () => {
      requireAdminContext.mockResolvedValue(accessFor('BARBER'));

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      expect(createConnectStandardAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
    });

    it('W: Full OWNER creates a Connect account and gets an onboarding url', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...paidShop,
        stripeConnectAccountId: null,
        stripeConnectAccountType: null,
      });
      createConnectStandardAccount.mockResolvedValue({ id: 'acct_new' });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe('https://connect.stripe.com/setup/s/xxx');
      expect(body.accountId).toBe('acct_new');
      expect(createConnectStandardAccount).toHaveBeenCalledWith({
        shopId: 'shop-1',
        email: 'owner@example.com',
      });
      expect(shopSettingsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeConnectAccountId: 'acct_new',
            stripeConnectAccountType: 'STANDARD',
            stripeConnectDisconnectedAt: null,
          }),
        }),
      );
    });

    it('V: Free OWNER can start Stripe Connect onboarding', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...freeShop,
        stripeConnectAccountId: null,
        stripeConnectAccountType: null,
      });
      createConnectStandardAccount.mockResolvedValue({ id: 'acct_free' });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(200);
      expect((await res.json()).accountId).toBe('acct_free');
      expect(loadKersivoAccess).toHaveBeenCalledWith('shop-1');
      expect(createConnectStandardAccount).toHaveBeenCalled();
    });

    it('creates a fresh Standard account after the previous connection was deauthorized', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...freeShop,
        stripeConnectAccountId: 'acct_old_standard',
        stripeConnectAccountType: 'STANDARD',
        stripeConnectDisconnectedAt: new Date('2026-10-05T10:00:00.000Z'),
        stripeConnectChargesEnabled: false,
        stripeConnectDetailsSubmitted: false,
      });
      createConnectStandardAccount.mockResolvedValue({ id: 'acct_reconnected' });

      const res = await POST(jsonCtx('POST'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.accountId).toBe('acct_reconnected');
      expect(body.accountType).toBe('STANDARD');
      expect(createConnectStandardAccount).toHaveBeenCalled();
      expect(shopSettingsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeConnectAccountId: 'acct_reconnected',
            stripeConnectAccountType: 'STANDARD',
            stripeConnectChargesEnabled: false,
            stripeConnectDetailsSubmitted: false,
            stripeConnectDisconnectedAt: null,
            connectStatusEventAt: null,
          }),
        }),
      );
    });

    it('Full: does not silently migrate an existing active Express account', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...paidShop,
        stripeConnectAccountId: 'acct_legacy_express',
        stripeConnectAccountType: 'EXPRESS',
        stripeConnectDisconnectedAt: null,
      });

      const res = await POST(jsonCtx('POST'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.accountId).toBe('acct_legacy_express');
      expect(body.accountType).toBe('EXPRESS');
      expect(body.legacyExpress).toBe(true);
      expect(createConnectStandardAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'acct_legacy_express' }),
      );
    });

    describe('Starter on a legacy Express account → new Standard account', () => {
      const expressStarter = {
        ...freeShop,
        stripeConnectAccountId: 'acct_legacy_express',
        stripeConnectAccountType: 'EXPRESS' as const,
        stripeConnectDisconnectedAt: null,
      };

      beforeEach(() => {
        asState('FREE_BOOKING');
        requireAdminContext.mockResolvedValue(accessFor('OWNER'));
        shopSettingsFindUnique.mockResolvedValue(expressStarter);
        createConnectStandardAccount.mockResolvedValue({ id: 'acct_new_standard' });
        txShopFindUnique.mockResolvedValue({
          stripeConnectAccountId: 'acct_legacy_express',
          stripeConnectDisconnectedAt: null,
        });
        txBookingUpdateMany.mockResolvedValue({ count: 2 });
        txShopUpdate.mockResolvedValue({});
      });

      it('creates Standard, pins pre-snapshot paid bookings to Express, then switches the shop', async () => {
        const res = await POST(jsonCtx('POST'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toMatchObject({ accountId: 'acct_new_standard', accountType: 'STANDARD', legacyExpress: false });
        expect(createConnectStandardAccount).toHaveBeenCalledWith({ shopId: 'shop-1', email: 'owner@example.com' });
        expect(createConnectAccountLink).toHaveBeenCalledWith(
          expect.objectContaining({ accountId: 'acct_new_standard' }),
        );
        expect(txQueryRaw).toHaveBeenCalled();

        // Only MISSING snapshots on rows that touched Stripe with no KERSIVO fee are filled, with
        // the exact account they resolve to today — existing snapshots are never overwritten.
        expect(txBookingUpdateMany).toHaveBeenCalledWith({
          where: {
            barber: { is: { shopId: 'shop-1' } },
            stripeConnectAccountIdAtPayment: null,
            OR: [{ stripePaymentIntentId: { not: null } }, { stripeCheckoutSessionId: { not: null } }],
            AND: [{ OR: [{ kersivoPlatformFeePence: null }, { kersivoPlatformFeePence: 0 }] }],
          },
          data: { stripeConnectAccountIdAtPayment: 'acct_legacy_express' },
        });
        const pinOrder = txBookingUpdateMany.mock.invocationCallOrder[0];
        const switchOrder = txShopUpdate.mock.invocationCallOrder[0];
        expect(pinOrder).toBeLessThan(switchOrder);

        expect(txShopUpdate).toHaveBeenCalledWith({
          where: { id: 'shop-1' },
          data: {
            stripeConnectAccountId: 'acct_new_standard',
            stripeConnectAccountType: 'STANDARD',
            stripeConnectChargesEnabled: false,
            stripeConnectDetailsSubmitted: false,
            stripeConnectDisconnectedAt: null,
            connectStatusEventAt: null,
          },
        });
        expect(shopSettingsUpdate).not.toHaveBeenCalled();
        expect(recordAccountLifecycleEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'STARTER_STRIPE_STANDARD_SWITCHED',
            shopId: 'shop-1',
            meta: expect.objectContaining({
              legacyAccountId: 'acct_legacy_express',
              legacyAccountType: 'EXPRESS',
              standardAccountId: 'acct_new_standard',
              pinnedLegacyBookings: 2,
            }),
          }),
        );
      });

      it('aborts without touching bookings or the shop if the account changed concurrently', async () => {
        txShopFindUnique.mockResolvedValue({
          stripeConnectAccountId: 'acct_someone_else',
          stripeConnectDisconnectedAt: null,
        });

        const res = await POST(jsonCtx('POST'));

        expect(res.status).toBe(409);
        expect(txBookingUpdateMany).not.toHaveBeenCalled();
        expect(txShopUpdate).not.toHaveBeenCalled();
        expect(createConnectAccountLink).not.toHaveBeenCalled();
        expect(recordAccountLifecycleEvent).not.toHaveBeenCalled();
      });

      it('a Starter already on Standard just continues onboarding (no new account, no booking writes)', async () => {
        shopSettingsFindUnique.mockResolvedValue({
          ...expressStarter,
          stripeConnectAccountId: 'acct_standard',
          stripeConnectAccountType: 'STANDARD',
        });

        const res = await POST(jsonCtx('POST'));

        expect(res.status).toBe(200);
        expect((await res.json()).accountId).toBe('acct_standard');
        expect(createConnectStandardAccount).not.toHaveBeenCalled();
        expect(txBookingUpdateMany).not.toHaveBeenCalled();
      });
    });

    it('X: SETUP shop cannot start onboarding', async () => {
      asState('SETUP');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...freeShop, stripeConnectAccountId: null });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('BOOKING_PAYMENTS_NOT_AVAILABLE');
      expect(createConnectStandardAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
    });

    it('X: demo shop cannot start onboarding, even with Full access', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER', DEMO_SHOP_ID));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, id: DEMO_SHOP_ID, stripeConnectAccountId: null });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      expect(createConnectStandardAccount).not.toHaveBeenCalled();
    });
  });

  describe('PATCH booking payment mode', () => {
    it('rejects MANAGER with 403 and does not update', async () => {
      requireAdminContext.mockResolvedValue(accessFor('MANAGER'));

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.permission).toBe('billing.manage');
      expect(shopSettingsFindUnique).not.toHaveBeenCalled();
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects BARBER with 403', async () => {
      requireAdminContext.mockResolvedValue(accessFor('BARBER'));

      const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'DEPOSIT' }));
      expect(res.status).toBe(403);
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('R / AC: legacy depositsEnabled=true on Full atomically sets DEPOSIT', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' });
      expect(shopSettingsUpdateMany).toHaveBeenCalledTimes(1);
      expect(shopSettingsUpdateMany).toHaveBeenCalledWith({
        where: { id: 'shop-1', bookingPaymentMode: { not: 'FULL' } },
        data: { depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' },
      });
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });

    it('R: legacy depositsEnabled=false atomically sets NONE', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, depositsEnabled: true });
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: false }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ depositsEnabled: false, bookingPaymentMode: 'NONE' });
      expect(shopSettingsUpdateMany).toHaveBeenCalledWith({
        where: { id: 'shop-1', bookingPaymentMode: { not: 'FULL' } },
        data: { depositsEnabled: false, bookingPaymentMode: 'NONE' },
      });
    });

    it('v1.19: Starter payment controls are read-only even for OWNER with billing.manage', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));

      for (const body of [
        { bookingPaymentMode: 'NONE' },
        { bookingPaymentMode: 'DEPOSIT' },
        { bookingPaymentMode: 'FULL' },
        { depositsEnabled: true },
        { depositsEnabled: false },
      ]) {
        const res = await PATCH(jsonCtx('PATCH', body));
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe('STARTER_PAYMENT_SETTINGS_READ_ONLY');
      }

      expect(shopSettingsFindUnique).not.toHaveBeenCalled();
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('v1.19: SETUP cannot edit booking payment controls', async () => {
      asState('SETUP');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));

      const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'DEPOSIT' }));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('STARTER_PAYMENT_SETTINGS_READ_ONLY');
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('4C-I / K: Full may set FULL; FULL writes depositsEnabled=false', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' });
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'FULL' }));
      expect(res.status).toBe(200);
      expect(shopSettingsUpdateMany.mock.calls[0][0].data).toEqual({
        depositsEnabled: false,
        bookingPaymentMode: 'FULL',
      });
    });

    it('4C-J: Full online-payment modes fail closed without ready Connect; demo is denied', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      for (const shop of [
        { ...paidShop, stripeConnectAccountId: null },
        { ...paidShop, stripeConnectChargesEnabled: false },
      ]) {
        shopSettingsFindUnique.mockResolvedValue(shop);
        const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'FULL' }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe('BOOKING_PAYMENT_NOT_READY');
      }

      asState('FULL_KERSIVO');
      requireAdminContext.mockResolvedValue(accessFor('OWNER', DEMO_SHOP_ID));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, id: DEMO_SHOP_ID });
      const demo = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'FULL' }));
      expect(demo.status).toBe(403);

      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('4C-M: an explicit bookingPaymentMode request may move FULL → NONE / DEPOSIT', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, bookingPaymentMode: 'FULL' });
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      for (const mode of ['NONE', 'DEPOSIT'] as const) {
        const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: mode }));
        expect(res.status).toBe(200);
        expect((await res.json()).bookingPaymentMode).toBe(mode);
      }
      for (const call of shopSettingsUpdateMany.mock.calls) {
        expect(call[0].where).toEqual({ id: 'shop-1' });
      }
      expect(shopSettingsUpdateMany.mock.calls.map((call) => call[0].data)).toEqual([
        { depositsEnabled: false, bookingPaymentMode: 'NONE' },
        { depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' },
      ]);
    });

    it('rejects unknown modes and empty payloads', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      for (const body of [{ bookingPaymentMode: 'deposit' }, { bookingPaymentMode: 1 }, {}]) {
        const res = await PATCH(jsonCtx('PATCH', body));
        expect(res.status).toBe(400);
      }
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('S / 4C-L: a legacy depositsEnabled request cannot overwrite FULL (409, nothing written)', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);
      shopSettingsUpdateMany.mockResolvedValue({ count: 0 });

      for (const body of [{ depositsEnabled: false }, { depositsEnabled: true }]) {
        const res = await PATCH(jsonCtx('PATCH', body));
        expect(res.status).toBe(409);
        expect((await res.json()).code).toBe('booking_payment_mode_full');
      }
      for (const call of shopSettingsUpdateMany.mock.calls) {
        expect(call[0].where.bookingPaymentMode).toEqual({ not: 'FULL' });
        expect(call[0].data.bookingPaymentMode).not.toBe('FULL');
      }
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });
  });

  describe('GET booking payment status', () => {
    it('redacts accountId for MANAGER and reports accountLinked', async () => {
      requireAdminContext.mockResolvedValue(accessFor('MANAGER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);

      const res = await GET(jsonCtx('GET'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.canManagePayouts).toBe(false);
      expect(body.connect.accountId).toBeNull();
      expect(body.connect.accountLinked).toBe(true);
      expect(body.connect.chargesEnabled).toBe(true);
    });

    it('Full: reports product state, mode, readiness and a 0% fee', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, bookingPaymentMode: 'DEPOSIT', depositsEnabled: true });

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(body).toMatchObject({
        paid: true,
        productState: 'FULL_KERSIVO',
        bookingPaymentMode: 'DEPOSIT',
        effectiveBookingPaymentPolicy: 'DEPOSIT',
        paymentControlsEditable: true,
        starterPaymentPolicy: null,
        bookingPaymentsAvailable: true,
        bookingPaymentsReady: true,
        collectReady: true,
        platformFeeBps: 0,
        platformFeeExamplePence: 0,
        canManagePayouts: true,
      });
      expect(body.connect.accountId).toBe('acct_existing');
    });

    it('Starter: reports a 0% KERSIVO fee and paid=false (Retail stays Full-only)', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(freeShop);

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(body).toMatchObject({
        paid: false,
        productState: 'FREE_BOOKING',
        bookingPaymentMode: 'NONE',
        effectiveBookingPaymentPolicy: 'STARTER_FIXED',
        paymentControlsEditable: false,
        starterPaymentPolicy: {
          minimumOnlinePaymentPence: 500,
          payInFullAvailable: true,
          publicPayAtShop: false,
        },
        bookingPaymentsAvailable: true,
        bookingPaymentsReady: true,
        collectReady: true,
        platformFeeBps: 0,
        platformFeeExamplePence: 0,
      });
    });

    it('fails closed when Stripe says the stored account is no longer accessible', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);
      const { StripeConnectApiError } = await import('@/lib/shop/stripeConnect');
      retrieveConnectAccount.mockRejectedValue(
        new StripeConnectApiError('No access to connected account', 403, 'account_invalid'),
      );

      const res = await GET(jsonCtx('GET'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.connect.accountLinked).toBe(false);
      expect(body.connect.chargesEnabled).toBe(false);
      expect(body.connect.disconnected).toBe(true);
      expect(shopSettingsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shop-1' },
          data: expect.objectContaining({
            stripeConnectChargesEnabled: false,
            stripeConnectDetailsSubmitted: false,
            stripeConnectDisconnectedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('Starter: an explicitly disconnected account is never reported payment-ready (stale chargesEnabled)', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...freeShop,
        stripeConnectChargesEnabled: true,
        stripeConnectDisconnectedAt: new Date('2026-09-01T00:00:00.000Z'),
      });

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(retrieveConnectAccount).not.toHaveBeenCalled();
      expect(body).toMatchObject({
        bookingPaymentsReady: false,
        bookingPaymentsGateReason: 'connect_not_ready',
        collectReady: false,
      });
    });

    it('Starter on a legacy Express account is not payment-ready and asks for Stripe Standard', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...freeShop, stripeConnectAccountType: 'EXPRESS' });
      retrieveConnectAccount.mockResolvedValue({
        chargesEnabled: true,
        detailsSubmitted: true,
        accountType: 'EXPRESS',
      });

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(body).toMatchObject({
        bookingPaymentsReady: false,
        bookingPaymentsGateReason: 'connect_requires_standard',
        starterRequiresStandard: true,
        collectReady: false,
        connect: { accountLinked: true, accountType: 'EXPRESS', chargesEnabled: true },
      });
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });

    it('Full on a legacy Express account keeps its existing payment readiness', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, bookingPaymentMode: 'DEPOSIT' });
      retrieveConnectAccount.mockResolvedValue({
        chargesEnabled: true,
        detailsSubmitted: true,
        accountType: 'EXPRESS',
      });

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(body).toMatchObject({
        bookingPaymentsReady: true,
        bookingPaymentsGateReason: 'ok',
        starterRequiresStandard: false,
        collectReady: true,
      });
    });

    it('SETUP: booking payments unavailable, no fee', async () => {
      asState('SETUP');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(freeShop);

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(body).toMatchObject({
        productState: 'SETUP',
        bookingPaymentsAvailable: false,
        bookingPaymentsReady: false,
        platformFeeBps: null,
      });
    });
  });
});
