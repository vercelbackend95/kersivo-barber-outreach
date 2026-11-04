import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHubApiContext = vi.fn();
const replaceShopOpeningHours = vi.fn();
const writeShopPublicProfile = vi.fn();
const shopSettingsUpdate = vi.fn();
const shopSettingsFindUnique = vi.fn();
const previewRequestUpdate = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/db/client', () => {
  const tx = {
    shopSettings: { update: (...args: unknown[]) => shopSettingsUpdate(...args) },
    previewRequest: { update: (...args: unknown[]) => previewRequestUpdate(...args) },
    shopPublicProfile: {},
  };
  return {
    prisma: {
      shopOpeningHours: { findMany: async () => [] },
      shopSettings: { findUnique: (...args: unknown[]) => shopSettingsFindUnique(...args) },
      shopPublicProfile: { findUnique: async () => null },
      $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
        transaction();
        return fn(tx);
      },
    },
  };
});
vi.mock('@/lib/freePreview/hubApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/freePreview/hubApi')>();
  return {
    ...actual,
    enforceHubDetailsRate: async () => null,
    resolveHubApiContext: (...args: unknown[]) => resolveHubApiContext(...args),
  };
});
vi.mock('@/lib/admin/shopOpeningHours', () => ({
  replaceShopOpeningHours: (...args: unknown[]) => replaceShopOpeningHours(...args),
}));
vi.mock('@/lib/shopData/profile', () => ({
  writeShopPublicProfile: (...args: unknown[]) => writeShopPublicProfile(...args),
}));
vi.mock('@/lib/adminHub/ownerEditEvents', () => ({ recordDebouncedPreviewRequestEvent: async () => undefined }));

import { cookieSourceOf } from '@/lib/freePreview/hubApi';
import { defaultOpeningWeek } from '@/lib/shopData/openingHours';
import { createHubOpeningHoursHandlers, createHubProfileHandlers, HUB_SHOP_NOT_READY } from './shopSetup';

function ctx(over: { draftShopId?: string | null; stage?: string; canEditDetails?: boolean } = {}) {
  return {
    ok: true,
    ctx: {
      request: {
        id: 'req_1',
        draftShopId: over.draftShopId === undefined ? 'shop_1' : over.draftShopId,
        shopName: 'Fade Room',
        townCity: 'Leeds',
      },
      state: { stage: over.stage ?? 'designing', capabilities: { canEditDetails: over.canEditDetails ?? true } },
      isOperator: false,
    },
  };
}

