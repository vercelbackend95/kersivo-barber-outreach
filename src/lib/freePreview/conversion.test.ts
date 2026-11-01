import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enqueueEmail, tryDeliverOutboxEmail } = vi.hoisted(() => ({
  enqueueEmail: vi.fn(async () => ({ id: 'outbox_rejected' })),
  tryDeliverOutboxEmail: vi.fn(async () => undefined),
}));

const db = {
  previewRequest: { updateMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  previewRequestEvent: { create: vi.fn() },
};

type Shop = Record<string, unknown> | null;
const shops: Record<string, Shop> = {};
const counts = { otherMembers: 0, barbers: 0, services: 0, clients: 0, orders: 0, subscriptions: 0 };
const purgeShopData = vi.fn();

const tx = {
  $queryRaw: vi.fn(),
  shopSettings: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => shops[where.id] ?? null),
    update: vi.fn(),
  },
  shopMember: { count: vi.fn(async () => counts.otherMembers), upsert: vi.fn() },
  barber: { count: vi.fn(async () => counts.barbers) },
  service: { count: vi.fn(async () => counts.services) },
  client: { count: vi.fn(async () => counts.clients) },
  order: { count: vi.fn(async () => counts.orders) },
  saasSubscription: { count: vi.fn(async () => counts.subscriptions) },
  clientOnboarding: { upsert: vi.fn() },
  previewRequestEvent: { create: vi.fn() },
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    get previewRequest() {
      return db.previewRequest;
    },
    get previewRequestEvent() {
      return db.previewRequestEvent;
    },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));
vi.mock('@/lib/setup/purgeShopData', () => ({ purgeShopData: (...a: unknown[]) => purgeShopData(...a) }));
vi.mock('./hubLaunch', () => ({ notifyOwnerSubscribed: vi.fn() }));
vi.mock('@/lib/email/outbox', () => ({
  enqueueEmail,
  tryDeliverOutboxEmail,
}));

import { adoptPreviewDraftShop, markPreviewRequestConverted } from './conversion';

const NOW = new Date('2026-11-02T09:00:00Z');

describe('markPreviewRequestConverted (webhook)', () => {
  beforeEach(() => vi.clearAllMocks());

  const input = {
    previewRequestId: 'req_1',
    draftShopId: 'shop_draft',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    stripeSessionId: 'cs_1',
    now: NOW,
  };

  it('converts once with a conditional update and links the Stripe ids', async () => {
    db.previewRequest.findFirst.mockResolvedValueOnce({ status: 'READY', shopName: 'Sharp Cuts' });
    db.previewRequest.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await markPreviewRequestConverted(input)).toBe('converted');
    expect(db.previewRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req_1', draftShopId: 'shop_draft', status: { not: 'CONVERTED' } },
      data: { status: 'CONVERTED', convertedAt: NOW, stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' },
    });
    expect(db.previewRequestEvent.create).toHaveBeenCalledTimes(1);
  });

  it('is idempotent on redelivery: no second event', async () => {
    db.previewRequest.findFirst.mockResolvedValueOnce({ status: 'CONVERTED', shopName: 'Sharp Cuts' });
    expect(await markPreviewRequestConverted(input)).toBe('already_converted');
    expect(db.previewRequest.updateMany).not.toHaveBeenCalled();
    expect(db.previewRequestEvent.create).not.toHaveBeenCalled();
  });

  it('records a REJECTED payment without converting or emailing the owner', async () => {
    db.previewRequest.findFirst.mockResolvedValueOnce({ status: 'REJECTED', shopName: 'Sharp Cuts' });
    db.previewRequest.update.mockResolvedValueOnce({});
    expect(await markPreviewRequestConverted(input)).toBe('rejected_paid');
    expect(db.previewRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' },
    });
    expect(db.previewRequest.updateMany).not.toHaveBeenCalled();
    expect(enqueueEmail).toHaveBeenCalled();
    expect(JSON.stringify(enqueueEmail.mock.calls[0])).toContain(
      'Payment received for a rejected preview request: Sharp Cuts',
    );
  });

  it('ignores metadata whose draft shop does not match the request', async () => {
    db.previewRequest.findFirst.mockResolvedValueOnce(null);
    expect(await markPreviewRequestConverted(input)).toBe('not_found');
    expect(await markPreviewRequestConverted({ ...input, draftShopId: null })).toBe('not_found');
  });
});

