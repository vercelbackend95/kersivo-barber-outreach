import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { ShopRole } from '@prisma/client';
import { accessForState, type KersivoProductState } from '@/lib/shop/kersivoAccess';
import { DEMO_SHOP_ID } from '@/lib/db/shopScope';

const requireAdminContext = vi.fn();
const shopSettingsFindUnique = vi.fn();
const shopSettingsUpdate = vi.fn();
const shopSettingsUpdateMany = vi.fn();
const createConnectExpressAccount = vi.fn();
const createConnectAccountLink = vi.fn();
const retrieveConnectAccount = vi.fn();
const loadKersivoAccess = vi.fn();

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
  },
}));

vi.mock('@/lib/shop/kersivoAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shop/kersivoAccess')>()),
  loadKersivoAccess: (...args: unknown[]) => loadKersivoAccess(...args),
}));

vi.mock('@/lib/shop/stripeConnect', () => ({
  createConnectExpressAccount: (...args: unknown[]) => createConnectExpressAccount(...args),
  createConnectAccountLink: (...args: unknown[]) => createConnectAccountLink(...args),
  retrieveConnectAccount: (...args: unknown[]) => retrieveConnectAccount(...args),
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
  stripeConnectChargesEnabled: true,
  stripeConnectDetailsSubmitted: true,
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
      expect(createConnectExpressAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
      expect(shopSettingsFindUnique).not.toHaveBeenCalled();
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });

    it('rejects BARBER with 403', async () => {
      requireAdminContext.mockResolvedValue(accessFor('BARBER'));

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      expect(createConnectExpressAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
    });

    it('W: Full OWNER creates a Connect account and gets an onboarding url', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, stripeConnectAccountId: null });
      createConnectExpressAccount.mockResolvedValue({ id: 'acct_new' });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe('https://connect.stripe.com/setup/s/xxx');
      expect(body.accountId).toBe('acct_new');
      expect(createConnectExpressAccount).toHaveBeenCalledWith({
        shopId: 'shop-1',
        email: 'owner@example.com',
      });
      expect(shopSettingsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { stripeConnectAccountId: 'acct_new' },
        }),
      );
    });

    it('V: Free OWNER can start Stripe Connect onboarding', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...freeShop, stripeConnectAccountId: null });
      createConnectExpressAccount.mockResolvedValue({ id: 'acct_free' });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(200);
      expect((await res.json()).accountId).toBe('acct_free');
      expect(loadKersivoAccess).toHaveBeenCalledWith('shop-1');
      expect(createConnectExpressAccount).toHaveBeenCalled();
    });

    it('X: SETUP shop cannot start onboarding', async () => {
      asState('SETUP');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...freeShop, stripeConnectAccountId: null });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('BOOKING_PAYMENTS_NOT_AVAILABLE');
      expect(createConnectExpressAccount).not.toHaveBeenCalled();
      expect(createConnectAccountLink).not.toHaveBeenCalled();
    });

    it('X: demo shop cannot start onboarding, even with Full access', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER', DEMO_SHOP_ID));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, id: DEMO_SHOP_ID, stripeConnectAccountId: null });

      const res = await POST(jsonCtx('POST'));
      expect(res.status).toBe(403);
      expect(createConnectExpressAccount).not.toHaveBeenCalled();
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

    it('Y: Free may switch NONE → DEPOSIT → NONE when Connect is ready (depositsEnabled synced)', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(freeShop);
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const on = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'DEPOSIT' }));
      expect(on.status).toBe(200);
      expect(await on.json()).toEqual({ depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' });

      const off = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'NONE' }));
      expect(off.status).toBe(200);
      expect(await off.json()).toEqual({ depositsEnabled: false, bookingPaymentMode: 'NONE' });

      expect(shopSettingsUpdateMany.mock.calls.map((call) => call[0].data)).toEqual([
        { depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' },
        { depositsEnabled: false, bookingPaymentMode: 'NONE' },
      ]);
    });

    it('Y: legacy depositsEnabled payload also works for Free', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(freeShop);
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(200);
      expect((await res.json()).bookingPaymentMode).toBe('DEPOSIT');
    });

    it('Z: Free cannot enable DEPOSIT without ready Connect', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      for (const shop of [
        { ...freeShop, stripeConnectAccountId: null },
        { ...freeShop, stripeConnectChargesEnabled: false },
      ]) {
        shopSettingsFindUnique.mockResolvedValue(shop);
        const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'DEPOSIT' }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe('BOOKING_PAYMENT_NOT_READY');
      }
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('Free can always switch back to NONE even when Connect is not ready', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...freeShop, stripeConnectChargesEnabled: false });
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'NONE' }));
      expect(res.status).toBe(200);
    });

    it('SETUP shop cannot enable DEPOSIT', async () => {
      asState('SETUP');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(freeShop);

      const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'DEPOSIT' }));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('BOOKING_PAYMENTS_NOT_AVAILABLE');
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('AA: FULL cannot be set through the Phase 4B settings endpoint', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);

      const res = await PATCH(jsonCtx('PATCH', { bookingPaymentMode: 'FULL' }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('FULL_BOOKING_PAYMENT_NOT_AVAILABLE');
      expect(shopSettingsFindUnique).not.toHaveBeenCalled();
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects unknown modes and empty payloads', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      for (const body of [{ bookingPaymentMode: 'deposit' }, { bookingPaymentMode: 1 }, {}]) {
        const res = await PATCH(jsonCtx('PATCH', body));
        expect(res.status).toBe(400);
      }
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('S: a stale request cannot overwrite a concurrent FULL mode (409, nothing written)', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);
      shopSettingsUpdateMany.mockResolvedValue({ count: 0 });

      for (const body of [{ depositsEnabled: false }, { bookingPaymentMode: 'DEPOSIT' }]) {
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
        bookingPaymentsAvailable: true,
        bookingPaymentsReady: true,
        collectReady: true,
        platformFeeBps: 0,
        platformFeeExamplePence: 0,
        canManagePayouts: true,
      });
      expect(body.connect.accountId).toBe('acct_existing');
    });

    it('Free: reports a 1% fee (5p on a £5 deposit) and paid=false (Retail stays Full-only)', async () => {
      asState('FREE_BOOKING');
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(freeShop);

      const body = await (await GET(jsonCtx('GET'))).json();
      expect(body).toMatchObject({
        paid: false,
        productState: 'FREE_BOOKING',
        bookingPaymentMode: 'NONE',
        bookingPaymentsAvailable: true,
        bookingPaymentsReady: true,
        collectReady: false,
        platformFeeBps: 100,
        platformFeeExamplePence: 5,
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