function call(method: string, body: unknown) {
  return {
    request: new Request('http://localhost/api/admin-hub/x', {
      method,
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    params: {},
  } as never;
}

const hours = createHubOpeningHoursHandlers(cookieSourceOf);
const profile = createHubProfileHandlers(cookieSourceOf);

beforeEach(() => {
  resolveHubApiContext.mockReset().mockResolvedValue(ctx());
  replaceShopOpeningHours.mockReset().mockResolvedValue(undefined);
  writeShopPublicProfile.mockReset().mockResolvedValue(undefined);
  shopSettingsUpdate.mockReset().mockResolvedValue({});
  previewRequestUpdate.mockReset().mockResolvedValue({});
  transaction.mockReset();
  shopSettingsFindUnique.mockReset().mockResolvedValue({ name: 'Shop', townCity: null, bookingSlug: 'shop' });
});

describe('hub opening hours and business details endpoints', () => {
  it("writes the draft shop's canonical opening hours", async () => {
    const res = await hours.PUT(call('PUT', { days: defaultOpeningWeek() }));
    expect(res.status).toBe(200);
    expect(replaceShopOpeningHours).toHaveBeenCalledWith(
      'shop_1',
      expect.arrayContaining([
        { dayOfWeek: 1, active: true, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 7, active: false, startTime: '09:00', endTime: '18:00' },
      ]),
    );
  });

  it('rejects a closing time before the opening time', async () => {
    const days = defaultOpeningWeek().map((d) => (d.dayOfWeek === 1 ? { ...d, closes: '08:00' } : d));
    const res = await hours.PUT(call('PUT', { days }));
    expect(res.status).toBe(400);
    expect(replaceShopOpeningHours).not.toHaveBeenCalled();
  });

  it('asks for a shop first when there is no draft shop or the stage is past editing', async () => {
    resolveHubApiContext.mockResolvedValueOnce(ctx({ draftShopId: null }));
    const noShop = await hours.PUT(call('PUT', { days: defaultOpeningWeek() }));
    expect(noShop.status).toBe(409);
    expect((await noShop.json()).error).toBe(HUB_SHOP_NOT_READY);
    resolveHubApiContext.mockResolvedValueOnce(ctx({ stage: 'live' }));
    expect((await profile.PATCH(call('PATCH', { phone: '0161' }))).status).toBe(409);
    expect(writeShopPublicProfile).not.toHaveBeenCalled();
  });

  it('refuses a viewer without edit rights', async () => {
    resolveHubApiContext.mockResolvedValueOnce(ctx({ canEditDetails: false }));
    expect((await profile.PATCH(call('PATCH', { phone: '0161' }))).status).toBe(403);
  });

  it('saves business details through the shared profile writer', async () => {
    const res = await profile.PATCH(call('PATCH', { addressLine1: '2 Example Road', postcode: 'm1 1ae', email: null }));
    expect(res.status).toBe(200);
    expect(writeShopPublicProfile).toHaveBeenCalledWith(
      expect.anything(),
      'shop_1',
      expect.objectContaining({ addressLine1: '2 Example Road', email: null }),
    );
    expect(writeShopPublicProfile.mock.calls[0]![2].postcode).toBe('M1 1AE');
  });

  it('accepts shopName and townCity and writes them to the draft shop and request in one transaction', async () => {
    const res = await profile.PATCH(call('PATCH', { shopName: '  Fade Room North ', townCity: 'York', phone: '0161 496 0000' }));
    expect(res.status).toBe(200);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(shopSettingsUpdate).toHaveBeenCalledWith({
      where: { id: 'shop_1' },
      data: { name: 'Fade Room North', townCity: 'York' },
    });
    expect(previewRequestUpdate).toHaveBeenCalledWith({
      where: { id: 'req_1' },
      data: { shopName: 'Fade Room North', townCity: 'York' },
    });
    // Profile fields go through the shared writer on the same transaction client, without name/town.
    const [db, shopId, values] = writeShopPublicProfile.mock.calls[0]!;
    expect(db).toHaveProperty('previewRequest');
    expect(shopId).toBe('shop_1');
    expect(values).toEqual({ phone: '0161 496 0000' });
  });

  it('never changes the booking slug (or any URL) when the name changes', async () => {
    await profile.PATCH(call('PATCH', { shopName: 'A Completely New Name' }));
    const data = shopSettingsUpdate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['name']);
    expect(data).not.toHaveProperty('bookingSlug');
    expect(previewRequestUpdate.mock.calls[0]![0].data).toEqual({ shopName: 'A Completely New Name' });
  });

  it('clears the town on the shop but keeps the request town (it is required there)', async () => {
    await profile.PATCH(call('PATCH', { townCity: null }));
    expect(shopSettingsUpdate.mock.calls[0]![0].data).toEqual({ townCity: null });
    expect(previewRequestUpdate).not.toHaveBeenCalled();
  });

  it('rejects unknown keys, an empty name and an over-long name', async () => {
    expect((await profile.PATCH(call('PATCH', { shopName: 'Fade', slug: 'fade' }))).status).toBe(400);
    expect((await profile.PATCH(call('PATCH', { bookingSlug: 'x' }))).status).toBe(400);
    expect((await profile.PATCH(call('PATCH', { shopName: '   ' }))).status).toBe(400);
    expect((await profile.PATCH(call('PATCH', { shopName: 'x'.repeat(121) }))).status).toBe(400);
    expect((await profile.PATCH(call('PATCH', { email: 'not-an-email' }))).status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('prefills name and town from the preview request before the draft shop exists', async () => {
    resolveHubApiContext.mockResolvedValueOnce(ctx({ draftShopId: null }));
    const res = await profile.GET(call('GET', undefined));
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.profile).toMatchObject({ shopName: 'Fade Room', townCity: 'Leeds', phone: null });
  });

  it('falls back to the preview request when the draft shop has no name yet', async () => {
    shopSettingsFindUnique.mockResolvedValueOnce({ name: '', townCity: null });
    const body = await (await profile.GET(call('GET', undefined))).json();
    expect(body.profile).toMatchObject({ shopName: 'Fade Room', townCity: 'Leeds' });
    shopSettingsFindUnique.mockResolvedValueOnce({ name: 'Saved Name', townCity: null });
    const saved = await (await profile.GET(call('GET', undefined))).json();
    expect(saved.profile).toMatchObject({ shopName: 'Saved Name', townCity: null });
  });
});