describe('adoptPreviewDraftShop (claim)', () => {
  const preview = {
    id: 'req_1',
    email: 'Sam@Example.com',
    firstName: 'Sam',
    townCity: 'Leeds',
    instagramUrl: 'https://instagram.com/sharpcuts',
    websiteUrl: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(counts, { otherMembers: 0, barbers: 0, services: 0, clients: 0, orders: 0, subscriptions: 0 });
    shops.shop_draft = { id: 'shop_draft', ownerUserId: null, previewRequest: preview };
    shops.shop_auto = {
      ownerUserId: 'user_1',
      onboardingCompleted: false,
      shopPaidAt: null,
      freeBookingActivatedAt: null,
      stripeConnectAccountId: null,
      clientOnboarding: null,
      previewRequest: null,
    };
  });

  function adopt(overrides: Partial<Parameters<typeof adoptPreviewDraftShop>[0]> = {}) {
    return adoptPreviewDraftShop({
      draftShopId: 'shop_draft',
      userId: 'user_1',
      currentShopId: 'shop_auto',
      checkoutEmail: 'sam@example.com',
      now: NOW,
      ...overrides,
    });
  }

  it('hands the draft shop to the buyer without rebuilding it and removes the empty auto-created workspace', async () => {
    expect(await adopt()).toEqual({ ok: true, shopId: 'shop_draft', adopted: true });
    expect(purgeShopData).toHaveBeenCalledWith(tx, 'shop_auto');
    expect(tx.shopSettings.update).toHaveBeenCalledWith({
      where: { id: 'shop_draft' },
      data: { ownerUserId: 'user_1', onboardingCompleted: true, onboardingCompletedAt: NOW },
    });
    // Ownership only: no publicActivityPaused change, so the shop stays "under construction" until approval.
    const shopUpdate = tx.shopSettings.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(shopUpdate.data)).not.toContain('publicActivityPaused');
    expect(Object.keys(shopUpdate.data)).not.toContain('bookingPaymentMode');
    expect(Object.keys(shopUpdate.data)).not.toContain('retailEnabled');
    expect(tx.shopMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { shopId: 'shop_draft', userId: 'user_1', role: 'OWNER' } }),
    );
    expect(tx.clientOnboarding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          shopId: 'shop_draft',
          primaryContactEmail: 'sam@example.com',
          townCity: 'Leeds',
          instagramUrl: 'https://instagram.com/sharpcuts',
        }),
      }),
    );
  });

  it('is idempotent for the same user', async () => {
    shops.shop_draft = { ...shops.shop_draft!, ownerUserId: 'user_1' };
    expect(await adopt({ currentShopId: 'shop_draft' })).toEqual({ ok: true, shopId: 'shop_draft', adopted: false });
    expect(tx.shopSettings.update).not.toHaveBeenCalled();
    expect(purgeShopData).not.toHaveBeenCalled();
  });

  it('refuses a different email, an owned draft, or a shop that is not a preview draft', async () => {
    expect(await adopt({ checkoutEmail: 'someone@else.com' })).toEqual({ ok: false, code: 'EMAIL_MISMATCH' });
    shops.shop_draft = { ...shops.shop_draft!, ownerUserId: 'user_2' };
    expect(await adopt()).toEqual({ ok: false, code: 'SHOP_HAS_OWNER' });
    shops.shop_draft = { id: 'shop_draft', ownerUserId: null, previewRequest: null };
    expect(await adopt()).toEqual({ ok: false, code: 'NOT_PREVIEW_DRAFT' });
    expect(tx.shopSettings.update).not.toHaveBeenCalled();
    expect(purgeShopData).not.toHaveBeenCalled();
  });

  it('never deletes a workspace that has data, billing or another member', async () => {
    for (const change of [
      () => (counts.services = 1),
      () => (counts.clients = 3),
      () => (counts.otherMembers = 1),
      () => (counts.subscriptions = 1),
      () => (shops.shop_auto = { ...shops.shop_auto!, onboardingCompleted: true }),
      () => (shops.shop_auto = { ...shops.shop_auto!, ownerUserId: 'someone_else' }),
    ]) {
      change();
      expect(await adopt()).toEqual({ ok: false, code: 'CURRENT_SHOP_NOT_EMPTY' });
      Object.assign(counts, { otherMembers: 0, barbers: 0, services: 0, clients: 0, orders: 0, subscriptions: 0 });
      shops.shop_auto = { ...shops.shop_auto!, ownerUserId: 'user_1', onboardingCompleted: false };
    }
    expect(purgeShopData).not.toHaveBeenCalled();
    expect(tx.shopSettings.update).not.toHaveBeenCalled();
  });
});
