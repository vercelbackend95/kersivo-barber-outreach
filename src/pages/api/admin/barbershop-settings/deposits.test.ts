import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { ShopRole } from '@prisma/client';

const requireAdminContext = vi.fn();
const shopSettingsFindUnique = vi.fn();
const shopSettingsUpdate = vi.fn();
const shopSettingsUpdateMany = vi.fn();
const createConnectExpressAccount = vi.fn();
const createConnectAccountLink = vi.fn();
const retrieveConnectAccount = vi.fn();

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

vi.mock('@/lib/shop/stripeConnect', () => ({
  createConnectExpressAccount: (...args: unknown[]) => createConnectExpressAccount(...args),
  createConnectAccountLink: (...args: unknown[]) => createConnectAccountLink(...args),
  retrieveConnectAccount: (...args: unknown[]) => retrieveConnectAccount(...args),
}));

vi.mock('@/lib/setup/siteUrl', () => ({
  getPublicSiteUrl: () => 'https://kersivo.co.uk',
}));

import { GET, PATCH, POST } from './deposits';

function accessFor(role: ShopRole) {
  return {
    shopId: 'shop-1',
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
  shopPaidAt: new Date('2026-01-01T00:00:00.000Z'),
  smsRemindersEnabled: true,
  depositsEnabled: false,
  stripeConnectAccountId: 'acct_existing',
  stripeConnectChargesEnabled: true,
  stripeConnectDetailsSubmitted: true,
  cancellationWindowHours: 24,
  rescheduleWindowHours: 24,
  maxClientReschedules: 2,
  owner: { email: 'owner@example.com' },
};

describe('barbershop-settings/deposits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveConnectAccount.mockResolvedValue({
      chargesEnabled: true,
      detailsSubmitted: true,
    });
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

    it('allows OWNER to create a Connect account and returns onboarding url', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...paidShop,
        stripeConnectAccountId: null,
      });
      createConnectExpressAccount.mockResolvedValue({ id: 'acct_new' });
      shopSettingsUpdate.mockResolvedValue({});
      createConnectAccountLink.mockResolvedValue({ url: 'https://connect.stripe.com/setup/s/xxx' });

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
      expect(createConnectAccountLink).toHaveBeenCalled();
    });
  });

  describe('PATCH depositsEnabled', () => {
    it('rejects MANAGER with 403 and does not update deposits', async () => {
      requireAdminContext.mockResolvedValue(accessFor('MANAGER'));

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.permission).toBe('billing.manage');
      expect(shopSettingsFindUnique).not.toHaveBeenCalled();
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects BARBER with 403', async () => {
      requireAdminContext.mockResolvedValue(accessFor('BARBER'));

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(403);
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('R: enabling deposits atomically syncs bookingPaymentMode = DEPOSIT', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);
      shopSettingsUpdateMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' });
      expect(shopSettingsUpdateMany).toHaveBeenCalledTimes(1);
      expect(shopSettingsUpdateMany).toHaveBeenCalledWith({
        where: { id: 'shop-1', bookingPaymentMode: { not: 'FULL' } },
        data: { depositsEnabled: true, bookingPaymentMode: 'DEPOSIT' },
      });
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });

    it('R: disabling deposits atomically syncs bookingPaymentMode = NONE', async () => {
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

    it('S: a stale toggle cannot downgrade FULL mode (409, nothing written)', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);
      // Guarded UPDATE matches no row because bookingPaymentMode is FULL.
      shopSettingsUpdateMany.mockResolvedValue({ count: 0 });

      for (const depositsEnabled of [false, true]) {
        const res = await PATCH(jsonCtx('PATCH', { depositsEnabled }));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.code).toBe('booking_payment_mode_full');
      }
      for (const call of shopSettingsUpdateMany.mock.calls) {
        expect(call[0].where.bookingPaymentMode).toEqual({ not: 'FULL' });
        expect(call[0].data.bookingPaymentMode).not.toBe('FULL');
      }
      expect(shopSettingsUpdate).not.toHaveBeenCalled();
    });

    it('stays Paid-only: unpaid shop gets 403 and nothing is written', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({
        ...paidShop,
        shopPaidAt: null,
        smsRemindersEnabled: false,
      });

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(403);
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });

    it('enabling without ready Connect is rejected and nothing is written', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue({ ...paidShop, stripeConnectChargesEnabled: false });

      const res = await PATCH(jsonCtx('PATCH', { depositsEnabled: true }));
      expect(res.status).toBe(400);
      expect(shopSettingsUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('GET deposits status', () => {
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

    it('returns accountId and canManagePayouts for OWNER', async () => {
      requireAdminContext.mockResolvedValue(accessFor('OWNER'));
      shopSettingsFindUnique.mockResolvedValue(paidShop);

      const res = await GET(jsonCtx('GET'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.canManagePayouts).toBe(true);
      expect(body.connect.accountId).toBe('acct_existing');
      expect(body.connect.accountLinked).toBe(true);
    });
  });
});
